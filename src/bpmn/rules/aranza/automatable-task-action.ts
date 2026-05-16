import type { LintRule } from "../../../core/types";
import type { BpmnDiagram } from "../../types";

const AUTOMATABLE_TASK_TYPES = new Set([
  "Task",
  "ServiceTask",
  "ScriptTask",
  "BusinessRuleTask",
  "SendTask",
  "ReceiveTask",
]);

export const automatableTaskAction: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/automatable-task-action",
  description: "Automatable tasks must define both connector and action.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes
      .filter((n) => AUTOMATABLE_TASK_TYPES.has(n.type))
      .filter((n) => !n.connector || !n.action)
      .map((n) => ({
        ruleId: "bpmn/aranza/automatable-task-action",
        severity: "warning" as const,
        message: `Automatable task "${n.name ?? n.id}" must define connector and action.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
