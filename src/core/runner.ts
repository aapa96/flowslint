import type { LintRule, LintConfig, LintResult, LintIssue, Severity } from "./types";

export function runRules<TDiagram>(
  diagram: TDiagram,
  rules: LintRule<TDiagram>[],
  config: LintConfig,
): LintResult {
  const issues: LintIssue[] = [];

  for (const rule of rules) {
    const override = config.rules?.[rule.id];
    if (override === "off") continue;

    const severity: Severity = (override as Severity | undefined) ?? rule.defaultSeverity;

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

    for (const issue of found) {
      const enriched: LintIssue = {
        ...issue,
        code: issue.code ?? rule.id,
        severity,
      };
      if (!enriched.category && rule.category) enriched.category = rule.category;
      if (!enriched.docsUrl && rule.docsUrl) enriched.docsUrl = rule.docsUrl;
      issues.push(enriched);
    }
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;

  return { issues, errors, warnings, infos, passed: errors === 0 };
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
