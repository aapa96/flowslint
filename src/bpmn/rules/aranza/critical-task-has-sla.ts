import type { LintRule } from "../../../core/types";
import type { BpmnDiagram } from "../../types";
import { isTask } from "../../types";

export const criticalTaskHasSla: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/critical-task-has-sla",
  description: "Tasks with priority 'critical' must have an SLA defined.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes
      .filter((n) => isTask(n) && n.priority === "critical" && !n.sla?.trim())
      .map((n) => ({
        ruleId: "bpmn/aranza/critical-task-has-sla",
        severity: "warning" as const,
        message: `Task "${n.id}" (${n.type}) is critical but has no SLA defined.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
