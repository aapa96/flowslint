import type { LintRule } from "../../core/types";
import type { ErdDiagram } from "../types";
import { isEntity } from "../types";

export const noDuplicateEntityNames: LintRule<ErdDiagram> = {
  id: "erd/no-duplicate-entity-names",
  description: "Two entities must not share the same name.",
  defaultSeverity: "error",
  check({ nodes }) {
    const seen = new Map<string, string>();
    const issues: ReturnType<LintRule<ErdDiagram>["check"]> = [];

    for (const node of nodes.filter(isEntity)) {
      const name = node.name?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const existing = seen.get(key);
      if (existing) {
        issues.push({
          ruleId: "erd/no-duplicate-entity-names",
          severity: "error" as const,
          message: `Duplicate entity name "${name}": also used by "${existing}".`,
          elementId: node.id,
          elementType: node.type,
          relatedElementIds: [existing],
        });
      } else {
        seen.set(key, node.id);
      }
    }

    return issues;
  },
};
