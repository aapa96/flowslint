import type { LintRule } from "../../../core/types";
import type { BpmnDiagram } from "../../types";

export const businessRuleTaskHasDecision: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/business-rule-task-has-decision",
  description: "BusinessRuleTask must reference a DMN decision table via decisionRef.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes
      .filter((n) => n.type === "BusinessRuleTask")
      .filter((n) => !n.decisionRef?.trim())
      .map((n) => ({
        ruleId: "bpmn/aranza/business-rule-task-has-decision",
        severity: "warning" as const,
        message: `La tarea de regla de negocio "${n.name ?? n.id}" no referencia una tabla de decisión DMN. Define el campo decisionRef en las propiedades.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
