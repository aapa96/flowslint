import type {
  BpmnDiagram,
  BpmnEdge,
  BpmnEdgeType,
  BpmnDefinitionsSet,
  BpmnEventDefinition,
  BpmnInlineDecisionTable,
  BpmnNode,
  BpmnProcessVariable,
  BpmnServiceTaskConfig,
  BpmnNodeType,
  EventTrigger,
  SubProcessVariant,
} from "./types";

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

export interface BpmnReactFlowLikeDiagram {
  id?: string;
  name?: string;
  definitions?: BpmnDefinitionsSet;
  nodes: ReactFlowLikeNode[];
  edges: ReactFlowLikeEdge[];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}

function asProcessVariables(value: unknown): BpmnProcessVariable[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const variables = value
    .filter((item): item is BpmnProcessVariable => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Record<string, unknown>;
      return typeof candidate.name === "string" && candidate.name.trim().length > 0;
    })
    .map((item) => {
      const variable: BpmnProcessVariable = { name: item.name };
      const id = asString(item.id);
      const type = asString(item.type);
      const defaultValue = asString(item.defaultValue);
      const description = asString(item.description);
      if (id) variable.id = id;
      if (
        type === "string" ||
        type === "integer" ||
        type === "boolean" ||
        type === "date" ||
        type === "object" ||
        type === "array"
      ) {
        variable.type = type;
      }
      if (defaultValue) variable.defaultValue = defaultValue;
      if (description) variable.description = description;
      return variable;
    });
  return variables.length > 0 ? variables : undefined;
}

function asNodeVariableRefs(value: unknown): BpmnNode["variables"] {
  if (!Array.isArray(value)) return undefined;
  const variables: NonNullable<BpmnNode["variables"]> = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      variables.push(item);
      continue;
    }
    if (item && typeof item === "object") {
      const name = asString((item as Record<string, unknown>).name);
      if (name) variables.push({ name });
    }
  }
  return variables.length > 0 ? variables : undefined;
}

function asServiceTaskConfig(value: unknown): BpmnServiceTaskConfig | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  const implementation = asString(candidate.implementation);
  const connectorParams = candidate.connectorParams;
  const httpMethod = asString(candidate.httpMethod);
  const endpoint = asString(candidate.endpoint);
  const connectorAction = asString(candidate.connectorAction);
  const connectorId = asString(candidate.connectorId);
  const connectorInstanceId = asString(candidate.connectorInstanceId);
  const operationRef = asString(candidate.operationRef);
  const config: BpmnServiceTaskConfig = {};
  if (
    implementation === "none" ||
    implementation === "connector" ||
    implementation === "http" ||
    implementation === "webService"
  ) {
    config.implementation = implementation;
  }
  if (
    connectorParams &&
    typeof connectorParams === "object" &&
    !Array.isArray(connectorParams) &&
    Object.values(connectorParams).every((item) => typeof item === "string")
  ) {
    config.connectorParams = connectorParams as Record<string, string>;
  }
  if (
    httpMethod === "GET" ||
    httpMethod === "POST" ||
    httpMethod === "PUT" ||
    httpMethod === "DELETE" ||
    httpMethod === "PATCH"
  ) {
    config.httpMethod = httpMethod;
  }
  if (endpoint) config.endpoint = endpoint;
  if (connectorAction) config.connectorAction = connectorAction;
  if (connectorId) config.connectorId = connectorId;
  if (connectorInstanceId) config.connectorInstanceId = connectorInstanceId;
  if (operationRef) config.operationRef = operationRef;
  return Object.keys(config).length > 0 ? config : undefined;
}

function asInlineDecisionTable(value: unknown): BpmnInlineDecisionTable | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  const hitPolicy = asString(candidate.hitPolicy);
  if (hitPolicy !== "FIRST" && hitPolicy !== "UNIQUE" && hitPolicy !== "COLLECT") {
    return undefined;
  }
  const inputs = Array.isArray(candidate.inputs) ? candidate.inputs : [];
  const outputs = Array.isArray(candidate.outputs) ? candidate.outputs : [];
  const rules = Array.isArray(candidate.rules) ? candidate.rules : [];
  return {
    hitPolicy,
    inputs: inputs.filter((item): item is BpmnInlineDecisionTable["inputs"][number] => Boolean(item && typeof item === "object")),
    outputs: outputs.filter((item): item is BpmnInlineDecisionTable["outputs"][number] => Boolean(item && typeof item === "object")),
    rules: rules.filter((item): item is BpmnInlineDecisionTable["rules"][number] => Boolean(item && typeof item === "object")),
  };
}

