import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

export const noOutgoingFromEndEvent: LintRule<BpmnDiagram> = {
  id: "bpmn/no-outgoing-from-end-event",
  description: "End events cannot have outgoing sequence flows.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    return nodes
      .filter((n) => n.type === "EndEvent")
      .filter((n) => edges.some((e) => e.type === "sequenceFlow" && e.source === n.id))
      .map((n) => ({
        ruleId: "bpmn/no-outgoing-from-end-event",
        severity: "error" as const,
        message: `End event "${n.name ?? n.id}" has an outgoing sequence flow, which is not allowed.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
