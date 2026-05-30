import type { LintRule } from "../../../core/types";
import type { BpmnDiagram } from "../../types";

export const callActivityHasCalledElement: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/call-activity-has-called-element",
  description: "CallActivity must reference the id of the process or global task it invokes.",
  defaultSeverity: "error",
  check({ nodes }) {
    return nodes
      .filter((n) => n.type === "CallActivity")
      .filter((n) => !n.calledElement?.trim())
      .map((n) => ({
        ruleId: "bpmn/aranza/call-activity-has-called-element",
        severity: "error" as const,
        message: `La actividad de llamada "${n.name ?? n.id}" no tiene un proceso referenciado. Define el campo calledElement en las propiedades.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
