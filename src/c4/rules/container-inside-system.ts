import type { LintRule } from "../../core/types";
import type { C4Diagram } from "../types";
import { isContainer, isSystem } from "../types";

export const containerInsideSystem: LintRule<C4Diagram> = {
  id: "c4/container-inside-system",
  description: "Every Container must have a parentId pointing to a SoftwareSystem.",
  defaultSeverity: "error",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const containers = nodes.filter(isContainer);

    return containers.flatMap((c) => {
      if (!c.parentId) {
        return [
          {
            ruleId: "c4/container-inside-system",
            severity: "error" as const,
            message: `${c.type} "${c.name ?? c.id}" has no parent SoftwareSystem.`,
            elementId: c.id,
            elementType: c.type,
          },
        ];
      }
      const parent = nodeById.get(c.parentId);
      if (!parent || !isSystem(parent)) {
        return [
          {
            ruleId: "c4/container-inside-system",
            severity: "error" as const,
            message: `${c.type} "${c.name ?? c.id}" must be inside a SoftwareSystem, but its parent is "${parent?.type ?? "unknown"}".`,
            elementId: c.id,
            elementType: c.type,
          },
        ];
      }
      return [];
    });
  },
};
