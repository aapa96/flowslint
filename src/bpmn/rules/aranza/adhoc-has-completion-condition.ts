import type { LintRule } from "../../../core/types";
import type { BpmnDiagram } from "../../types";

export const adhocHasCompletionCondition: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/adhoc-has-completion-condition",
  description: "AdHocSubProcess elements should define a completion condition.",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes
      .filter((n) => n.type === "AdHocSubProcess")
      .filter((n) => !n.completionCondition)
      .map((n) => ({
        ruleId: "bpmn/aranza/adhoc-has-completion-condition",
        severity: "info" as const,
        message: `AdHocSubProcess "${n.name ?? n.id}" has no completion condition — it will require manual completion.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
