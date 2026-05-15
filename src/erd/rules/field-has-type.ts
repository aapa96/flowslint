import type { LintRule } from "../../core/types";
import type { ErdDiagram } from "../types";
import { isAttribute, isEntity } from "../types";

export const fieldHasType: LintRule<ErdDiagram> = {
  id: "erd/field-has-type",
  description: "Every attribute should declare a data type.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const issues: ReturnType<LintRule<ErdDiagram>["check"]> = [];

    // Attribute nodes (ERD diagram notation)
    for (const node of nodes.filter(isAttribute)) {
      if (!node.dataType?.trim()) {
        issues.push({
          ruleId: "erd/field-has-type",
          severity: "warning" as const,
          message: `Attribute "${node.name ?? node.id}" has no data type.`,
          elementId: node.id,
          elementType: node.type,
        });
      }
    }

    // Inline attributes (Crow's Foot / IE notation)
    for (const entity of nodes.filter(isEntity)) {
      for (const attr of entity.attributes ?? []) {
        if (!attr.dataType?.trim()) {
          issues.push({
            ruleId: "erd/field-has-type",
            severity: "warning" as const,
            message: `Attribute "${attr.name}" on entity "${entity.name ?? entity.id}" has no data type.`,
            elementId: entity.id,
            elementType: entity.type,
          });
        }
      }
    }

    return issues;
  },
};
