import type {
  BpmnDiagram,
  BpmnEdge,
  BpmnEdgeType,
  BpmnNode,
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

export function fromBpmnReactFlow(
  diagram: BpmnReactFlowLikeDiagram,
): BpmnDiagram {
  return {
    ...(diagram.id ? { id: diagram.id } : {}),
    ...(diagram.name ? { name: diagram.name } : {}),
    nodes: diagram.nodes.map((node): BpmnNode => {
      const data = node.data ?? {};
      const type = (asString(data.elementType) ?? node.type) as BpmnNodeType;
      const mapped: BpmnNode = {
        id: node.id,
        type,
      };
      const name = asString(data.label);
      const trigger = asString(data.trigger);
      const isNonInterrupting = asBoolean(data.isNonInterrupting);
      const subProcessVariant = asString(data.subProcessVariant);
      const participants = asParticipants(data.participants);
      const isCollection = asBoolean(data.isCollection);
      const priority = asString(data.priority);
      const owner = asString(data.owner);
      const sla = asString(data.sla);
      const markers = asStringArray(data.markers);

      if (name) mapped.name = name;
      if (node.parentId) mapped.parentId = node.parentId;
      if (trigger) mapped.trigger = trigger as EventTrigger;
      if (isNonInterrupting !== undefined) mapped.isNonInterrupting = isNonInterrupting;
      if (subProcessVariant) {
        mapped.subProcessVariant = subProcessVariant as SubProcessVariant;
      }
      if (participants) mapped.participants = participants;
      if (isCollection !== undefined) mapped.isCollection = isCollection;
      if (priority) mapped.priority = priority as NonNullable<BpmnNode["priority"]>;
      if (owner) mapped.owner = owner;
      if (sla) mapped.sla = sla;
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
