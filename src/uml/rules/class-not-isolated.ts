import type { LintRule } from "../../core/types";
import type { UmlDiagram } from "../types";
import { isClassifier } from "../types";

export const classNotIsolated: LintRule<UmlDiagram> = {
  id: "uml/class-not-isolated",
  description: "Every classifier should have at least one edge connecting it to another node.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    const classifiers = nodes.filter(isClassifier);

    return classifiers.flatMap((n) => {
      const connected = edges.some((e) => e.source === n.id || e.target === n.id);
      if (connected) return [];

      return [
        {
          ruleId: "uml/class-not-isolated",
          severity: "warning" as const,
          message: `${n.type} "${n.name ?? n.id}" is isolated (no edges).`,
          elementId: n.id,
          elementType: n.type,
        },
      ];
    });
  },
};
