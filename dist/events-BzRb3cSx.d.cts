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

interface LintEventMap {
    /** Fired before a rule's check() is called. */
    "rule:started": {
        ruleId: string;
        severity: Severity;
    };
    /** Fired after a rule produces zero issues. */
    "rule:passed": {
        ruleId: string;
    };
    /** Fired after a rule produces one or more issues. */
    "rule:failed": {
        ruleId: string;
        issues: LintIssue[];
    };
    /** Fired for each individual issue found. */
    "issue:found": {
        issue: LintIssue;
    };
    /** Fired after all rules have been evaluated. */
    "lint:completed": {
        result: LintResult;
    };
}
type LintEventType = keyof LintEventMap;
type LintEventPayload<K extends LintEventType> = LintEventMap[K];
type LintEventHandler<K extends LintEventType> = (payload: LintEventPayload<K>) => void;
/**
 * Typed publish/subscribe event bus for streaming lint execution feedback.
 *
 * Usage:
 * ```ts
 * const bus = createLintEventBus();
 * bus.on("issue:found", ({ issue }) => console.log(issue.message));
 * runBpmnLint(diagram, config, { bus });
 * ```
 */
declare class LintEventBus {
    private listeners;
    on<K extends LintEventType>(event: K, handler: LintEventHandler<K>): () => void;
    once<K extends LintEventType>(event: K, handler: LintEventHandler<K>): () => void;
    off<K extends LintEventType>(event: K, handler: LintEventHandler<K>): void;
    emit<K extends LintEventType>(event: K, payload: LintEventPayload<K>): void;
    /** Remove all listeners for a specific event, or all events if omitted. */
    clear(event?: LintEventType): void;
    /** Number of active listeners for a given event. */
    listenerCount(event: LintEventType): number;
}
/** Factory — prefer this over `new LintEventBus()` for testability. */
declare function createLintEventBus(): LintEventBus;

export { LintEventBus as L, type Severity as S, type LintResult as a, type LintIssue as b, type LintRule as c, type LintConfig as d, type LintCategory as e, type LintEventHandler as f, type LintEventMap as g, type LintEventPayload as h, type LintEventType as i, type LintPreset as j, type LintQuickFix as k, createLintEventBus as l };
