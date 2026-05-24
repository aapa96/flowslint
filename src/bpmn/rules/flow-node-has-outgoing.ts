import type { LintRule } from "../../core/types";
import type { BpmnDiagram, BpmnNode } from "../types";
import { isSubProcessLike, isTask } from "../types";

const EXEMPT: Set<BpmnNode["type"]> = new Set([
  "EndEvent",
  "BoundaryEvent",
  "EventSubProcess",
]);

function shouldHaveOutgoing(node: BpmnNode): boolean {
  return (
    node.type === "StartEvent" ||
    isTask(node) ||
    isSubProcessLike(node) ||
    node.type === "ChoreographyTask" ||
    node.type === "SubChoreography" ||
    node.type === "CallChoreography"
  ) && !EXEMPT.has(node.type);
}

export const flowNodeHasOutgoing: LintRule<BpmnDiagram> = {
  id: "bpmn/flow-node-has-outgoing",
  description: "Flow nodes should have an outgoing sequence flow unless BPMN defines them as terminal points.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const outgoing = new Set<string>();
    for (const edge of edges) {
      if (edge.type === "sequenceFlow") outgoing.add(edge.source);
    }

    return nodes
      .filter((node) => shouldHaveOutgoing(node) && !outgoing.has(node.id))
      .map((node) => ({
        ruleId: "bpmn/flow-node-has-outgoing",
        severity: "error" as const,
        message: `El elemento "${node.name ?? node.id}" no tiene conexión de salida. Conéctalo hacia el siguiente nodo del flujo.`,
        elementId: node.id,
        elementType: node.type,
      }));
  },
};
