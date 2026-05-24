import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

// Cyclomatic complexity = number of decision points + 1.
// Decision points: ExclusiveGateway, InclusiveGateway, ComplexGateway, EventBasedGateway.
// Threshold of 10 is a widely-used warning level for process complexity.
const DECISION_GATEWAYS = new Set([
  "ExclusiveGateway",
  "InclusiveGateway",
  "ComplexGateway",
  "EventBasedGateway",
]);

const THRESHOLD = 10;

export const cyclomaticComplexity: LintRule<BpmnDiagram> = {
  id: "bpmn/cyclomatic-complexity",
  description: `Process has more than ${THRESHOLD} decision gateways. Consider splitting into sub-processes.`,
  defaultSeverity: "info",
  check({ nodes }) {
    const topLevelDecisions = nodes.filter(
      (n) => DECISION_GATEWAYS.has(n.type) && !n.parentId,
    );
    if (topLevelDecisions.length <= THRESHOLD) return [];
    return [
      {
        ruleId: "bpmn/cyclomatic-complexity",
        severity: "info" as const,
        message: `El proceso tiene ${topLevelDecisions.length} gateways de decisión (límite recomendado: ${THRESHOLD}). Considera dividirlo en sub-procesos para facilitar su mantenimiento.`,
        elementId: undefined,
      },
    ];
  },
};
