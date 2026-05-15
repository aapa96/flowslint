import type { LintRule } from "../../../core/types";
import type { BpmnDiagram } from "../../types";

// ISO 8601 duration: P[nY][nM][nD][T[nH][nM][nS]]
// At least one designator must be present after P or T.
const ISO_8601_DURATION = /^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/;

function isValidDuration(value: string): boolean {
  if (!ISO_8601_DURATION.test(value)) return false;
  // "P" alone is not valid — must have at least one component
  return value !== "P" && value !== "PT";
}

export const slaFormat: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/sla-format",
  description: "The SLA field must be a valid ISO 8601 duration (e.g. PT4H, P1DT2H).",
  defaultSeverity: "error",
  check({ nodes }) {
    return nodes
      .filter((n) => n.sla != null && n.sla.trim() !== "" && !isValidDuration(n.sla.trim()))
      .map((n) => ({
        ruleId: "bpmn/aranza/sla-format",
        severity: "error" as const,
        message: `Task "${n.id}" has an invalid SLA value "${n.sla}". Expected ISO 8601 duration (e.g. PT4H, P1DT2H).`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
