import type { LintRule } from "../../core/types";
import type { UmlDiagram } from "../types";
import { isClassifier } from "../types";

export const classHasName: LintRule<UmlDiagram> = {
  id: "uml/class-has-name",
  description: "Every classifier (Class, AbstractClass, Interface, Enumeration, DataType) must have a name.",
  defaultSeverity: "error",
  check({ nodes }) {
    return nodes
      .filter(isClassifier)
      .filter((n) => !n.name || n.name.trim() === "")
      .map((n) => ({
        ruleId: "uml/class-has-name",
        severity: "error" as const,
        message: `${n.type} "${n.id}" has no name.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
