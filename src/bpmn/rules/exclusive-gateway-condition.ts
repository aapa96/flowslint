import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

// Per BPMN 2.0 §13.2.2 / §13.3.6: every non-default outgoing sequence flow of an
// ExclusiveGateway, InclusiveGateway, or ComplexGateway must carry a conditionExpression.
// The default flow (isDefault === true) is exempt.

const CONDITIONAL_GATEWAYS = new Set(["ExclusiveGateway", "InclusiveGateway", "ComplexGateway"]);

export const exclusiveGatewayCondition: LintRule<BpmnDiagram> = {
  id: "bpmn/exclusive-gateway-condition",
  description: "Non-default outgoing flows of ExclusiveGateway, InclusiveGateway, and ComplexGateway must have a condition expression.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    const issues = [];
    const conditionalGateways = nodes.filter((n) => CONDITIONAL_GATEWAYS.has(n.type));

    for (const gw of conditionalGateways) {
      const outgoing = edges.filter((e) => e.type === "sequenceFlow" && e.source === gw.id);
      // If all flows lack conditions we can't tell which is "default" — skip check
      if (outgoing.length < 2) continue;

      for (const edge of outgoing) {
        if (!edge.isDefault && !edge.conditionExpression) {
          issues.push({
            ruleId: "bpmn/exclusive-gateway-condition",
            severity: "warning" as const,
            message: `Outgoing flow "${edge.name ?? edge.id}" from ${gw.type} "${gw.name ?? gw.id}" has no condition expression and is not marked as default.`,
            elementId: edge.id,
          });
        }
      }
    }
    return issues;
  },
};
