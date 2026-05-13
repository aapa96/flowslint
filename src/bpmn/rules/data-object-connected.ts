import type { LintRule } from "../../core/types";
import type { BpmnDiagram, BpmnNodeType } from "../types";

const DATA_TYPES = new Set<BpmnNodeType>([
  "DataObject", "DataObjectReference", "DataInput", "DataOutput",
]);

export const dataObjectConnected: LintRule<BpmnDiagram> = {
  id: "bpmn/data-object-connected",
  description: "DataObject, DataObjectReference, DataInput and DataOutput should be connected via a dataAssociation edge.",
  defaultSeverity: "info",
  check({ nodes, edges }) {
    const dataNodes = nodes.filter((n) => DATA_TYPES.has(n.type));

    return dataNodes.flatMap((n) => {
      const connected = edges.some(
        (e) => e.type === "dataAssociation" && (e.source === n.id || e.target === n.id),
      );
      if (connected) return [];

      return [
        {
          ruleId: "bpmn/data-object-connected",
          severity: "info" as const,
          message: `${n.type} "${n.name ?? n.id}" is not connected to any flow via a dataAssociation.`,
          elementId: n.id,
          elementType: n.type,
        },
      ];
    });
  },
};
