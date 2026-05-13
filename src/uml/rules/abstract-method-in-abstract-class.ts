import type { LintRule } from "../../core/types";
import type { UmlDiagram } from "../types";

export const abstractMethodInAbstractClass: LintRule<UmlDiagram> = {
  id: "uml/abstract-method-in-abstract-class",
  description: "AbstractClass nodes should declare at least one abstract method.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes
      .filter((n) => n.type === "AbstractClass")
      .filter((n) => !n.methods?.some((m) => m.isAbstract))
      .map((n) => ({
        ruleId: "uml/abstract-method-in-abstract-class",
        severity: "warning" as const,
        message: `AbstractClass "${n.name ?? n.id}" has no abstract methods.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
