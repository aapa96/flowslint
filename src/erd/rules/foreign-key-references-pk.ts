import type { LintRule } from "../../core/types";
import type { ErdDiagram } from "../types";
import { isEntity } from "../types";

export const foreignKeyReferencesPk: LintRule<ErdDiagram> = {
  id: "erd/foreign-key-references-pk",
  description: "Foreign key attributes must match a primary key name on another entity.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const issues: ReturnType<LintRule<ErdDiagram>["check"]> = [];

    const entities = nodes.filter(isEntity);

    // Collect all PK names across all entities
    const pkNames = new Set<string>();
    for (const entity of entities) {
      for (const attr of entity.attributes ?? []) {
        if (attr.isPrimaryKey && attr.name) pkNames.add(attr.name.toLowerCase());
      }
    }

    // Check FK attributes on every entity
    for (const entity of entities) {
      for (const attr of entity.attributes ?? []) {
        if (!attr.isForeignKey) continue;
        if (!attr.name || !pkNames.has(attr.name.toLowerCase())) {
          issues.push({
            ruleId: "erd/foreign-key-references-pk",
            severity: "warning" as const,
            message: `Foreign key "${attr.name}" on entity "${entity.name ?? entity.id}" does not match any primary key name.`,
            elementId: entity.id,
            elementType: entity.type,
          });
        }
      }
    }

    return issues;
  },
};
