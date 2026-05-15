export { runRules, filterIssues, type RunRulesOptions } from "./core/runner";
export type {
  LintCategory,
  LintConfig,
  LintIssue,
  LintPreset,
  LintQuickFix,
  LintResult,
  LintRule,
  Severity,
} from "./core/types";

// Event bus — streaming rule-by-rule feedback
export {
  LintEventBus,
  createLintEventBus,
  type LintEventMap,
  type LintEventType,
  type LintEventPayload,
  type LintEventHandler,
} from "./core/events";

// Result caching — memoize by diagram topology hash
export {
  LintCache,
  createLintCache,
  withLintCache,
  hashDiagramForLint,
  type LintCacheOptions,
  type LintRunner,
} from "./core/cache";

// Serialization — JSON roundtrip for CI caching and reports
export {
  serializeLintResult,
  deserializeLintResult,
  type SerializedLintResult,
} from "./core/serialization";

// Result grouping utilities
export {
  groupIssuesByElement,
  groupIssuesByCategory,
  groupIssuesByRule,
  summarizeByElement,
} from "./core/grouping";

// Diff — detect new and resolved issues between runs
export { diffLintResults, type LintDiff } from "./core/diff";

// BPMN
export {
  runBpmnLint,
  BPMN_RULES,
  BPMN_DESIGN_PRESET,
  BPMN_PRESETS,
  BPMN_RECOMMENDED_PRESET,
  BPMN_STRICT_PRESET,
  type BpmnLintConfig,
  type BpmnLintPresetName,
} from "./bpmn/runner";
export { fromBpmnReactFlow } from "./bpmn/adapters";
export type { BpmnReactFlowLikeDiagram } from "./bpmn/adapters";
export { fromBpmnDiagramState, type BpmnDiagramStateLike } from "./bpmn/adapters-bpmn-state";
export { getBpmnFlowTabOrder } from "./bpmn/tab-order";
export type { BpmnDiagram, BpmnNode, BpmnEdge, BpmnNodeType, BpmnEdgeType, EventTrigger, SubProcessVariant } from "./bpmn/types";

export { runErdLint, ERD_RULES } from "./erd/runner";
export type { ErdDiagram, ErdNode, ErdEdge, ErdNodeType, ErdEdgeType } from "./erd/types";

export { runUmlLint, UML_RULES } from "./uml/runner";
export type { UmlDiagram, UmlNode, UmlEdge, UmlNodeType, UmlEdgeType } from "./uml/types";

export { runC4Lint, C4_RULES } from "./c4/runner";
export type { C4Diagram, C4Node, C4Edge, C4NodeType, C4EdgeType, C4DiagramLevel } from "./c4/types";
