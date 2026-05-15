import type { LintIssue, LintResult } from "./types";

export interface LintDiff {
  /** Issues present in `after` that were not in `before`. */
  added: LintIssue[];
  /** Issues present in `before` that are no longer in `after`. */
  resolved: LintIssue[];
  /** Issues present in both results (same ruleId + elementId). */
  unchanged: LintIssue[];
}

function issueKey(issue: LintIssue): string {
  return `${issue.ruleId}::${issue.elementId ?? "__"}::${issue.severity}`;
}

/**
 * Compare two lint results and identify which issues are new, resolved, or unchanged.
 * Issue identity is determined by `ruleId + elementId + severity`.
 *
 * ```ts
 * const before = runBpmnLint(diagramV1, config);
 * const after  = runBpmnLint(diagramV2, config);
 * const diff = diffLintResults(before, after);
 * console.log(`${diff.added.length} new issues, ${diff.resolved.length} fixed`);
 * ```
 */
export function diffLintResults(before: LintResult, after: LintResult): LintDiff {
  const beforeKeys = new Map<string, LintIssue>();
  for (const issue of before.issues) {
    beforeKeys.set(issueKey(issue), issue);
  }

  const afterKeys = new Map<string, LintIssue>();
  for (const issue of after.issues) {
    afterKeys.set(issueKey(issue), issue);
  }

  const added: LintIssue[] = [];
  const unchanged: LintIssue[] = [];
  const resolved: LintIssue[] = [];

  for (const [key, issue] of afterKeys) {
    if (beforeKeys.has(key)) {
      unchanged.push(issue);
    } else {
      added.push(issue);
    }
  }

  for (const [key, issue] of beforeKeys) {
    if (!afterKeys.has(key)) {
      resolved.push(issue);
    }
  }

  return { added, resolved, unchanged };
}
