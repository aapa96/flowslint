import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

// Only decision gateways (XOR / OR) need a name — they represent a question.
// ParallelGateway, EventBasedGateway and ComplexGateway are structural and
// don't require a human-readable label.

const DECISION_GATEWAYS = new Set(["ExclusiveGateway", "InclusiveGateway"]);

export const gatewayHasName: LintRule<BpmnDiagram> = {
  id: "bpmn/gateway-has-name",
  description: "Exclusive and inclusive gateways should be named with the decision question they represent.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes
      .filter((n) => DECISION_GATEWAYS.has(n.type) && !n.name?.trim())
      .map((n) => ({
        ruleId: "bpmn/gateway-has-name",
        severity: "warning" as const,
        message: `El gateway "${n.id}" no tiene nombre. Asígnale un nombre que describa la condición que evalúa (ej: "¿Aprobado?").`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
