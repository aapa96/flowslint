import type { LintCategory, LintIssue, LintResult } from "./types";

/**
 * Group issues by the element they reference.
 * Issues without an `elementId` are grouped under the key `"__diagram__"`.
 *
 * @returns A `Map` keyed by element ID → issues.
 */
export function groupIssuesByElement(result: LintResult): Map<string, LintIssue[]> {
  const map = new Map<string, LintIssue[]>();
  for (const issue of result.issues) {
    const key = issue.elementId ?? "__diagram__";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(issue);
  }
  return map;
}

/**
 * Group issues by lint category.
 * Issues without a category are grouped under the key `"uncategorized"`.
 *
 * @returns A `Map` keyed by `LintCategory | "uncategorized"` → issues.
 */
export function groupIssuesByCategory(
  result: LintResult,
): Map<LintCategory | "uncategorized", LintIssue[]> {
  const map = new Map<LintCategory | "uncategorized", LintIssue[]>();
  for (const issue of result.issues) {
    const key: LintCategory | "uncategorized" = issue.category ?? "uncategorized";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(issue);
  }
  return map;
}

/**
 * Group issues by the rule that produced them.
 *
 * @returns A `Map` keyed by rule ID → issues.
 */
export function groupIssuesByRule(result: LintResult): Map<string, LintIssue[]> {
  const map = new Map<string, LintIssue[]>();
  for (const issue of result.issues) {
    const key = issue.ruleId;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(issue);
  }
  return map;
}

/**
 * Return a plain-object summary of issues per element, suitable for serialization.
 * Useful for badge rendering or CI summary tables.
 *
 * @returns Record of elementId → { errors, warnings, infos }
 */
export function summarizeByElement(
  result: LintResult,
): Record<string, { errors: number; warnings: number; infos: number }> {
  const summary: Record<string, { errors: number; warnings: number; infos: number }> = {};
  for (const issue of result.issues) {
    const key = issue.elementId ?? "__diagram__";
    if (!summary[key]) summary[key] = { errors: 0, warnings: 0, infos: 0 };
    if (issue.severity === "error") summary[key]!.errors += 1;
    else if (issue.severity === "warning") summary[key]!.warnings += 1;
    else if (issue.severity === "info") summary[key]!.infos += 1;
  }
  return summary;
}
