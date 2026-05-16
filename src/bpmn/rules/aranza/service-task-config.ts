import type { LintRule } from "../../../core/types";
import type { BpmnDiagram } from "../../types";

export const serviceTaskConfig: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/service-task-config",
  description: "ServiceTask must have either Aranza connector+action or a valid Flowable execution config.",
  defaultSeverity: "error",
  check({ nodes }) {
    return nodes
      .filter((n) => n.type === "ServiceTask")
      .filter((n) => {
        const hasFlowableConfig = Boolean(
          n.flowableType || n.flowableDelegateExpression,
        );
        const hasAranzaConfig = Boolean(n.connector && n.action);
        return !hasFlowableConfig && !hasAranzaConfig;
      })
      .map((n) => ({
        ruleId: "bpmn/aranza/service-task-config",
        severity: "error" as const,
        message: `Service task "${n.name ?? n.id}" needs a valid executable configuration (connector+action or flowable config).`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
