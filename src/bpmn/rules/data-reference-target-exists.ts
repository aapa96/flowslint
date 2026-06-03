import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

export const dataReferenceTargetExists: LintRule<BpmnDiagram> = {
  id: "bpmn/data-reference-target-exists",
  description: "DataObjectReference and DataStoreReference should point to an existing backing data element when an explicit ref is provided.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const nodeIds = new Set(nodes.map((node) => node.id));

    return nodes.flatMap((node) => {
      if (node.type === "DataObjectReference" && node.dataObjectRef && !nodeIds.has(node.dataObjectRef)) {
        return [{
          ruleId: "bpmn/data-reference-target-exists",
          severity: "warning" as const,
          message: `La referencia de datos "${node.name ?? node.id}" apunta a dataObjectRef="${node.dataObjectRef}" pero ese DataObject no existe en el diagrama.`,
          elementId: node.id,
          elementType: node.type,
        }];
      }
      if (node.type === "DataStoreReference" && node.dataStoreRef && !nodeIds.has(node.dataStoreRef)) {
        return [{
          ruleId: "bpmn/data-reference-target-exists",
          severity: "warning" as const,
          message: `La referencia de almacén "${node.name ?? node.id}" apunta a dataStoreRef="${node.dataStoreRef}" pero ese DataStore no existe en el diagrama.`,
          elementId: node.id,
          elementType: node.type,
        }];
      }
      return [];
    });
  },
};
