import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";
import { isFlowNode } from "../types";

function reachableFromStarts(diagram: BpmnDiagram): Set<string> {
  const outgoing = new Map<string, string[]>();
  for (const edge of diagram.edges) {
    if (edge.type !== "sequenceFlow") continue;
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }

  const starts = diagram.nodes.filter((node) => node.type === "StartEvent").map((node) => node.id);
  const reachable = new Set<string>();
  const queue = [...starts];

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || reachable.has(id)) continue;
    reachable.add(id);
    for (const target of outgoing.get(id) ?? []) queue.push(target);
  }

  return reachable;
}

export const reachableFromStart: LintRule<BpmnDiagram> = {
  id: "bpmn/reachable-from-start",
  description: "Every flow node should be reachable from at least one start event.",
  defaultSeverity: "warning",
  check(diagram) {
    const hasStart = diagram.nodes.some((node) => node.type === "StartEvent");
    if (!hasStart) return [];

    const reachable = reachableFromStarts(diagram);
    return diagram.nodes
      .filter((node) => isFlowNode(node) && node.type !== "BoundaryEvent" && !reachable.has(node.id))
      .map((node) => ({
        ruleId: "bpmn/reachable-from-start",
        severity: "warning" as const,
        message: `El elemento "${node.name ?? node.id}" no es alcanzable desde el inicio del proceso. Verifica que esté conectado al flujo principal.`,
        elementId: node.id,
        elementType: node.type,
      }));
  },
};

export const endEventReachable: LintRule<BpmnDiagram> = {
  id: "bpmn/end-event-reachable",
  description: "At least one end event should be reachable from a start event.",
  defaultSeverity: "error",
  check(diagram) {
    const hasStart = diagram.nodes.some((node) => node.type === "StartEvent");
    const endEvents = diagram.nodes.filter((node) => node.type === "EndEvent");
    if (!hasStart || endEvents.length === 0) return [];

    const reachable = reachableFromStarts(diagram);
    if (endEvents.some((node) => reachable.has(node.id))) return [];

    return [{
      ruleId: "bpmn/end-event-reachable",
      severity: "error" as const,
      message: "Ningún evento de fin es alcanzable desde el inicio. Revisa que el flujo llegue a un EndEvent.",
    }];
  },
};
