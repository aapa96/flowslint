import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

// Per BPMN 2.0 §10.4.4: every throw link event must be matched by at least one
// catch link event with the same name (within the same process scope).
// An unmatched link is a modelling error — the flow cannot continue.

export const linkEventPair: LintRule<BpmnDiagram> = {
  id: "bpmn/link-event-pair",
  description: "Every throw link event must have a matching catch link event with the same name.",
  defaultSeverity: "error",
  check({ nodes }) {
    const throwLinks = nodes.filter(
      (n) => n.type === "IntermediateThrowEvent" && n.trigger === "link",
    );
    const catchLinkNames = new Set(
      nodes
        .filter((n) => n.type === "IntermediateCatchEvent" && n.trigger === "link")
        .map((n) => n.name?.trim())
        .filter(Boolean),
    );

    return throwLinks
      .filter((n) => !n.name || !catchLinkNames.has(n.name.trim()))
      .map((n) => ({
        ruleId: "bpmn/link-event-pair",
        severity: "error" as const,
        message: `Throw link event "${n.name ?? n.id}" has no matching catch link event with the same name.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
