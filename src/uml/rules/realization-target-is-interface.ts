import type { LintRule } from "../../core/types";
import type { UmlDiagram } from "../types";

export const realizationTargetIsInterface: LintRule<UmlDiagram> = {
  id: "uml/realization-target-is-interface",
  description: "Realization edges must target an Interface node.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    return edges
      .filter((e) => e.type === "realization")
      .flatMap((e) => {
        const target = nodeById.get(e.target);
        if (!target || target.type === "Interface") return [];

        return [
          {
            ruleId: "uml/realization-target-is-interface",
            severity: "error" as const,
            message: `Realization edge "${e.id}" targets "${target.name ?? target.id}" which is a ${target.type}, not an Interface.`,
            elementId: e.id,
          },
        ];
      });
  },
};
