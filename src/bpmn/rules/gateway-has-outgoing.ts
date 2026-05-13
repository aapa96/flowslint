import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";
import { isSplittingGateway } from "../types";

export const gatewayHasOutgoing: LintRule<BpmnDiagram> = {
  id: "bpmn/gateway-has-outgoing",
  description: "Splitting gateways must have at least 2 outgoing sequence flows.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    return nodes
      .filter(isSplittingGateway)
      .filter((n) => {
        const outgoing = edges.filter((e) => e.type === "sequenceFlow" && e.source === n.id);
        return outgoing.length < 2;
      })
      .map((n) => ({
        ruleId: "bpmn/gateway-has-outgoing",
        severity: "error" as const,
        message: `Gateway "${n.name ?? n.id}" (${n.type}) must have at least 2 outgoing sequence flows.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
