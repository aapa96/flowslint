import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

// Per BPMN 2.0 §13.2.4: the targets of an EventBasedGateway must be either
// IntermediateCatchEvent or ReceiveTask. No tasks, gateways, or other nodes.

const VALID_TARGETS = new Set(["IntermediateCatchEvent", "ReceiveTask"]);

export const eventBasedGatewayValidTargets: LintRule<BpmnDiagram> = {
  id: "bpmn/event-based-gateway-valid-targets",
  description: "An event-based gateway may only connect to intermediate catch events or receive tasks.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const issues = [];

    for (const gateway of nodes.filter((n) => n.type === "EventBasedGateway")) {
      const outgoing = edges.filter((e) => e.type === "sequenceFlow" && e.source === gateway.id);
      for (const edge of outgoing) {
        const target = nodeById.get(edge.target);
        if (!target || !VALID_TARGETS.has(target.type)) {
          issues.push({
            ruleId: "bpmn/event-based-gateway-valid-targets",
            severity: "error" as const,
            message: `Event-based gateway "${gateway.name ?? gateway.id}" connects to "${target?.type ?? "unknown"}" ("${edge.target}"). Only IntermediateCatchEvent and ReceiveTask are valid targets.`,
            elementId: gateway.id,
            elementType: gateway.type,
          });
        }
      }
    }
    return issues;
  },
};
