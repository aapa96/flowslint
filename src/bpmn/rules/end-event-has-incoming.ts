import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

export const endEventHasIncoming: LintRule<BpmnDiagram> = {
  id: "bpmn/end-event-has-incoming",
  description: "Every end event must have at least one incoming sequence flow.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const targets = new Set(edges.filter((e) => e.type === "sequenceFlow").map((e) => e.target));
    return nodes
      .filter((n) => n.type === "EndEvent" && !targets.has(n.id))
      .map((n) => ({
        ruleId: "bpmn/end-event-has-incoming",
        severity: "error" as const,
        message: `End event "${n.name ?? n.id}" has no incoming sequence flow.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
