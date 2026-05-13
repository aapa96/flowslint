import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";
import { isTask } from "../types";

export const taskHasName: LintRule<BpmnDiagram> = {
  id: "bpmn/task-has-name",
  description: "Every task should have a non-empty name.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes
      .filter((n) => isTask(n) && !n.name?.trim())
      .map((n) => ({
        ruleId: "bpmn/task-has-name",
        severity: "warning" as const,
        message: `Task "${n.id}" (${n.type}) has no name.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
