import type { LintRule } from "../../../core/types";
import type { BpmnDiagram } from "../../types";

export const receiveTaskMessageContext: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/receive-task-message-context",
  description: "ReceiveTask should be contextualized by an incoming message flow or an event-based gateway branch.",
  defaultSeverity: "info",
  check({ nodes, edges }) {
    return nodes
      .filter((node) => node.type === "ReceiveTask")
      .filter((node) => {
        const hasIncomingMessageFlow = edges.some((edge) => edge.type === "messageFlow" && edge.target === node.id);
        const isTargetOfEventBasedGateway = edges.some((edge) => {
          if (edge.type !== "sequenceFlow" || edge.target !== node.id) return false;
          const source = nodes.find((candidate) => candidate.id === edge.source);
          return source?.type === "EventBasedGateway";
        });
        return !hasIncomingMessageFlow && !isTargetOfEventBasedGateway;
      })
      .map((node) => ({
        ruleId: "bpmn/aranza/receive-task-message-context",
        severity: "info" as const,
        message: `La tarea de recepci\u00f3n "${node.name ?? node.id}" no muestra de d\u00f3nde llega el mensaje. Con\u00e9ctala con un messageFlow entrante o con una rama de EventBasedGateway para hacer expl\u00edcito el contexto.`,
        elementId: node.id,
        elementType: node.type,
      }));
  },
};
