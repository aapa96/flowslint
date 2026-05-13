import type { LintRule } from "../../core/types";
import type { ErdDiagram } from "../types";
import { isAttribute } from "../types";

export const noOrphanAttribute: LintRule<ErdDiagram> = {
  id: "erd/no-orphan-attribute",
  description: "Every attribute node must be connected to an entity or relationship via a hasAttribute edge.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const attributeNodes = nodes.filter(isAttribute);

    return attributeNodes.flatMap((attr) => {
      const isConnected = edges.some(
        (e) => e.type === "hasAttribute" && e.target === attr.id,
      );
      if (isConnected) return [];

      return [
        {
          ruleId: "erd/no-orphan-attribute",
          severity: "error" as const,
          message: `Attribute "${attr.name ?? attr.id}" is not connected to any entity or relationship.`,
          elementId: attr.id,
          elementType: attr.type,
        },
      ];
    });
  },
};
