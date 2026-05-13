import type { LintRule } from "../../core/types";
import type { C4Diagram } from "../types";

export const elementHasName: LintRule<C4Diagram> = {
  id: "c4/element-has-name",
  description: "Every C4 element must have a non-empty name.",
  defaultSeverity: "error",
  check({ nodes }) {
    return nodes
      .filter((n) => !n.name || n.name.trim() === "")
      .map((n) => ({
        ruleId: "c4/element-has-name",
        severity: "error" as const,
        message: `${n.type} "${n.id}" has no name.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
