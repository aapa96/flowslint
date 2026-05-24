import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";
import { TASK_TYPES } from "../types";

// Processes with many flat tasks are harder to understand.
// Recommend breaking into sub-processes when flat task count exceeds 20.
const THRESHOLD = 20;

export const longProcess: LintRule<BpmnDiagram> = {
  id: "bpmn/long-process",
  description: `Process has more than ${THRESHOLD} tasks at the top level. Consider grouping into sub-processes.`,
  defaultSeverity: "info",
  check({ nodes }) {
    const topLevelTasks = nodes.filter(
      (n) => TASK_TYPES.has(n.type) && !n.parentId,
    );
    if (topLevelTasks.length <= THRESHOLD) return [];
    return [
      {
        ruleId: "bpmn/long-process",
        severity: "info" as const,
        message: `El proceso tiene ${topLevelTasks.length} tareas en el nivel principal (límite recomendado: ${THRESHOLD}). Considera agrupar tareas relacionadas en sub-procesos.`,
        elementId: undefined,
      },
    ];
  },
};
