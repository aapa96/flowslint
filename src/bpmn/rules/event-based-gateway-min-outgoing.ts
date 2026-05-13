import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

// EventBasedGateway always splits — it must have at least 2 outgoing paths.
// (The gateway-has-outgoing rule only covers XOR/OR/AND/Complex gateways.)

export const eventBasedGatewayMinOutgoing: LintRule<BpmnDiagram> = {
  id: "bpmn/event-based-gateway-min-outgoing",
  description: "An event-based gateway must have at least 2 outgoing sequence flows.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    return nodes
      .filter((n) => n.type === "EventBasedGateway")
      .filter((n) => edges.filter((e) => e.type === "sequenceFlow" && e.source === n.id).length < 2)
      .map((n) => ({
        ruleId: "bpmn/event-based-gateway-min-outgoing",
        severity: "error" as const,
        message: `Event-based gateway "${n.name ?? n.id}" must have at least 2 outgoing sequence flows.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
