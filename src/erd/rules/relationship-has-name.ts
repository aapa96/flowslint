import type { LintRule } from "../../core/types";
import type { ErdDiagram } from "../types";
import { isRelationship } from "../types";

export const relationshipHasName: LintRule<ErdDiagram> = {
  id: "erd/relationship-has-name",
  description: "Relationships should have a name to document the type of association.",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes
      .filter(isRelationship)
      .filter((n) => !n.name || n.name.trim() === "")
      .map((n) => ({
        ruleId: "erd/relationship-has-name",
        severity: "info" as const,
        message: `Relationship "${n.id}" has no name.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
