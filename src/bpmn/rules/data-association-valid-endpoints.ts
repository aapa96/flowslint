import type { LintRule } from "../../core/types";
import type { BpmnDiagram, BpmnNodeType } from "../types";
import { isFlowNode } from "../types";

const DATA_TYPES = new Set<BpmnNodeType>([
  "DataObject",
  "DataObjectReference",
  "DataInput",
  "DataOutput",
  "DataStore",
  "DataStoreReference",
]);

export const dataAssociationValidEndpoints: LintRule<BpmnDiagram> = {
  id: "bpmn/data-association-valid-endpoints",
  description: "Data associations must connect data elements to BPMN flow nodes.",
  defaultSeverity: "error",
  category: "modeling",
  check({ nodes, edges }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    return edges.flatMap((edge) => {
      if (edge.type !== "dataAssociation") return [];
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) return [];

      const sourceIsData = DATA_TYPES.has(source.type);
      const targetIsData = DATA_TYPES.has(target.type);
      const sourceIsFlow = isFlowNode(source);
      const targetIsFlow = isFlowNode(target);
      const valid = (sourceIsData && targetIsFlow) || (sourceIsFlow && targetIsData);

      if (valid) return [];

      return [{
        ruleId: "bpmn/data-association-valid-endpoints",
        severity: "error" as const,
        message: `Data association "${edge.name ?? edge.id}" must connect one data element and one BPMN flow node.`,
        elementId: edge.id,
        elementType: edge.type,
        relatedElementIds: [edge.source, edge.target],
        quickFixes: [{
          id: "connect-data-to-flow-node",
          label: "Reconnect data association",
        }],
      }];
    });
  },
};

