import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

export const noDuplicateSequenceFlow: LintRule<BpmnDiagram> = {
  id: "bpmn/no-duplicate-sequence-flow",
  description: "Two sequence flows with the same source and target are a duplication.",
  defaultSeverity: "error",
  check({ edges }) {
    const sequenceFlows = edges.filter((e) => e.type === "sequenceFlow");
    const seen = new Map<string, string>();

    return sequenceFlows.flatMap((e) => {
      const key = `${e.source}→${e.target}`;
      const existing = seen.get(key);
      if (existing) {
        return [
          {
            ruleId: "bpmn/no-duplicate-sequence-flow",
            severity: "error" as const,
            message: `Duplicate sequence flow from "${e.source}" to "${e.target}" (duplicates "${existing}").`,
            elementId: e.id,
          },
        ];
      }
      seen.set(key, e.id);
      return [];
    });
  },
};
