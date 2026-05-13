import { L as LintResult, S as Severity, a as LintIssue, b as LintRule, c as LintConfig } from './types-BHI4Uea2.js';
export { d as LintCategory, e as LintPreset, f as LintQuickFix } from './types-BHI4Uea2.js';
export { BPMN_DESIGN_PRESET, BPMN_PRESETS, BPMN_RECOMMENDED_PRESET, BPMN_RULES, BPMN_STRICT_PRESET, BpmnDiagram, BpmnEdge, BpmnEdgeType, BpmnLintConfig, BpmnLintPresetName, BpmnNode, BpmnNodeType, BpmnReactFlowLikeDiagram, EventTrigger, SubProcessVariant, fromBpmnReactFlow, runBpmnLint } from './bpmn/index.js';
export { ERD_RULES, ErdDiagram, ErdEdge, ErdEdgeType, ErdNode, ErdNodeType, runErdLint } from './erd/index.js';
export { UML_RULES, UmlDiagram, UmlEdge, UmlEdgeType, UmlNode, UmlNodeType, runUmlLint } from './uml/index.js';
export { C4Diagram, C4DiagramLevel, C4Edge, C4EdgeType, C4Node, C4NodeType, C4_RULES, runC4Lint } from './c4/index.js';

declare function runRules<TDiagram>(diagram: TDiagram, rules: LintRule<TDiagram>[], config: LintConfig): LintResult;
declare function filterIssues(result: LintResult, options?: {
    severity?: Severity;
    elementId?: string;
}): LintIssue[];

export { LintConfig, LintIssue, LintResult, LintRule, Severity, filterIssues, runRules };
