import type { BpmnDiagram } from "./types";
import { fromBpmnReactFlow } from "./adapters";

/**
 * Minimal structural shape of a `BpmnDiagramState` from `@aranzatech/diagrams-bpmn`.
 * Defined structurally so flowslint stays zero-dependency.
 */
export interface BpmnDiagramStateLike {
  nodes: Array<{
    id: string;
    type?: string;
    parentId?: string;
    data?: Record<string, unknown>;
    [key: string]: unknown;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type?: string;
    data?: Record<string, unknown>;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

/**
 * Convert a `BpmnDiagramState` from `@aranzatech/diagrams-bpmn` directly into
 * a `BpmnDiagram` that `runBpmnLint` can process.
 *
 * This is a thin type-safe alias over `fromBpmnReactFlow` — no conversion
 * logic is duplicated and flowslint stays zero-dependency.
 *
 * ```ts
 * import { fromBpmnDiagramState, runBpmnLint } from "@aranzatech/flowslint";
 * // ...
 * const lintDiagram = fromBpmnDiagramState(bpmnState);
 * const result = runBpmnLint(lintDiagram);
 * ```
 */
export function fromBpmnDiagramState(state: BpmnDiagramStateLike): BpmnDiagram {
  return fromBpmnReactFlow({
    nodes: state.nodes,
    edges: state.edges,
  });
}
