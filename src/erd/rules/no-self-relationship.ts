import type { LintRule } from "../../core/types";
import type { ErdDiagram } from "../types";
import { isRelationship } from "../types";

export const noSelfRelationship: LintRule<ErdDiagram> = {
  id: "erd/no-self-relationship",
  description: "Relationships should connect at least two distinct entities.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    const issues: ReturnType<LintRule<ErdDiagram>["check"]> = [];

    for (const rel of nodes.filter(isRelationship)) {
      const participatingEntities = edges
        .filter((e) => e.type === "participatesIn" && e.target === rel.id)
        .map((e) => e.source);

      const distinct = new Set(participatingEntities);
      if (distinct.size === 1 && participatingEntities.length > 1) {
        issues.push({
          ruleId: "erd/no-self-relationship",
          severity: "warning" as const,
          message: `Relationship "${rel.name ?? rel.id}" connects the same entity to itself on all sides.`,
          elementId: rel.id,
          elementType: rel.type,
          relatedElementIds: [...distinct],
        });
      }
    }

    return issues;
  },
};
