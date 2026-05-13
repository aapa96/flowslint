import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";
import { isFlowNode } from "../types";

export const sequenceFlowValidEndpoints: LintRule<BpmnDiagram> = {
  id: "bpmn/sequence-flow-valid-endpoints",
  description: "Sequence flows must connect BPMN flow nodes.",
  defaultSeverity: "error",
  category: "modeling",
  check({ nodes, edges }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    return edges.flatMap((edge) => {
      if (edge.type !== "sequenceFlow") return [];
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) return [];

      if (!isFlowNode(source) || !isFlowNode(target)) {
        return [{
          ruleId: "bpmn/sequence-flow-valid-endpoints",
          severity: "error" as const,
          message: `Sequence flow "${edge.name ?? edge.id}" must connect BPMN flow nodes.`,
          elementId: edge.id,
          elementType: edge.type,
          relatedElementIds: [edge.source, edge.target],
          quickFixes: [{
            id: "convert-to-association-or-message-flow",
            label: "Use a BPMN-compatible edge type",
          }],
        }];
      }

      return [];
    });
  },
};

