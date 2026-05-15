import type { LintRule } from "../../../core/types";
import type { BpmnDiagram } from "../../types";
import { isTask } from "../../types";

export const taskHasOwner: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/task-has-owner",
  description: "Every task should declare an owner for accountability.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes
      .filter((n) => isTask(n) && !n.owner?.trim())
      .map((n) => ({
        ruleId: "bpmn/aranza/task-has-owner",
        severity: "warning" as const,
        message: `Task "${n.id}" (${n.type}) has no owner assigned.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
