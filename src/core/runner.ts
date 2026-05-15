import type { LintRule, LintConfig, LintResult, LintIssue, Severity } from "./types";
import type { LintEventBus } from "./events";

export interface RunRulesOptions {
  /** Optional event bus for streaming rule-by-rule feedback. */
  bus?: LintEventBus;
}

export function runRules<TDiagram>(
  diagram: TDiagram,
  rules: LintRule<TDiagram>[],
  config: LintConfig,
  options: RunRulesOptions = {},
): LintResult {
  const { bus } = options;
  const issues: LintIssue[] = [];

  for (const rule of rules) {
    const override = config.rules?.[rule.id];
    if (override === "off") continue;

    const severity: Severity = (override as Severity | undefined) ?? rule.defaultSeverity;

    bus?.emit("rule:started", { ruleId: rule.id, severity });

    let found: LintIssue[];
    try {
      found = rule.check(diagram);
    } catch {
      found = [{
        ruleId: rule.id,
        severity: "error",
        message: `Rule "${rule.id}" threw an unexpected error.`,
      }];
    }

    const enriched: LintIssue[] = found.map((issue) => {
      const e: LintIssue = { ...issue, code: issue.code ?? rule.id, severity };
      if (!e.category && rule.category) e.category = rule.category;
      if (!e.docsUrl && rule.docsUrl) e.docsUrl = rule.docsUrl;
      return e;
    });

    if (enriched.length === 0) {
      bus?.emit("rule:passed", { ruleId: rule.id });
    } else {
      bus?.emit("rule:failed", { ruleId: rule.id, issues: enriched });
      for (const issue of enriched) {
        bus?.emit("issue:found", { issue });
      }
    }

    issues.push(...enriched);
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;

  const result: LintResult = { issues, errors, warnings, infos, passed: errors === 0 };
  bus?.emit("lint:completed", { result });
  return result;
}

export function filterIssues(
  result: LintResult,
  options: { severity?: Severity; elementId?: string } = {},
): LintIssue[] {
  return result.issues.filter((issue) => {
    if (options.severity && issue.severity !== options.severity) return false;
    if (options.elementId && issue.elementId !== options.elementId) return false;
    return true;
  });
}
