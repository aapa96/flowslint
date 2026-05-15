import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

export const boundaryHasOutgoing: LintRule<BpmnDiagram> = {
  id: "bpmn/boundary-has-outgoing",
  description: "Boundary events should have at least one outgoing sequence flow to model the exception path.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    const sequenceFlows = edges.filter((e) => e.type === "sequenceFlow");
    const sourcesWithOutgoing = new Set(sequenceFlows.map((e) => e.source));

    return nodes
      .filter((n) => n.type === "BoundaryEvent" && !sourcesWithOutgoing.has(n.id))
      .map((n) => ({
        ruleId: "bpmn/boundary-has-outgoing",
        severity: "warning" as const,
        message: `Boundary event "${n.name ?? n.id}" has no outgoing sequence flow; model at least one exception path.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
