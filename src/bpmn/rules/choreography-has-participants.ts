import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

// Per BPMN 2.0 §11.4.1: a choreography activity requires at least 2 participant bands.

const CHOREOGRAPHY_TYPES = new Set(["ChoreographyTask", "SubChoreography", "CallChoreography"]);

export const choreographyHasParticipants: LintRule<BpmnDiagram> = {
  id: "bpmn/choreography-has-participants",
  description: "Choreography activities must have at least 2 participant bands.",
  defaultSeverity: "error",
  check({ nodes }) {
    return nodes
      .filter((n) => CHOREOGRAPHY_TYPES.has(n.type))
      .filter((n) => !n.participants || n.participants.length < 2)
      .map((n) => ({
        ruleId: "bpmn/choreography-has-participants",
        severity: "error" as const,
        message: `Choreography activity "${n.name ?? n.id}" (${n.type}) must have at least 2 participant bands.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
