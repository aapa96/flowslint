import type { LintRule } from "../../core/types";
import type { UmlDiagram } from "../types";

export const noDuplicateAttribute: LintRule<UmlDiagram> = {
  id: "uml/no-duplicate-attribute",
  description: "A class must not declare two attributes with the same name.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.flatMap((n) => {
      if (!n.attributes || n.attributes.length < 2) return [];

      const seen = new Set<string>();
      const duplicates = new Set<string>();
      for (const attr of n.attributes) {
        if (seen.has(attr.name)) duplicates.add(attr.name);
        seen.add(attr.name);
      }

      return [...duplicates].map((name) => ({
        ruleId: "uml/no-duplicate-attribute",
        severity: "warning" as const,
        message: `${n.type} "${n.name ?? n.id}" has duplicate attribute "${name}".`,
        elementId: n.id,
        elementType: n.type,
      }));
    });
  },
};
