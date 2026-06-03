import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

export const dataAssociationDirection: LintRule<BpmnDiagram> = {
  id: "bpmn/data-association-direction",
  description: "DataInput should feed a flow node, and DataOutput should be produced by one.",
  defaultSeverity: "warning",
  category: "modeling",
  check({ nodes, edges }) {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));

    return edges.flatMap((edge) => {
      if (edge.type !== "dataAssociation") return [];

      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) return [];

      if (source.type === "DataOutput") {
        return [{
          ruleId: "bpmn/data-association-direction",
          severity: "warning" as const,
          message: `DataOutput "${source.name ?? source.id}" should usually be the target of a dataAssociation, not the source.`,
          elementId: edge.id,
          elementType: edge.type,
          relatedElementIds: [source.id, target.id],
        }];
      }

      if (target.type === "DataInput") {
        return [{
          ruleId: "bpmn/data-association-direction",
          severity: "warning" as const,
          message: `DataInput "${target.name ?? target.id}" should usually be the source of a dataAssociation, not the target.`,
          elementId: edge.id,
          elementType: edge.type,
          relatedElementIds: [source.id, target.id],
        }];
      }

      return [];
    });
  },
};
