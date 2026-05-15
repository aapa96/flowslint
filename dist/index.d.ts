import { L as LintEventBus, a as LintResult, S as Severity, b as LintIssue, c as LintRule, d as LintConfig, e as LintCategory } from './events-BzRb3cSx.js';
export { f as LintEventHandler, g as LintEventMap, h as LintEventPayload, i as LintEventType, j as LintPreset, k as LintQuickFix, l as createLintEventBus } from './events-BzRb3cSx.js';
import { BpmnDiagram } from './bpmn/index.js';
export { BPMN_DESIGN_PRESET, BPMN_PRESETS, BPMN_RECOMMENDED_PRESET, BPMN_RULES, BPMN_STRICT_PRESET, BpmnEdge, BpmnEdgeType, BpmnLintConfig, BpmnLintPresetName, BpmnNode, BpmnNodeType, BpmnReactFlowLikeDiagram, EventTrigger, SubProcessVariant, fromBpmnReactFlow, runBpmnLint } from './bpmn/index.js';
export { ERD_RULES, ErdDiagram, ErdEdge, ErdEdgeType, ErdNode, ErdNodeType, runErdLint } from './erd/index.js';
export { UML_RULES, UmlDiagram, UmlEdge, UmlEdgeType, UmlNode, UmlNodeType, runUmlLint } from './uml/index.js';
export { C4Diagram, C4DiagramLevel, C4Edge, C4EdgeType, C4Node, C4NodeType, C4_RULES, runC4Lint } from './c4/index.js';

interface RunRulesOptions {
    /** Optional event bus for streaming rule-by-rule feedback. */
    bus?: LintEventBus;
}
declare function runRules<TDiagram>(diagram: TDiagram, rules: LintRule<TDiagram>[], config: LintConfig, options?: RunRulesOptions): LintResult;
declare function filterIssues(result: LintResult, options?: {
    severity?: Severity;
    elementId?: string;
}): LintIssue[];

/**
 * Produce a stable string key from a diagram's node/edge topology.
 * Two diagrams with the same node ids, types, and edge connections produce the same hash.
 */
declare function hashDiagramForLint(diagram: unknown): string;
interface LintCacheOptions {
    /** Maximum number of cached results. LRU eviction. Default: 32. */
    maxSize?: number;
}
/**
 * Memoize lint results by diagram topology hash.
 * Identical diagram structures (same node ids, types, edge connections)
 * will return the cached result without re-running rules.
 *
 * ```ts
 * const cache = createLintCache();
 * const cachedRun = withLintCache(runBpmnLint, cache);
 * const result = cachedRun(diagram, config); // first run computed
 * const result2 = cachedRun(diagram, config); // served from cache
 * ```
 */
declare class LintCache {
    private readonly maxSize;
    private readonly entries;
    constructor(options?: LintCacheOptions);
    get(key: string): LintResult | undefined;
    set(key: string, result: LintResult): void;
    invalidate(key: string): void;
    clear(): void;
    get size(): number;
}
/** Factory — prefer this over `new LintCache()`. */
declare function createLintCache(options?: LintCacheOptions): LintCache;
type LintRunner<TDiagram, TConfig> = (diagram: TDiagram, config?: TConfig) => LintResult;
/**
 * Wrap a lint runner function with topology-based caching.
 * The cache key is derived from `hashDiagramForLint(diagram)`.
 * When the diagram topology is unchanged, the cached result is returned immediately.
 *
 * @param runner - Any lint runner (runBpmnLint, runErdLint, etc.).
 * @param cache  - Shared `LintCache` instance (or a new one is created).
 */
declare function withLintCache<TDiagram, TConfig>(runner: LintRunner<TDiagram, TConfig>, cache?: LintCache): LintRunner<TDiagram, TConfig>;

interface SerializedLintResult {
    schema: "aranzatech.lint";
    version: 1;
    /** ISO 8601 timestamp of when this result was produced. */
    timestamp: string;
    issues: LintIssue[];
    errors: number;
    warnings: number;
    infos: number;
    passed: boolean;
}
/**
 * Serialize a lint result to a stable JSON string suitable for CI caching,
 * report storage, or diffing across runs.
 *
 * ```ts
 * const json = serializeLintResult(result);
 * fs.writeFileSync("lint-result.json", json);
 * ```
 */
