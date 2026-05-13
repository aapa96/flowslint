import type { LintRule } from "../../core/types";
import type { ErdDiagram } from "../types";
import { isEntity } from "../types";

export const entityHasPrimaryKey: LintRule<ErdDiagram> = {
  id: "erd/entity-has-primary-key",
  description: "Every Entity and WeakEntity must have at least one primary key attribute.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const entities = nodes.filter(isEntity);

    return entities.flatMap((entity) => {
      // Check inline attributes
      const inlinePk = entity.attributes?.some((a) => a.isPrimaryKey) ?? false;
      if (inlinePk) return [];

      // Check for a PrimaryKey node connected via hasAttribute edge (as target)
      const hasPkNode = edges.some(
        (e) =>
          e.type === "hasAttribute" &&
          e.source === entity.id &&
          nodes.find((n) => n.id === e.target)?.type === "PrimaryKey",
      );
      if (hasPkNode) return [];

      return [
        {
          ruleId: "erd/entity-has-primary-key",
          severity: "error" as const,
          message: `Entity "${entity.name ?? entity.id}" has no primary key.`,
          elementId: entity.id,
          elementType: entity.type,
        },
      ];
    });
  },
};
