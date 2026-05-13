export type Severity = "error" | "warning" | "info";
export type LintCategory =
  | "structure"
  | "modeling"
  | "naming"
  | "best-practice"
  | "engine"
  | "documentation";

export interface LintQuickFix {
  id: string;
  label: string;
  description?: string;
}

export interface LintIssue {
  ruleId: string;
  severity: Severity;
  message: string;
  elementId?: string;
  elementType?: string;
  category?: LintCategory;
  scope?: string;
  code?: string;
  docsUrl?: string;
  relatedElementIds?: string[];
  quickFixes?: LintQuickFix[];
}

export interface LintRule<TDiagram> {
  id: string;
  description: string;
  defaultSeverity: Severity;
  category?: LintCategory;
  docsUrl?: string;
  check(diagram: TDiagram): LintIssue[];
}

export type RuleSeverityConfig = Record<string, Severity | "off">;

export interface LintConfig {
  rules?: RuleSeverityConfig;
}

export interface LintPreset {
  name: string;
  description?: string;
  rules: RuleSeverityConfig;
}

export interface LintResult {
  issues: LintIssue[];
  errors: number;
  warnings: number;
  infos: number;
  /** true when errors === 0 */
  passed: boolean;
}
