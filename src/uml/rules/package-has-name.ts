import type { LintRule } from "../../core/types";
import type { UmlDiagram } from "../types";

export const packageHasName: LintRule<UmlDiagram> = {
  id: "uml/package-has-name",
  description: "Package nodes should have a name.",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes
      .filter((n) => n.type === "Package")
      .filter((n) => !n.name || n.name.trim() === "")
      .map((n) => ({
        ruleId: "uml/package-has-name",
        severity: "info" as const,
        message: `Package "${n.id}" has no name.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
