import type { LintRule } from "../../core/types";
import type { C4Diagram } from "../types";
import { isPerson } from "../types";

export const personInteracts: LintRule<C4Diagram> = {
  id: "c4/person-interacts",
  description: "Every Person should have at least one edge connecting to another element.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    const persons = nodes.filter(isPerson);

    return persons.flatMap((p) => {
      const connected = edges.some((e) => e.source === p.id || e.target === p.id);
      if (connected) return [];

      return [
        {
          ruleId: "c4/person-interacts",
          severity: "warning" as const,
          message: `Person "${p.name ?? p.id}" has no interactions.`,
          elementId: p.id,
          elementType: p.type,
        },
      ];
    });
  },
};
