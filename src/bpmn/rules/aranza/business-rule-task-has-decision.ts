import type { LintRule } from "../../../core/types";
import type { BpmnDiagram } from "../../types";

function hasInlineDecisionTable(table: BpmnDiagram["nodes"][number]["inlineDecisionTable"]): boolean {
  if (!table) return false;
  return table.inputs.length > 0 && table.outputs.length > 0 && table.rules.length > 0;
}

export const businessRuleTaskHasDecision: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/business-rule-task-has-decision",
  description: "BusinessRuleTask must reference a DMN decision table or define a minimally valid inline decision table.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes
      .filter((n) => n.type === "BusinessRuleTask")
      .filter((n) => !n.decisionRef?.trim() && !hasInlineDecisionTable(n.inlineDecisionTable))
      .map((n) => ({
        ruleId: "bpmn/aranza/business-rule-task-has-decision",
        severity: "warning" as const,
        message: `La tarea de regla de negocio "${n.name ?? n.id}" no tiene una decisión utilizable. Define decisionRef o completa una tabla inline con inputs, outputs y al menos una regla.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
