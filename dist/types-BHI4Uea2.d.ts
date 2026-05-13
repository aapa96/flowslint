type Severity = "error" | "warning" | "info";
type LintCategory = "structure" | "modeling" | "naming" | "best-practice" | "engine" | "documentation";
interface LintQuickFix {
    id: string;
    label: string;
    description?: string;
}
interface LintIssue {
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
interface LintRule<TDiagram> {
    id: string;
    description: string;
    defaultSeverity: Severity;
    category?: LintCategory;
    docsUrl?: string;
    check(diagram: TDiagram): LintIssue[];
}
type RuleSeverityConfig = Record<string, Severity | "off">;
interface LintConfig {
    rules?: RuleSeverityConfig;
}
interface LintPreset {
    name: string;
    description?: string;
    rules: RuleSeverityConfig;
}
interface LintResult {
    issues: LintIssue[];
    errors: number;
    warnings: number;
    infos: number;
    /** true when errors === 0 */
    passed: boolean;
}

export type { LintResult as L, Severity as S, LintIssue as a, LintRule as b, LintConfig as c, LintCategory as d, LintPreset as e, LintQuickFix as f };
