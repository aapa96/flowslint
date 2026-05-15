import type { LintRule } from "../../core/types";
import type { ErdDiagram } from "../types";

export const relationshipHasCardinality: LintRule<ErdDiagram> = {
  id: "erd/relationship-has-cardinality",
  description: "Each participation edge should declare a cardinality (1, N, or M).",
  defaultSeverity: "warning",
  check({ edges }) {
    return edges
      .filter(
        (e) =>
          e.type === "participatesIn" &&
          (!e.sourceCardinality || !e.targetCardinality),
      )
      .map((e) => ({
        ruleId: "erd/relationship-has-cardinality",
        severity: "warning" as const,
        message: `Participation edge "${e.id}" is missing cardinality (source: ${e.sourceCardinality ?? "?"}, target: ${e.targetCardinality ?? "?"}).`,
        elementId: e.id,
        elementType: e.type,
        relatedElementIds: [e.source, e.target],
      }));
  },
};
