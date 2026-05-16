import type { LintRule } from "../../../core/types";
import type { BpmnDiagram } from "../../types";

export const userTaskHasForm: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/user-task-has-form",
  description: "UserTask elements should define a formKey to link a form for data capture.",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes
      .filter((n) => n.type === "UserTask")
      .filter((n) => !n.formKey)
      .map((n) => ({
        ruleId: "bpmn/aranza/user-task-has-form",
        severity: "info" as const,
        message: `UserTask "${n.name ?? n.id}" has no formKey — operators will complete it without a guided form.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
