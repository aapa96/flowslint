import type { LintRule } from "../../core/types";
import type { C4Diagram } from "../types";
import { isPerson, isComponent } from "../types";

export const noDirectPersonToComponent: LintRule<C4Diagram> = {
  id: "c4/no-direct-person-to-component",
  description: "A Person must not connect directly to a Component; persons interact with Systems or Containers.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    return edges.flatMap((e) => {
      const source = nodeById.get(e.source);
      const target = nodeById.get(e.target);
      if (!source || !target) return [];
      if (!isPerson(source) || !isComponent(target)) return [];

      return [
        {
          ruleId: "c4/no-direct-person-to-component",
          severity: "error" as const,
          message: `Person "${source.name ?? source.id}" connects directly to Component "${target.name ?? target.id}". Persons should interact with Systems or Containers.`,
          elementId: e.id,
        },
      ];
    });
  },
};
