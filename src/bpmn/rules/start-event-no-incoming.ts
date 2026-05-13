import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

export const startEventNoIncoming: LintRule<BpmnDiagram> = {
  id: "bpmn/start-event-no-incoming",
  description: "Start events must not have incoming sequence flows.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const targets = new Set(edges.filter((e) => e.type === "sequenceFlow").map((e) => e.target));
    return nodes
      .filter((n) => n.type === "StartEvent" && targets.has(n.id))
      .map((n) => ({
        ruleId: "bpmn/start-event-no-incoming",
        severity: "error" as const,
        message: `Start event "${n.name ?? n.id}" has an incoming sequence flow.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
