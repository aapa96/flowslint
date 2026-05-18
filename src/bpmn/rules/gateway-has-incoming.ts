import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";
import { isJoiningGateway } from "../types";

export const gatewayHasIncoming: LintRule<BpmnDiagram> = {
  id: "bpmn/gateway-has-incoming",
  description: "Joining gateways must have at least 2 incoming sequence flows.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    return nodes
      .filter(isJoiningGateway)
      .filter((n) => {
        const outgoing = edges.filter((e) => e.type === "sequenceFlow" && e.source === n.id);
        if (outgoing.length >= 2) return false; // split gateway — incoming count irrelevant
        const incoming = edges.filter((e) => e.type === "sequenceFlow" && e.target === n.id);
        return incoming.length < 2;
      })
      .map((n) => ({
        ruleId: "bpmn/gateway-has-incoming",
        severity: "error" as const,
        message: `Gateway "${n.name ?? n.id}" (${n.type}) must have at least 2 incoming sequence flows.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
