import type { LintRule } from "../../core/types";
import type { UmlDiagram } from "../types";

export const enumerationHasLiterals: LintRule<UmlDiagram> = {
  id: "uml/enumeration-has-literals",
  description: "Enumeration nodes should have at least one attribute (literal).",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes
      .filter((n) => n.type === "Enumeration")
      .filter((n) => !n.attributes || n.attributes.length === 0)
      .map((n) => ({
        ruleId: "uml/enumeration-has-literals",
        severity: "warning" as const,
        message: `Enumeration "${n.name ?? n.id}" has no literals.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
