import type { LintRule } from "../../core/types";
import type { C4Diagram } from "../types";
import { isComponent, isContainer } from "../types";

export const componentInsideContainer: LintRule<C4Diagram> = {
  id: "c4/component-inside-container",
  description: "Every Component must have a parentId pointing to a Container.",
  defaultSeverity: "error",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const components = nodes.filter(isComponent);

    return components.flatMap((comp) => {
      if (!comp.parentId) {
        return [
          {
            ruleId: "c4/component-inside-container",
            severity: "error" as const,
            message: `${comp.type} "${comp.name ?? comp.id}" has no parent Container.`,
            elementId: comp.id,
            elementType: comp.type,
          },
        ];
      }
      const parent = nodeById.get(comp.parentId);
      if (!parent || !isContainer(parent)) {
        return [
          {
            ruleId: "c4/component-inside-container",
            severity: "error" as const,
            message: `${comp.type} "${comp.name ?? comp.id}" must be inside a Container, but its parent is "${parent?.type ?? "unknown"}".`,
            elementId: comp.id,
            elementType: comp.type,
          },
        ];
      }
      return [];
    });
  },
};
