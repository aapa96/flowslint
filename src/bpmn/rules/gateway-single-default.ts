import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

const CONDITION_GATEWAYS = new Set([
  "ExclusiveGateway",
  "InclusiveGateway",
  "ComplexGateway",
]);

export const gatewaySingleDefault: LintRule<BpmnDiagram> = {
  id: "bpmn/gateway-single-default",
  description: "A gateway may have at most one default outgoing sequence flow.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const issues = [];
    const sequenceFlows = edges.filter((e) => e.type === "sequenceFlow");

    for (const node of nodes.filter((n) => CONDITION_GATEWAYS.has(n.type))) {
      const outgoing = sequenceFlows.filter((e) => e.source === node.id);
      const defaultEdges = outgoing.filter((e) => e.isDefault);
      if (defaultEdges.length > 1) {
        issues.push({
          ruleId: "bpmn/gateway-single-default",
          severity: "error" as const,
          message: `Gateway "${node.name ?? node.id}" has ${defaultEdges.length} default outgoing flows; only one is allowed.`,
          elementId: node.id,
          elementType: node.type,
        });
      }
    }
    return issues;
  },
};
