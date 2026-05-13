import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

export const annotationHasText: LintRule<BpmnDiagram> = {
  id: "bpmn/annotation-has-text",
  description: "Text annotations should contain text.",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes
      .filter((n) => n.type === "Annotation" && !n.name?.trim())
      .map((n) => ({
        ruleId: "bpmn/annotation-has-text",
        severity: "info" as const,
        message: `Text annotation "${n.id}" is empty.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
