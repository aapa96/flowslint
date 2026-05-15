import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

export const boundaryNoIncoming: LintRule<BpmnDiagram> = {
  id: "bpmn/boundary-no-incoming",
  description: "Boundary events must not have incoming sequence flows.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const sequenceFlows = edges.filter((e) => e.type === "sequenceFlow");
    const targetsWithIncoming = new Set(sequenceFlows.map((e) => e.target));

    return nodes
      .filter((n) => n.type === "BoundaryEvent" && targetsWithIncoming.has(n.id))
      .map((n) => ({
        ruleId: "bpmn/boundary-no-incoming",
        severity: "error" as const,
        message: `Boundary event "${n.name ?? n.id}" must not have an incoming sequence flow.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
