// ─── Element types — mirrors diagrams-bpmn BpmnElementType ───────────────────

export type BpmnNodeType =
  // Events
  | "StartEvent"
  | "EndEvent"
  | "IntermediateCatchEvent"
  | "IntermediateThrowEvent"
  | "BoundaryEvent"
  // Tasks
  | "Task"
  | "UserTask"
  | "ServiceTask"
  | "ScriptTask"
  | "ManualTask"
  | "BusinessRuleTask"
  | "ReceiveTask"
  | "SendTask"
  | "CallActivity"
  // Gateways
  | "ExclusiveGateway"
  | "InclusiveGateway"
  | "ParallelGateway"
  | "EventBasedGateway"
  | "ComplexGateway"
  // Containers
  | "SubProcess"
  | "Transaction"
  | "EventSubProcess"
  | "AdHocSubProcess"
  | "Pool"
  | "Lane"
  // Artifacts
  | "Annotation"
  | "Group"
  // Data (§10.3)
  | "DataObject"
  | "DataObjectReference"
  | "DataInput"
  | "DataOutput"
  | "DataStore"
  | "DataStoreReference"
  // Conversation (§12)
  | "Conversation"
  | "SubConversation"
  | "CallConversation"
  // Choreography (§11)
  | "ChoreographyTask"
  | "SubChoreography"
  | "CallChoreography";

export type BpmnEdgeType =
  | "sequenceFlow"
  | "messageFlow"
  | "association"
  | "dataAssociation"
  | "conversationLink";

export type EventTrigger =
  | "none"
  | "message"
  | "timer"
  | "escalation"
  | "conditional"
  | "error"
  | "cancel"
  | "compensation"
  | "signal"
  | "link"
  | "terminate"
  | "multiple"
  | "parallelMultiple";

export interface BpmnTimerDefinition {
  kind: "date" | "duration" | "cycle";
  value: string;
}

export interface BpmnEventDefinition {
  type: EventTrigger;
  timer?: BpmnTimerDefinition;
  messageRef?: string;
  signalRef?: string;
  errorRef?: string;
  escalationRef?: string;
  conditionExpression?: string;
  linkName?: string;
}

export interface BpmnMessageDefinition {
  id: string;
  name: string;
}

export interface BpmnSignalDefinition {
  id: string;
  name: string;
}

export interface BpmnErrorDefinition {
  id: string;
  name: string;
  errorCode?: string;
}

export interface BpmnEscalationDefinition {
  id: string;
  name: string;
  escalationCode?: string;
}

export interface BpmnProcessVariable {
  id?: string;
  name: string;
  type?: "string" | "integer" | "boolean" | "date" | "object" | "array";
  defaultValue?: string;
  description?: string;
}

export interface BpmnServiceTaskConfig {
  implementation?: "none" | "connector" | "http" | "webService";
  connectorParams?: Record<string, string>;
  httpMethod?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  endpoint?: string;
  connectorAction?: string;
  connectorId?: string;
  connectorInstanceId?: string;
  operationRef?: string;
}

export interface BpmnInlineDecisionInput {
  id: string;
  expression: string;
  label: string;
}

export interface BpmnInlineDecisionOutput {
  id: string;
  name: string;
  label: string;
}

export interface BpmnInlineDecisionRule {
  id: string;
  inputs: Record<string, string>;
  outputs: Record<string, string>;
  annotation?: string;
}

export interface BpmnInlineDecisionTable {
  hitPolicy: "FIRST" | "UNIQUE" | "COLLECT";
  inputs: BpmnInlineDecisionInput[];
  outputs: BpmnInlineDecisionOutput[];
  rules: BpmnInlineDecisionRule[];
}

export interface BpmnDefinitionsSet {
  messages?: BpmnMessageDefinition[];
  signals?: BpmnSignalDefinition[];
  errors?: BpmnErrorDefinition[];
  escalations?: BpmnEscalationDefinition[];
  variables?: BpmnProcessVariable[];
}

export type SubProcessVariant = "embedded" | "event" | "transaction" | "adhoc";

// ─── Graph model ──────────────────────────────────────────────────────────────

