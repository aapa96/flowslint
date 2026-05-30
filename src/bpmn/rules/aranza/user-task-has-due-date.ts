import type { LintRule } from "../../../core/types";
import type { BpmnDiagram } from "../../types";

export const userTaskHasDueDate: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/user-task-has-due-date",
  description: "UserTask elements should define a dueDate to ensure timely completion.",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes
      .filter((n) => n.type === "UserTask")
      .filter((n) => !n.dueDate?.trim())
      .map((n) => ({
        ruleId: "bpmn/aranza/user-task-has-due-date",
        severity: "info" as const,
        message: `La tarea de usuario "${n.name ?? n.id}" no tiene fecha límite. Sin una fecha de vencimiento, la tarea puede quedar sin atender indefinidamente.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
