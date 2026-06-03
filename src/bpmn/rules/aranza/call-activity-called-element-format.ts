import type { LintRule } from "../../../core/types";
import type { BpmnDiagram } from "../../types";

export const callActivityCalledElementFormat: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/call-activity-called-element-format",
  description: "CallActivity should use a stable, publishable calledElement identifier without spaces.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes
      .filter((n) => n.type === "CallActivity")
      .filter((n) => {
        const calledElement = n.calledElement?.trim();
        return Boolean(calledElement) && /\s/.test(calledElement);
      })
      .map((n) => ({
        ruleId: "bpmn/aranza/call-activity-called-element-format",
        severity: "warning" as const,
        message: `La actividad de llamada "${n.name ?? n.id}" usa un calledElement con espacios. Usa un identificador publicable y estable, por ejemplo "Process_OrderFulfillment".`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
