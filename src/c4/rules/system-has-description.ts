import type { LintRule } from "../../core/types";
import type { C4Diagram } from "../types";

export const systemHasDescription: LintRule<C4Diagram> = {
  id: "c4/system-has-description",
  description: "Internal SoftwareSystems should have a description.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes
      .filter((n) => n.type === "SoftwareSystem" && !n.isExternal)
      .filter((n) => !n.description || n.description.trim() === "")
      .map((n) => ({
        ruleId: "c4/system-has-description",
        severity: "warning" as const,
        message: `SoftwareSystem "${n.name ?? n.id}" has no description.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
