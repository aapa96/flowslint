import type { LintRule } from "../../core/types";
import type { C4Diagram } from "../types";
import { isPerson } from "../types";

export const elementHasDescription: LintRule<C4Diagram> = {
  id: "c4/element-has-description",
  description: "All elements should have a description (optional for Persons).",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes
      .filter((n) => !isPerson(n))
      .filter((n) => !n.description || n.description.trim() === "")
      .map((n) => ({
        ruleId: "c4/element-has-description",
        severity: "info" as const,
        message: `${n.type} "${n.name ?? n.id}" has no description.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