function asParticipants(value: unknown): BpmnNode["participants"] {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item): item is { name: string; isInitiating: boolean } => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Record<string, unknown>;
      return typeof candidate.name === "string" &&
        typeof candidate.isInitiating === "boolean";
    })
    .map((item) => ({ name: item.name, isInitiating: item.isInitiating }));
}

function asTimerDefinition(value: unknown): BpmnEventDefinition["timer"] {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  const kind = asString(candidate.kind);
  const timerValue = asString(candidate.value);
  if (!kind || !timerValue) return undefined;
  if (kind !== "date" && kind !== "duration" && kind !== "cycle") return undefined;
  return { kind, value: timerValue };
}

function asEventDefinition(value: unknown): BpmnEventDefinition | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  const type = asString(candidate.type);
  if (!type) return undefined;
  const eventDefinition: BpmnEventDefinition = {
    type: type as EventTrigger,
  };
  const timer = asTimerDefinition(candidate.timer);
  const messageRef = asString(candidate.messageRef);
  const signalRef = asString(candidate.signalRef);
  const errorRef = asString(candidate.errorRef);
  const escalationRef = asString(candidate.escalationRef);
  const conditionExpression = asString(candidate.conditionExpression);
  const linkName = asString(candidate.linkName);
  if (timer) eventDefinition.timer = timer;
  if (messageRef) eventDefinition.messageRef = messageRef;
  if (signalRef) eventDefinition.signalRef = signalRef;
  if (errorRef) eventDefinition.errorRef = errorRef;
  if (escalationRef) eventDefinition.escalationRef = escalationRef;
  if (conditionExpression) eventDefinition.conditionExpression = conditionExpression;
  if (linkName) eventDefinition.linkName = linkName;
  return eventDefinition;
}