export interface BpmnNode {
  id: string;
  type: BpmnNodeType;
  name?: string;
  /** Pool or lane this node belongs to (for scoping rules). */
  parentId?: string;
  // Event properties
  trigger?: EventTrigger;
  isNonInterrupting?: boolean;
  eventDefinition?: BpmnEventDefinition;
  attachedToRef?: string;
  // Sub-process properties
  subProcessVariant?: SubProcessVariant;
  // Choreography participant bands
  participants?: Array<{ name: string; isInitiating: boolean }>;
  // Data properties
  isCollection?: boolean;
  /** aranzaflows extensions */
  priority?: "critical" | "high" | "medium" | "low";
  owner?: string;
  /** ISO 8601 duration e.g. "PT4H". */
  sla?: string;
  /** Aranza connector id. */
  connector?: string;
  /** Aranza connector action. */
  action?: string;
  /** Additional service-task execution metadata kept by the product. */
  serviceConfig?: BpmnServiceTaskConfig;
  /** Flowable execution type (e.g. "http", "dmn", "mail"). */
  flowableType?: string;
  /** Flowable delegate expression. */
  flowableDelegateExpression?: string;
  /** BusinessRuleTask: DMN decision table id. */
  decisionRef?: string;
  /** BusinessRuleTask: simplified inline decision table. */
  inlineDecisionTable?: BpmnInlineDecisionTable;
  /** UserTask: form key resolved to a FormDefinition name at runtime. */
  formKey?: string;
  /** UserTask: comma-separated Flowable user ids. */
  candidateUsers?: string;
  /** UserTask: comma-separated Flowable group ids. */
  candidateGroups?: string;
  /** UserTask: ISO-8601 due date or FEEL expression. */
  dueDate?: string;
  /** UserTask: FEEL expression; when truthy the task is skipped. */
  skipExpression?: string;
  /** UserTask: business calendar name for due-date computation. */
  businessCalendarName?: string;
  /** Variables declared directly in the node payload. */
  variables?: Array<string | Pick<BpmnProcessVariable, "name">>;
  /** Variable created/assigned by a task. */
  outputVariable?: string;
  /** Legacy output variable field still present in some nodes. */
  resultVariable?: string;
  /** AdHocSubProcess: FEEL completion condition. */
  completionCondition?: string;
  /** CallActivity: id of the referenced called element. */
  calledElement?: string;
  /** ScriptTask: scripting language (e.g. "javascript", "groovy"). */
  scriptFormat?: string;
  /** ScriptTask: source code or expression body. */
  script?: string;
  /** Loop / multi-instance type: "loop" | "sequentialMultiple" | "parallelMultiple". */
  loopType?: string;
  /** StandardLoopCharacteristics: FEEL condition evaluated before each iteration. */
  loopCondition?: string;
  /** MultiInstanceLoopCharacteristics: number of instances as a FEEL expression. */
  loopCardinality?: string;
  /** MultiInstanceLoopCharacteristics: FEEL completion condition. */
  loopCompletionCondition?: string;
  /** DataObjectReference: id of the backing bpmn:DataObject element. */
  dataObjectRef?: string;
  /** DataStoreReference: id of the backing bpmn:DataStore element. */
  dataStoreRef?: string;
  /** BPMN task/subprocess markers, e.g. ["compensation", "loop"]. */
  markers?: string[];
}

export interface BpmnEdge {
  id: string;
  type: BpmnEdgeType;
  source: string;
  target: string;
  name?: string;
  conditionExpression?: string;
  /** True when this is the default flow of an ExclusiveGateway or InclusiveGateway. */
  isDefault?: boolean;
}

export interface BpmnDiagram {
  id?: string;
  name?: string;
  nodes: BpmnNode[];
  edges: BpmnEdge[];
  definitions?: BpmnDefinitionsSet;
}

// ─── Node category helpers ────────────────────────────────────────────────────

export const TASK_TYPES = new Set<BpmnNodeType>([
  "Task", "UserTask", "ServiceTask", "ScriptTask",
  "ManualTask", "BusinessRuleTask", "ReceiveTask", "SendTask", "CallActivity",
]);

export const GATEWAY_TYPES = new Set<BpmnNodeType>([
  "ExclusiveGateway", "InclusiveGateway", "ParallelGateway",
  "EventBasedGateway", "ComplexGateway",
]);