declare function serializeLintResult(result: LintResult): string;
/**
 * Deserialize a lint result that was previously serialized with
 * `serializeLintResult`. Throws when the document is not a valid
 * `aranzatech.lint` schema.
 */
declare function deserializeLintResult(json: string): LintResult;

/**
 * Group issues by the element they reference.
 * Issues without an `elementId` are grouped under the key `"__diagram__"`.
 *
 * @returns A `Map` keyed by element ID → issues.
 */
declare function groupIssuesByElement(result: LintResult): Map<string, LintIssue[]>;
/**
 * Group issues by lint category.
 * Issues without a category are grouped under the key `"uncategorized"`.
 *
 * @returns A `Map` keyed by `LintCategory | "uncategorized"` → issues.
 */
declare function groupIssuesByCategory(result: LintResult): Map<LintCategory | "uncategorized", LintIssue[]>;
/**
 * Group issues by the rule that produced them.
 *
 * @returns A `Map` keyed by rule ID → issues.
 */
declare function groupIssuesByRule(result: LintResult): Map<string, LintIssue[]>;
/**
 * Return a plain-object summary of issues per element, suitable for serialization.
 * Useful for badge rendering or CI summary tables.
 *
 * @returns Record of elementId → { errors, warnings, infos }
 */
declare function summarizeByElement(result: LintResult): Record<string, {
    errors: number;
    warnings: number;
    infos: number;
}>;

interface LintDiff {
    /** Issues present in `after` that were not in `before`. */
    added: LintIssue[];
    /** Issues present in `before` that are no longer in `after`. */
    resolved: LintIssue[];
    /** Issues present in both results (same ruleId + elementId). */
    unchanged: LintIssue[];
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
declare function diffLintResults(before: LintResult, after: LintResult): LintDiff;

/**
 * Minimal structural shape of a `BpmnDiagramState` from `@aranzatech/diagrams-bpmn`.
 * Defined structurally so flowslint stays zero-dependency.
 */
interface BpmnDiagramStateLike {
    nodes: Array<{
        id: string;
        type?: string;
        parentId?: string;
        data?: Record<string, unknown>;
        [key: string]: unknown;
    }>;
    edges: Array<{
        id: string;
        source: string;
        target: string;
        type?: string;
        data?: Record<string, unknown>;
        [key: string]: unknown;
    }>;
    [key: string]: unknown;
}
/**
 * Convert a `BpmnDiagramState` from `@aranzatech/diagrams-bpmn` directly into
 * a `BpmnDiagram` that `runBpmnLint` can process.
 *
 * This is a thin type-safe alias over `fromBpmnReactFlow` — no conversion
 * logic is duplicated and flowslint stays zero-dependency.
 *
 * ```ts
 * import { fromBpmnDiagramState, runBpmnLint } from "@aranzatech/flowslint";
 * // ...
 * const lintDiagram = fromBpmnDiagramState(bpmnState);
 * const result = runBpmnLint(lintDiagram);
 * ```
 */
declare function fromBpmnDiagramState(state: BpmnDiagramStateLike): BpmnDiagram;

/**
 * Compute a logical tab order for BPMN flow nodes using BFS from Start Events.
 *
 * Order:
 * 1. Start Events come first (sources with no incoming sequence flows).
 * 2. Remaining flow nodes are visited in BFS order following SequenceFlow edges.
 * 3. Flow nodes unreachable from any Start Event are appended at the end.
 * 4. Non-flow nodes (Pools, Lanes, Annotations, Data objects) are excluded.
 *
 * @param diagram - BPMN diagram to traverse.
 * @param scopeId - Optional parent node ID to restrict traversal to a Pool or SubProcess.
 * @returns Ordered array of node IDs.
 */
declare function getBpmnFlowTabOrder(diagram: BpmnDiagram, scopeId?: string): string[];

export { BpmnDiagram, type BpmnDiagramStateLike, LintCache, type LintCacheOptions, LintCategory, LintConfig, type LintDiff, LintEventBus, LintIssue, LintResult, LintRule, type LintRunner, type RunRulesOptions, type SerializedLintResult, Severity, createLintCache, deserializeLintResult, diffLintResults, filterIssues, fromBpmnDiagramState, getBpmnFlowTabOrder, groupIssuesByCategory, groupIssuesByElement, groupIssuesByRule, hashDiagramForLint, runRules, serializeLintResult, summarizeByElement, withLintCache };
