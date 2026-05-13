import type { LintRule } from "../../core/types";
import type { ErdDiagram } from "../types";
import { isAttribute } from "../types";

export const attributeHasName: LintRule<ErdDiagram> = {
  id: "erd/attribute-has-name",
  description: "Attribute nodes should have a non-empty name.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes
      .filter(isAttribute)
      .filter((n) => !n.name || n.name.trim() === "")
      .map((n) => ({
        ruleId: "erd/attribute-has-name",
        severity: "warning" as const,
        message: `Attribute "${n.id}" has no name.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
