import type { LintRule } from "../../core/types";
import type { ErdDiagram } from "../types";
import { isEntity } from "../types";

export const entityConnected: LintRule<ErdDiagram> = {
  id: "erd/entity-connected",
  description: "Every Entity should participate in at least one Relationship.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    const entities = nodes.filter(isEntity);

    return entities.flatMap((entity) => {
      const participates = edges.some(
        (e) => e.type === "participatesIn" && e.source === entity.id,
      );
      if (participates) return [];

      return [
        {
          ruleId: "erd/entity-connected",
          severity: "warning" as const,
          message: `Entity "${entity.name ?? entity.id}" does not participate in any relationship.`,
          elementId: entity.id,
          elementType: entity.type,
        },
      ];
    });
  },
};
