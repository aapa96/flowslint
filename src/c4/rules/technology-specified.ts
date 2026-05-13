import type { LintRule } from "../../core/types";
import type { C4Diagram } from "../types";
import { isContainer, isComponent } from "../types";

export const technologySpecified: LintRule<C4Diagram> = {
  id: "c4/technology-specified",
  description: "Containers and Components should specify the technology used.",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes
      .filter((n) => isContainer(n) || isComponent(n))
      .filter((n) => !n.technology || n.technology.trim() === "")
      .map((n) => ({
        ruleId: "c4/technology-specified",
        severity: "info" as const,
        message: `${n.type} "${n.name ?? n.id}" has no technology specified.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