// EventBasedGateway is excluded — its splitting rule is handled separately
export const SPLITTING_GATEWAY_TYPES = new Set<BpmnNodeType>([
  "ExclusiveGateway", "InclusiveGateway", "ParallelGateway", "ComplexGateway",
]);

export const JOINING_GATEWAY_TYPES = new Set<BpmnNodeType>([
  "ExclusiveGateway", "InclusiveGateway", "ParallelGateway", "ComplexGateway",
]);

export const EVENT_TYPES = new Set<BpmnNodeType>([
  "StartEvent", "EndEvent", "IntermediateCatchEvent",
  "IntermediateThrowEvent", "BoundaryEvent",
]);

export const CATCH_EVENT_TYPES = new Set<BpmnNodeType>([
  "StartEvent", "IntermediateCatchEvent", "BoundaryEvent",
]);

export const THROW_EVENT_TYPES = new Set<BpmnNodeType>([
  "IntermediateThrowEvent", "EndEvent",
]);

export const FLOW_NODE_TYPES = new Set<BpmnNodeType>([
  ...TASK_TYPES, ...GATEWAY_TYPES, ...EVENT_TYPES,
  "SubProcess", "Transaction", "EventSubProcess", "AdHocSubProcess",
  "ChoreographyTask", "SubChoreography", "CallChoreography",
]);

export function isTask(n: BpmnNode): boolean { return TASK_TYPES.has(n.type); }
export function isGateway(n: BpmnNode): boolean { return GATEWAY_TYPES.has(n.type); }
export function isJoiningGateway(n: BpmnNode): boolean { return JOINING_GATEWAY_TYPES.has(n.type); }
export function isSplittingGateway(n: BpmnNode): boolean { return SPLITTING_GATEWAY_TYPES.has(n.type); }
export function isEvent(n: BpmnNode): boolean { return EVENT_TYPES.has(n.type); }
export function isFlowNode(n: BpmnNode): boolean { return FLOW_NODE_TYPES.has(n.type); }
export function isContainer(n: BpmnNode): boolean {
  return n.type === "Pool" ||
    n.type === "Lane" ||
    n.type === "SubProcess" ||
    n.type === "Transaction" ||
    n.type === "EventSubProcess" ||
    n.type === "AdHocSubProcess" ||
    n.type === "SubConversation" ||
    n.type === "SubChoreography";
}

export function isSubProcessLike(n: BpmnNode): boolean {
  return n.type === "SubProcess" ||
    n.type === "Transaction" ||
    n.type === "EventSubProcess" ||
    n.type === "AdHocSubProcess";
}

/** Returns the immediate SubProcess parent of a node, if any. */
export function subProcessParent(n: BpmnNode, nodeById: Map<string, BpmnNode>): BpmnNode | undefined {
  if (!n.parentId) return undefined;
  const parent = nodeById.get(n.parentId);
  if (!parent) return undefined;
  return isSubProcessLike(parent) ? parent : subProcessParent(parent, nodeById);
}

/** Returns the top-level Pool ancestor of a node, if any. */
export function poolAncestor(n: BpmnNode, nodeById: Map<string, BpmnNode>): BpmnNode | undefined {
  if (!n.parentId) return undefined;
  const parent = nodeById.get(n.parentId);
  if (!parent) return undefined;
  return parent.type === "Pool" ? parent : poolAncestor(parent, nodeById);
}

/** Nodes directly inside a given parent (depth 1 only). */
export function directChildren(parentId: string, nodes: BpmnNode[]): BpmnNode[] {
  return nodes.filter((n) => n.parentId === parentId);
}

/** Top-level process nodes — not inside any SubProcess or Pool. */
export function topLevelFlowNodes(nodes: BpmnNode[]): BpmnNode[] {
  const subProcessIds = new Set(nodes.filter(isSubProcessLike).map((n) => n.id));
  const poolIds = new Set(nodes.filter((n) => n.type === "Pool").map((n) => n.id));
  return nodes.filter((n) => {
    if (!isFlowNode(n)) return false;
    if (!n.parentId) return true;
    // If parentId is a Lane or Pool, it's still top-level process scope
    const parent = nodes.find((x) => x.id === n.parentId);
    if (!parent) return true;
    return parent.type === "Lane" && !subProcessIds.has(n.parentId) && !poolIds.has(n.parentId);
  });
}
