import type { LintRule } from "../../core/types";
import type { ErdDiagram } from "../types";
import { isEntity, isRelationship } from "../types";

export const entityHasName: LintRule<ErdDiagram> = {
  id: "erd/entity-has-name",
  description: "Entities and Relationships should have a non-empty name.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes
      .filter((n) => isEntity(n) || isRelationship(n))
      .filter((n) => !n.name || n.name.trim() === "")
      .map((n) => ({
        ruleId: "erd/entity-has-name",
        severity: "warning" as const,
        message: `${n.type} "${n.id}" has no name.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
