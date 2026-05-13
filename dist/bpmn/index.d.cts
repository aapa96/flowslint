import { e as LintPreset, b as LintRule, c as LintConfig, L as LintResult } from '../types-BHI4Uea2.cjs';

type BpmnNodeType = "StartEvent" | "EndEvent" | "IntermediateCatchEvent" | "IntermediateThrowEvent" | "BoundaryEvent" | "Task" | "UserTask" | "ServiceTask" | "ScriptTask" | "ManualTask" | "BusinessRuleTask" | "ReceiveTask" | "SendTask" | "CallActivity" | "ExclusiveGateway" | "InclusiveGateway" | "ParallelGateway" | "EventBasedGateway" | "ComplexGateway" | "SubProcess" | "Transaction" | "EventSubProcess" | "AdHocSubProcess" | "Pool" | "Lane" | "Annotation" | "Group" | "DataObject" | "DataObjectReference" | "DataInput" | "DataOutput" | "DataStore" | "DataStoreReference" | "Conversation" | "SubConversation" | "CallConversation" | "ChoreographyTask" | "SubChoreography" | "CallChoreography";
type BpmnEdgeType = "sequenceFlow" | "messageFlow" | "association" | "dataAssociation" | "conversationLink";
type EventTrigger = "none" | "message" | "timer" | "escalation" | "conditional" | "error" | "cancel" | "compensation" | "signal" | "link" | "terminate" | "multiple" | "parallelMultiple";
type SubProcessVariant = "embedded" | "event" | "transaction" | "adhoc";
interface BpmnNode {
    id: string;
    type: BpmnNodeType;
    name?: string;
    /** Pool or lane this node belongs to (for scoping rules). */
    parentId?: string;
    trigger?: EventTrigger;
    isNonInterrupting?: boolean;
    subProcessVariant?: SubProcessVariant;
    participants?: Array<{
        name: string;
        isInitiating: boolean;
    }>;
    isCollection?: boolean;
    /** aranzaflows extensions */
    priority?: "critical" | "high" | "medium" | "low";
    owner?: string;
    /** ISO 8601 duration e.g. "PT4H". */
    sla?: string;
    /** BPMN task/subprocess markers, e.g. ["compensation", "loop"]. */
    markers?: string[];
}
interface BpmnEdge {
    id: string;
    type: BpmnEdgeType;
    source: string;
    target: string;
    name?: string;
    conditionExpression?: string;
    /** True when this is the default flow of an ExclusiveGateway or InclusiveGateway. */
    isDefault?: boolean;
}
interface BpmnDiagram {
    id?: string;
    name?: string;
    nodes: BpmnNode[];
    edges: BpmnEdge[];
}
declare const TASK_TYPES: Set<BpmnNodeType>;
declare const GATEWAY_TYPES: Set<BpmnNodeType>;
declare const EVENT_TYPES: Set<BpmnNodeType>;
declare const FLOW_NODE_TYPES: Set<BpmnNodeType>;
declare function isTask(n: BpmnNode): boolean;
declare function isGateway(n: BpmnNode): boolean;
declare function isEvent(n: BpmnNode): boolean;
declare function isFlowNode(n: BpmnNode): boolean;
declare function isContainer(n: BpmnNode): boolean;

declare const BPMN_RULES: LintRule<BpmnDiagram>[];
declare const BPMN_RECOMMENDED_PRESET: LintPreset;
declare const BPMN_STRICT_PRESET: LintPreset;
declare const BPMN_DESIGN_PRESET: LintPreset;
declare const BPMN_PRESETS: {
    recommended: LintPreset;
    strict: LintPreset;
    design: LintPreset;
};
type BpmnLintPresetName = keyof typeof BPMN_PRESETS;
interface BpmnLintConfig extends Partial<LintConfig> {
    preset?: BpmnLintPresetName | LintPreset;
}
declare function runBpmnLint(diagram: BpmnDiagram, config?: BpmnLintConfig): LintResult;

interface ReactFlowLikeNode {
    id: string;
    type?: string;
    parentId?: string;
    data?: Record<string, unknown>;
}
interface ReactFlowLikeEdge {
    id: string;
    type?: string;
    source: string;
    target: string;
    data?: Record<string, unknown>;
}
interface BpmnReactFlowLikeDiagram {
    id?: string;
    name?: string;
    nodes: ReactFlowLikeNode[];
    edges: ReactFlowLikeEdge[];
}
declare function fromBpmnReactFlow(diagram: BpmnReactFlowLikeDiagram): BpmnDiagram;

export { BPMN_DESIGN_PRESET, BPMN_PRESETS, BPMN_RECOMMENDED_PRESET, BPMN_RULES, BPMN_STRICT_PRESET, type BpmnDiagram, type BpmnEdge, type BpmnEdgeType, type BpmnLintConfig, type BpmnLintPresetName, type BpmnNode, type BpmnNodeType, type BpmnReactFlowLikeDiagram, EVENT_TYPES, type EventTrigger, FLOW_NODE_TYPES, GATEWAY_TYPES, type SubProcessVariant, TASK_TYPES, fromBpmnReactFlow, isContainer, isEvent, isFlowNode, isGateway, isTask, runBpmnLint };