export function fromBpmnReactFlow(
  diagram: BpmnReactFlowLikeDiagram,
): BpmnDiagram {
  const variables = asProcessVariables(diagram.definitions?.variables);
  return {
    ...(diagram.id ? { id: diagram.id } : {}),
    ...(diagram.name ? { name: diagram.name } : {}),
    ...(diagram.definitions
      ? {
          definitions: {
            ...diagram.definitions,
            ...(variables ? { variables } : {}),
          },
        }
      : {}),
    nodes: diagram.nodes.map((node): BpmnNode => {
      const data = node.data ?? {};
      const type = (asString(data.elementType) ?? node.type) as BpmnNodeType;
      const mapped: BpmnNode = {
        id: node.id,
        type,
      };
      const name = asString(data.label);
      const trigger = asString(data.trigger);
      const eventDefinition = asEventDefinition(data.eventDefinition);
      const isNonInterrupting = asBoolean(data.isNonInterrupting);
      const attachedToRef = asString(data.attachedToRef);
      const subProcessVariant = asString(data.subProcessVariant);
      const participants = asParticipants(data.participants);
      const isCollection = asBoolean(data.isCollection);
      const priority = asString(data.priority);
      const owner = asString(data.owner);
      const sla = asString(data.sla);
      const connector = asString(data.connector);
      const action = asString(data.action);
      const flowableType = asString(data.flowableType);
      const flowableDelegateExpression = asString(data.flowableDelegateExpression);
      const decisionRef = asString(data.decisionRef);
      const inlineDecisionTable = asInlineDecisionTable(data.inlineDecisionTable);
      const formKey = asString(data.formKey);
      const candidateUsers = asString(data.candidateUsers);
      const candidateGroups = asString(data.candidateGroups);
      const dueDate = asString(data.dueDate);
      const skipExpression = asString(data.skipExpression);
      const businessCalendarName = asString(data.businessCalendarName);
      const variables = asNodeVariableRefs(data.variables);
      const outputVariable = asString(data.outputVariable);
      const resultVariable = asString(data.resultVariable);
      const serviceConfig = asServiceTaskConfig(data.serviceConfig);
      const completionCondition = asString(data.completionCondition);
      const calledElement = asString(data.calledElement);
      const scriptFormat = asString(data.scriptFormat);
      const script = asString(data.script);
      const loopType = asString(data.loopType);
      const loopCondition = asString(data.loopCondition);
      const loopCardinality = asString(data.loopCardinality);
      const loopCompletionCondition = asString(data.loopCompletionCondition);
      const dataObjectRef = asString(data.dataObjectRef);
      const dataStoreRef = asString(data.dataStoreRef);
      const markers = asStringArray(data.markers);

      if (name) mapped.name = name;
      if (node.parentId) mapped.parentId = node.parentId;
      if (trigger) mapped.trigger = trigger as EventTrigger;
      if (eventDefinition) mapped.eventDefinition = eventDefinition;
      if (isNonInterrupting !== undefined) mapped.isNonInterrupting = isNonInterrupting;
      if (attachedToRef) mapped.attachedToRef = attachedToRef;
      if (subProcessVariant) {
        mapped.subProcessVariant = subProcessVariant as SubProcessVariant;
      }
      if (participants) mapped.participants = participants;
      if (isCollection !== undefined) mapped.isCollection = isCollection;
      if (priority) mapped.priority = priority as NonNullable<BpmnNode["priority"]>;
      if (owner) mapped.owner = owner;
      if (sla) mapped.sla = sla;
      if (connector) mapped.connector = connector;
      if (action) mapped.action = action;
      if (flowableType) mapped.flowableType = flowableType;
      if (flowableDelegateExpression) mapped.flowableDelegateExpression = flowableDelegateExpression;
      if (decisionRef) mapped.decisionRef = decisionRef;
      if (inlineDecisionTable) mapped.inlineDecisionTable = inlineDecisionTable;
      if (formKey) mapped.formKey = formKey;
      if (candidateUsers) mapped.candidateUsers = candidateUsers;
      if (candidateGroups) mapped.candidateGroups = candidateGroups;
      if (dueDate) mapped.dueDate = dueDate;
      if (skipExpression) mapped.skipExpression = skipExpression;
      if (businessCalendarName) mapped.businessCalendarName = businessCalendarName;
      if (variables) mapped.variables = variables;
      if (outputVariable) mapped.outputVariable = outputVariable;
      if (resultVariable) mapped.resultVariable = resultVariable;
      if (serviceConfig) mapped.serviceConfig = serviceConfig;
      if (completionCondition) mapped.completionCondition = completionCondition;
      if (calledElement) mapped.calledElement = calledElement;
      if (scriptFormat) mapped.scriptFormat = scriptFormat;
      if (script) mapped.script = script;
      if (loopType) mapped.loopType = loopType;
      if (loopCondition) mapped.loopCondition = loopCondition;
      if (loopCardinality) mapped.loopCardinality = loopCardinality;
      if (loopCompletionCondition) mapped.loopCompletionCondition = loopCompletionCondition;
      if (dataObjectRef) mapped.dataObjectRef = dataObjectRef;
      if (dataStoreRef) mapped.dataStoreRef = dataStoreRef;
      if (markers) mapped.markers = markers;
      return mapped;
    }),
    edges: diagram.edges.map((edge): BpmnEdge => {
      const data = edge.data ?? {};
      const type = (asString(data.edgeType) ?? edge.type) as BpmnEdgeType;
      const mapped: BpmnEdge = {
        id: edge.id,
        type,
        source: edge.source,
        target: edge.target,
      };
      const name = asString(data.label);
      const conditionExpression = asString(data.conditionExpression);
      const isDefault = asBoolean(data.isDefault);
      if (name) mapped.name = name;
      if (conditionExpression) mapped.conditionExpression = conditionExpression;
      if (isDefault !== undefined) mapped.isDefault = isDefault;
      return mapped;
    }),
  };
}
