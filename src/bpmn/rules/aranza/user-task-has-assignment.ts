import type { LintRule } from "../../../core/types";
import type { BpmnDiagram } from "../../types";

function hasValue(value?: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export const userTaskHasAssignment: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/user-task-has-assignment",
  description: "UserTask should define at least one assignment strategy so someone can act on it.",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes
      .filter((n) => n.type === "UserTask")
      .filter((n) => !hasValue(n.owner) && !hasValue(n.candidateUsers) && !hasValue(n.candidateGroups))
      .map((n) => ({
        ruleId: "bpmn/aranza/user-task-has-assignment",
        severity: "info" as const,
        message: `La tarea de usuario "${n.name ?? n.id}" no tiene estrategia de asignaci\u00f3n. Define owner, candidateUsers o candidateGroups para que alguien pueda atenderla.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
