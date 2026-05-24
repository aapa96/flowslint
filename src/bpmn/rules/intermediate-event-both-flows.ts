import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

// Non-boundary intermediate events must have both an incoming and an outgoing
// sequence flow. Boundary events are excluded — they only have outgoing flows.

export const intermediateEventBothFlows: LintRule<BpmnDiagram> = {
  id: "bpmn/intermediate-event-both-flows",
  description: "Intermediate (non-boundary) events must have both an incoming and an outgoing sequence flow.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const issues = [];
    const intermediates = nodes.filter(
      (n) => n.type === "IntermediateCatchEvent" || n.type === "IntermediateThrowEvent",
    );
    for (const n of intermediates) {
      const incoming = edges.filter((e) => e.type === "sequenceFlow" && e.target === n.id);
      const outgoing = edges.filter((e) => e.type === "sequenceFlow" && e.source === n.id);
      if (incoming.length === 0) {
        issues.push({
          ruleId: "bpmn/intermediate-event-both-flows",
          severity: "error" as const,
          message: `El evento intermedio "${n.name ?? n.id}" no tiene conexión de entrada. Los eventos intermedios deben conectarse por ambos lados del flujo.`,
          elementId: n.id,
          elementType: n.type,
        });
      }
      if (outgoing.length === 0) {
        issues.push({
          ruleId: "bpmn/intermediate-event-both-flows",
          severity: "error" as const,
          message: `El evento intermedio "${n.name ?? n.id}" no tiene conexión de salida. Los eventos intermedios deben conectarse por ambos lados del flujo.`,
          elementId: n.id,
          elementType: n.type,
        });
      }
    }
    return issues;
  },
};
