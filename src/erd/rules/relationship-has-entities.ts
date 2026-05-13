import type { LintRule } from "../../core/types";
import type { ErdDiagram } from "../types";
import { isRelationship } from "../types";

export const relationshipHasEntities: LintRule<ErdDiagram> = {
  id: "erd/relationship-has-entities",
  description: "Every Relationship must have at least two entities connected via participatesIn edges.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const relationships = nodes.filter(isRelationship);

    return relationships.flatMap((rel) => {
      const participantCount = edges.filter(
        (e) => e.type === "participatesIn" && e.target === rel.id,
      ).length;

      if (participantCount >= 2) return [];

      return [
        {
          ruleId: "erd/relationship-has-entities",
          severity: "error" as const,
          message: `Relationship "${rel.name ?? rel.id}" has fewer than 2 participating entities (found ${participantCount}).`,
          elementId: rel.id,
          elementType: rel.type,
        },
      ];
    });
  },
};
