import { describe, it, expect } from "vitest";
import { runBpmnLint } from "../../src/bpmn/runner";
import type { BpmnDiagram } from "../../src/bpmn/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasIssue(d: BpmnDiagram, ruleId: string): boolean {
  return runBpmnLint(d).issues.some((i) => i.ruleId === ruleId);
}

function passes(d: BpmnDiagram, ruleId: string): boolean {
  return !hasIssue(d, ruleId);
}

function issuesFor(d: BpmnDiagram, ruleId: string) {
  return runBpmnLint(d).issues.filter((i) => i.ruleId === ruleId);
}

// ── Minimal valid diagram ─────────────────────────────────────────────────────

const minimal: BpmnDiagram = {
  nodes: [
    { id: "s1", type: "StartEvent" },
    { id: "t1", type: "Task", name: "Do work" },
    { id: "e1", type: "EndEvent" },
  ],
  edges: [
    { id: "f1", type: "sequenceFlow", source: "s1", target: "t1" },
    { id: "f2", type: "sequenceFlow", source: "t1", target: "e1" },
  ],
};

// ── 1. start-event-required ───────────────────────────────────────────────────

describe("bpmn/start-event-required", () => {
  const RULE = "bpmn/start-event-required";

  it("passes for a process with a start event", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when the process has no start event", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "Task", name: "Lone task" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("does not count start events inside a subprocess as process-level start", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "sp", type: "SubProcess" },
        { id: "ss", type: "StartEvent", parentId: "sp" },
        { id: "se", type: "EndEvent", parentId: "sp" },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("checks each pool independently — fires when one pool lacks a start", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "p1", type: "Pool" },
        { id: "s1", type: "StartEvent", parentId: "p1" },
        { id: "e1", type: "EndEvent",   parentId: "p1" },
        { id: "p2", type: "Pool" },
        { id: "e2", type: "EndEvent",   parentId: "p2" },
      ],
      edges: [],
    };
    const issues = issuesFor(d, RULE);
    expect(issues.length).toBe(1);
    expect(issues[0].elementId).toBe("p2");
  });
});

// ── 2. end-event-required ─────────────────────────────────────────────────────

describe("bpmn/end-event-required", () => {
  const RULE = "bpmn/end-event-required";

  it("passes when the process has an end event", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when the process has no end event", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "s1", type: "StartEvent" }, { id: "t1", type: "Task", name: "x" }],
      edges: [{ id: "f1", type: "sequenceFlow", source: "s1", target: "t1" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 3. no-orphan-edges ────────────────────────────────────────────────────────

describe("bpmn/no-orphan-edges", () => {
  const RULE = "bpmn/no-orphan-edges";

  it("passes when all edges reference existing nodes", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when an edge references a missing source node", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "Task", name: "x" }],
      edges: [{ id: "f1", type: "sequenceFlow", source: "GHOST", target: "t1" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when an edge references a missing target node", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "Task", name: "x" }],
      edges: [{ id: "f1", type: "sequenceFlow", source: "t1", target: "GHOST" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 4. no-self-loop ───────────────────────────────────────────────────────────

describe("bpmn/no-self-loop", () => {
  const RULE = "bpmn/no-self-loop";

  it("passes when no edge loops back to itself", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when a sequence flow points from a node to itself", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "Task", name: "loop" }],
      edges: [{ id: "f1", type: "sequenceFlow", source: "t1", target: "t1" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("ignores non-sequence-flow self-referential edges", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "Task", name: "x" }],
      edges: [{ id: "a1", type: "association", source: "t1", target: "t1" }],
    };
    expect(passes(d, RULE)).toBe(true);
  });
});

// ── 5. no-outgoing-from-end-event ────────────────────────────────────────────

describe("bpmn/no-outgoing-from-end-event", () => {
  const RULE = "bpmn/no-outgoing-from-end-event";

  it("passes when end event has no outgoing flows", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when an end event has an outgoing sequence flow", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "e1", type: "EndEvent" },
        { id: "t1", type: "Task", name: "x" },
      ],
      edges: [{ id: "f1", type: "sequenceFlow", source: "e1", target: "t1" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 6. start-event-no-incoming ────────────────────────────────────────────────

describe("bpmn/start-event-no-incoming", () => {
  const RULE = "bpmn/start-event-no-incoming";

  it("passes when start event has no incoming flows", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when a start event has an incoming sequence flow", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "x" },
        { id: "s1", type: "StartEvent" },
      ],
      edges: [{ id: "f1", type: "sequenceFlow", source: "t1", target: "s1" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 7. end-event-has-incoming ─────────────────────────────────────────────────

describe("bpmn/end-event-has-incoming", () => {
  const RULE = "bpmn/end-event-has-incoming";

  it("passes when end event has an incoming flow", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when an end event has no incoming sequence flow", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "e1", type: "EndEvent" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

describe("bpmn/data-association-direction", () => {
  const RULE = "bpmn/data-association-direction";

  it("passes when DataInput feeds a flow node", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "din", type: "DataInput", name: "Pedido entrante" },
        { id: "task", type: "Task", name: "Validar" },
      ],
      edges: [{ id: "a1", type: "dataAssociation", source: "din", target: "task" }],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("passes when a flow node produces a DataOutput", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "task", type: "Task", name: "Generar reporte" },
        { id: "dout", type: "DataOutput", name: "Reporte" },
      ],
      edges: [{ id: "a1", type: "dataAssociation", source: "task", target: "dout" }],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("warns when DataInput is targeted by a dataAssociation", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "task", type: "Task", name: "Preparar" },
        { id: "din", type: "DataInput", name: "Entrada" },
      ],
      edges: [{ id: "a1", type: "dataAssociation", source: "task", target: "din" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("warns when DataOutput is the source of a dataAssociation", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "dout", type: "DataOutput", name: "Salida" },
        { id: "task", type: "Task", name: "Consumir" },
      ],
      edges: [{ id: "a1", type: "dataAssociation", source: "dout", target: "task" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

describe("bpmn/event-trigger-compatible", () => {
  const RULE = "bpmn/event-trigger-compatible";

  it("passes for supported start-event trigger", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "s1", type: "StartEvent", trigger: "timer", eventDefinition: { type: "timer", timer: { kind: "duration", value: "PT1H" } } }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when a start event uses an unsupported error trigger", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "s1", type: "StartEvent", trigger: "error", eventDefinition: { type: "error", errorRef: "err-1" } }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when an intermediate throw event uses a timer trigger", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "i1", type: "IntermediateThrowEvent", trigger: "timer", eventDefinition: { type: "timer", timer: { kind: "date", value: "2026-01-01T00:00:00Z" } } }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when a boundary event uses an unsupported link trigger", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "b1", type: "BoundaryEvent", trigger: "link", eventDefinition: { type: "link", linkName: "ResumeFlow" } }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("passes when a boundary event uses a supported conditional trigger", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "b1", type: "BoundaryEvent", trigger: "conditional", eventDefinition: { type: "conditional", conditionExpression: "${amount > 1000}" } }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });
});

describe("bpmn/boundary-non-interrupting-compatible", () => {
  const RULE = "bpmn/boundary-non-interrupting-compatible";

  it("passes for a non-interrupting timer boundary event", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "Host" },
        { id: "b1", type: "BoundaryEvent", attachedToRef: "t1", trigger: "timer", isNonInterrupting: true, eventDefinition: { type: "timer", timer: { kind: "duration", value: "PT10M" } } },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires for a non-interrupting error boundary event", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "Host" },
        { id: "b1", type: "BoundaryEvent", attachedToRef: "t1", trigger: "error", isNonInterrupting: true, eventDefinition: { type: "error", errorRef: "err-1" } },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 8. intermediate-event-both-flows ─────────────────────────────────────────

describe("bpmn/intermediate-event-both-flows", () => {
  const RULE = "bpmn/intermediate-event-both-flows";

  it("passes when intermediate event has both flows", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "s1", type: "StartEvent" },
        { id: "im", type: "IntermediateCatchEvent" },
        { id: "e1", type: "EndEvent" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "s1", target: "im" },
        { id: "f2", type: "sequenceFlow", source: "im", target: "e1" },
      ],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when intermediate event has no incoming flow", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "im", type: "IntermediateCatchEvent" },
        { id: "e1", type: "EndEvent" },
      ],
      edges: [{ id: "f2", type: "sequenceFlow", source: "im", target: "e1" }],
    };
    const issues = issuesFor(d, RULE);
    expect(issues.some((i) => i.message.includes("entrada"))).toBe(true);
  });

  it("fires when intermediate event has no outgoing flow", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "s1", type: "StartEvent" },
        { id: "im", type: "IntermediateThrowEvent" },
      ],
      edges: [{ id: "f1", type: "sequenceFlow", source: "s1", target: "im" }],
    };
    const issues = issuesFor(d, RULE);
    expect(issues.some((i) => i.message.includes("salida"))).toBe(true);
  });
});

// ── 9. gateway-has-outgoing ───────────────────────────────────────────────────

describe("bpmn/gateway-has-outgoing", () => {
  const RULE = "bpmn/gateway-has-outgoing";

  it("passes when splitting gateway has 2+ outgoing flows", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "s1", type: "StartEvent" },
        { id: "gw", type: "ExclusiveGateway", name: "Branch?" },
        { id: "t1", type: "Task", name: "A" },
        { id: "t2", type: "Task", name: "B" },
        { id: "e1", type: "EndEvent" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "s1", target: "gw" },
        { id: "f2", type: "sequenceFlow", source: "gw", target: "t1" },
        { id: "f3", type: "sequenceFlow", source: "gw", target: "t2" },
        { id: "f4", type: "sequenceFlow", source: "t1", target: "e1" },
        { id: "f5", type: "sequenceFlow", source: "t2", target: "e1" },
      ],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when a splitting gateway has only one outgoing flow", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "gw", type: "ParallelGateway" },
        { id: "t1", type: "Task", name: "x" },
      ],
      edges: [{ id: "f1", type: "sequenceFlow", source: "gw", target: "t1" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 10. gateway-has-incoming ──────────────────────────────────────────────────

describe("bpmn/gateway-has-incoming", () => {
  const RULE = "bpmn/gateway-has-incoming";

  it("passes when joining gateway has 2+ incoming flows", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "A" },
        { id: "t2", type: "Task", name: "B" },
        { id: "gw", type: "ParallelGateway" },
        { id: "e1", type: "EndEvent" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "t1", target: "gw" },
        { id: "f2", type: "sequenceFlow", source: "t2", target: "gw" },
        { id: "f3", type: "sequenceFlow", source: "gw", target: "e1" },
      ],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when a joining gateway has only one incoming flow", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "x" },
        { id: "gw", type: "ExclusiveGateway", name: "Merge" },
      ],
      edges: [{ id: "f1", type: "sequenceFlow", source: "t1", target: "gw" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 11. event-based-gateway-min-outgoing ──────────────────────────────────────

describe("bpmn/event-based-gateway-min-outgoing", () => {
  const RULE = "bpmn/event-based-gateway-min-outgoing";

  it("passes when event-based gateway has 2 outgoing flows", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "gw", type: "EventBasedGateway" },
        { id: "c1", type: "IntermediateCatchEvent", trigger: "timer" },
        { id: "c2", type: "IntermediateCatchEvent", trigger: "message" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "gw", target: "c1" },
        { id: "f2", type: "sequenceFlow", source: "gw", target: "c2" },
      ],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when event-based gateway has fewer than 2 outgoing flows", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "gw", type: "EventBasedGateway" },
        { id: "c1", type: "IntermediateCatchEvent", trigger: "timer" },
      ],
      edges: [{ id: "f1", type: "sequenceFlow", source: "gw", target: "c1" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 12. event-based-gateway-valid-targets ─────────────────────────────────────

describe("bpmn/event-based-gateway-valid-targets", () => {
  const RULE = "bpmn/event-based-gateway-valid-targets";

  it("passes when targets are IntermediateCatchEvent or ReceiveTask", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "gw", type: "EventBasedGateway" },
        { id: "c1", type: "IntermediateCatchEvent", trigger: "timer" },
        { id: "rt", type: "ReceiveTask", name: "Wait" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "gw", target: "c1" },
        { id: "f2", type: "sequenceFlow", source: "gw", target: "rt" },
      ],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when a target is a Task (invalid)", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "gw", type: "EventBasedGateway" },
        { id: "t1", type: "Task", name: "Do work" },
        { id: "c1", type: "IntermediateCatchEvent" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "gw", target: "t1" },
        { id: "f2", type: "sequenceFlow", source: "gw", target: "c1" },
      ],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 13. sequence-flow-no-cross-pool ───────────────────────────────────────────

describe("bpmn/sequence-flow-no-cross-pool", () => {
  const RULE = "bpmn/sequence-flow-no-cross-pool";

  it("passes when a sequence flow stays within a pool", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "p1", type: "Pool" },
        { id: "t1", type: "Task", name: "A", parentId: "p1" },
        { id: "t2", type: "Task", name: "B", parentId: "p1" },
      ],
      edges: [{ id: "f1", type: "sequenceFlow", source: "t1", target: "t2" }],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when a sequence flow crosses pool boundaries", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "p1", type: "Pool" },
        { id: "t1", type: "Task", name: "A", parentId: "p1" },
        { id: "p2", type: "Pool" },
        { id: "t2", type: "Task", name: "B", parentId: "p2" },
      ],
      edges: [{ id: "f1", type: "sequenceFlow", source: "t1", target: "t2" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 14. boundary-event-attached ───────────────────────────────────────────────

describe("bpmn/boundary-event-attached", () => {
  const RULE = "bpmn/boundary-event-attached";

  it("passes when boundary event is attached to a task", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "Do work" },
        { id: "be", type: "BoundaryEvent", parentId: "t1" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when boundary event has no parent", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "be", type: "BoundaryEvent" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when boundary event is attached to a gateway (invalid host)", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "gw", type: "ExclusiveGateway", name: "?" },
        { id: "be", type: "BoundaryEvent", parentId: "gw" },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 15. subprocess-has-start-end ──────────────────────────────────────────────

describe("bpmn/subprocess-has-start-end", () => {
  const RULE = "bpmn/subprocess-has-start-end";

  it("passes for an embedded subprocess with start and end events", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "sp", type: "SubProcess", subProcessVariant: "embedded" },
        { id: "ss", type: "StartEvent", parentId: "sp" },
        { id: "se", type: "EndEvent",   parentId: "sp" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when embedded subprocess has no start event", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "sp", type: "SubProcess" },
        { id: "se", type: "EndEvent", parentId: "sp" },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("passes for ad-hoc subprocess without start/end events", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "sp", type: "SubProcess", subProcessVariant: "adhoc" }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when event subprocess has a start event with no trigger", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "sp", type: "SubProcess", subProcessVariant: "event" },
        { id: "ss", type: "StartEvent", parentId: "sp", trigger: "none" },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("passes when event subprocess start event has a real trigger", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "sp", type: "SubProcess", subProcessVariant: "event" },
        { id: "ss", type: "StartEvent", parentId: "sp", trigger: "error" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });
});

// ── 16. link-event-pair ───────────────────────────────────────────────────────

describe("bpmn/link-event-pair", () => {
  const RULE = "bpmn/link-event-pair";

  it("passes when a throw link event is matched by a catch link event of the same name", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "th", type: "IntermediateThrowEvent", trigger: "link", name: "GoToPayment" },
        { id: "ca", type: "IntermediateCatchEvent", trigger: "link", name: "GoToPayment" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when a throw link event has no matching catch", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "th", type: "IntermediateThrowEvent", trigger: "link", name: "OrphanLink" },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when a throw link only matches a catch in a different scope", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "sp", type: "SubProcess" },
        { id: "th", type: "IntermediateThrowEvent", trigger: "link", name: "ResumeReview" },
        { id: "ca", type: "IntermediateCatchEvent", trigger: "link", name: "ResumeReview", parentId: "sp" },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("passes when throw and catch link events match inside the same subprocess scope", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "sp", type: "SubProcess" },
        { id: "th", type: "IntermediateThrowEvent", trigger: "link", name: "ResumeReview", parentId: "sp" },
        { id: "ca", type: "IntermediateCatchEvent", trigger: "link", name: "ResumeReview", parentId: "sp" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when two catch link events share the same name in one scope", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "th", type: "IntermediateThrowEvent", trigger: "link", name: "GoToPayment" },
        { id: "ca1", type: "IntermediateCatchEvent", trigger: "link", name: "GoToPayment" },
        { id: "ca2", type: "IntermediateCatchEvent", trigger: "link", name: "GoToPayment" },
      ],
      edges: [],
    };
    const issues = issuesFor(d, RULE);
    expect(issues.some((issue) => issue.elementId === "ca1" || issue.elementId === "ca2")).toBe(true);
  });
});

// ── 17. cancel-only-in-transaction ────────────────────────────────────────────

describe("bpmn/cancel-only-in-transaction", () => {
  const RULE = "bpmn/cancel-only-in-transaction";

  it("passes when cancel end event is inside a transaction subprocess", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "tx", type: "SubProcess", subProcessVariant: "transaction" },
        { id: "ce", type: "EndEvent", trigger: "cancel", parentId: "tx" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when cancel end event is NOT inside a transaction", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "ce", type: "EndEvent", trigger: "cancel" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 18. event-definition-payload-required ───────────────────────────────────

describe("bpmn/event-definition-payload-required", () => {
  const RULE = "bpmn/event-definition-payload-required";

  it("passes when timer events have a timer payload", () => {
    const d: BpmnDiagram = {
      nodes: [
        {
          id: "t1",
          type: "StartEvent",
          trigger: "timer",
          eventDefinition: { type: "timer", timer: { kind: "duration", value: "PT5M" } },
        },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when conditional event is missing its condition expression", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "c1", type: "IntermediateCatchEvent", trigger: "conditional", eventDefinition: { type: "conditional" } },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 19. event-definition-ref-declared ───────────────────────────────────────

describe("bpmn/event-definition-ref-declared", () => {
  const RULE = "bpmn/event-definition-ref-declared";

  it("passes when message refs exist in global definitions", () => {
    const d: BpmnDiagram = {
      definitions: { messages: [{ id: "Message_A", name: "A" }] },
      nodes: [
        {
          id: "m1",
          type: "IntermediateCatchEvent",
          trigger: "message",
          eventDefinition: { type: "message", messageRef: "Message_A" },
        },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when an error ref is not declared", () => {
    const d: BpmnDiagram = {
      definitions: { errors: [{ id: "Error_A", name: "A" }] },
      nodes: [
        {
          id: "e1",
          type: "EndEvent",
          trigger: "error",
          eventDefinition: { type: "error", errorRef: "Missing_Error" },
        },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 20. choreography-has-participants ────────────────────────────────────────

describe("bpmn/choreography-has-participants", () => {
  const RULE = "bpmn/choreography-has-participants";

  it("passes when choreography task has 2 participant bands", () => {
    const d: BpmnDiagram = {
      nodes: [{
        id: "ct",
        type: "ChoreographyTask",
        name: "Order",
        participants: [
          { name: "Buyer", isInitiating: true },
          { name: "Seller", isInitiating: false },
        ],
      }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when choreography task has fewer than 2 participants", () => {
    const d: BpmnDiagram = {
      nodes: [{
        id: "ct",
        type: "ChoreographyTask",
        name: "Order",
        participants: [{ name: "Buyer", isInitiating: true }],
      }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 19. no-duplicate-sequence-flow ────────────────────────────────────────────

describe("bpmn/no-duplicate-sequence-flow", () => {
  const RULE = "bpmn/no-duplicate-sequence-flow";

  it("passes for a minimal diagram with no duplicate flows", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when two sequence flows share the same source and target", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "A" },
        { id: "t2", type: "Task", name: "B" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "t1", target: "t2" },
        { id: "f2", type: "sequenceFlow", source: "t1", target: "t2" },
      ],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 20. message-flow-valid-endpoints ─────────────────────────────────────────

describe("bpmn/message-flow-valid-endpoints", () => {
  const RULE = "bpmn/message-flow-valid-endpoints";

  it("passes when message flow connects elements in different pools", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "p1", type: "Pool" },
        { id: "t1", type: "Task", name: "Send", parentId: "p1" },
        { id: "p2", type: "Pool" },
        { id: "t2", type: "Task", name: "Receive", parentId: "p2" },
      ],
      edges: [{ id: "mf", type: "messageFlow", source: "t1", target: "t2" }],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when message flow connects elements in the same pool", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "p1", type: "Pool" },
        { id: "t1", type: "Task", name: "A", parentId: "p1" },
        { id: "t2", type: "Task", name: "B", parentId: "p1" },
      ],
      edges: [{ id: "mf", type: "messageFlow", source: "t1", target: "t2" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when message flow connects elements with no pool", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "A" },
        { id: "t2", type: "Task", name: "B" },
      ],
      edges: [{ id: "mf", type: "messageFlow", source: "t1", target: "t2" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 21. no-disconnected-nodes ─────────────────────────────────────────────────

describe("bpmn/no-disconnected-nodes", () => {
  const RULE = "bpmn/no-disconnected-nodes";

  it("passes when all tasks are connected via sequence flows", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when a task has no sequence flow connections", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "s1", type: "StartEvent" },
        { id: "t1", type: "Task", name: "Connected" },
        { id: "t2", type: "Task", name: "Floating" },
        { id: "e1", type: "EndEvent" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "s1", target: "t1" },
        { id: "f2", type: "sequenceFlow", source: "t1", target: "e1" },
      ],
    };
    const issues = issuesFor(d, RULE);
    expect(issues.some((i) => i.elementId === "t2")).toBe(true);
  });
});

// ── 22. no-implicit-split ─────────────────────────────────────────────────────

describe("bpmn/no-implicit-split", () => {
  const RULE = "bpmn/no-implicit-split";

  it("passes when a task has a single outgoing flow", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when a task has multiple outgoing flows", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "Split" },
        { id: "t2", type: "Task", name: "A" },
        { id: "t3", type: "Task", name: "B" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "t1", target: "t2" },
        { id: "f2", type: "sequenceFlow", source: "t1", target: "t3" },
      ],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 23. no-implicit-join ─────────────────────────────────────────────────────

describe("bpmn/no-implicit-join", () => {
  const RULE = "bpmn/no-implicit-join";

  it("passes when a task has a single incoming flow", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when a task has multiple incoming flows", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "A" },
        { id: "t2", type: "Task", name: "B" },
        { id: "tj", type: "Task", name: "Join" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "t1", target: "tj" },
        { id: "f2", type: "sequenceFlow", source: "t2", target: "tj" },
      ],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 24. no-multiple-start-events ─────────────────────────────────────────────

describe("bpmn/no-multiple-start-events", () => {
  const RULE = "bpmn/no-multiple-start-events";

  it("passes when the process has exactly one start event", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when the process has two start events at process level", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "s1", type: "StartEvent" },
        { id: "s2", type: "StartEvent" },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("does not fire when multiple start events belong to different pools", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "p1", type: "Pool" },
        { id: "s1", type: "StartEvent", parentId: "p1" },
        { id: "p2", type: "Pool" },
        { id: "s2", type: "StartEvent", parentId: "p2" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });
});

// ── 25. no-empty-pool ─────────────────────────────────────────────────────────

describe("bpmn/no-empty-pool", () => {
  const RULE = "bpmn/no-empty-pool";

  it("passes when pool has at least one flow node", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "p1", type: "Pool" },
        { id: "s1", type: "StartEvent", parentId: "p1" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when pool has no flow nodes", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "p1", type: "Pool" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 26. task-has-name ─────────────────────────────────────────────────────────

describe("bpmn/task-has-name", () => {
  const RULE = "bpmn/task-has-name";

  it("passes when all tasks have names", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when a task has no name", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "s1", type: "StartEvent" },
        { id: "t1", type: "Task" },
        { id: "e1", type: "EndEvent" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "s1", target: "t1" },
        { id: "f2", type: "sequenceFlow", source: "t1", target: "e1" },
      ],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 27. gateway-has-name ─────────────────────────────────────────────────────

describe("bpmn/gateway-has-name", () => {
  const RULE = "bpmn/gateway-has-name";

  it("passes when ExclusiveGateway has a name", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "gw", type: "ExclusiveGateway", name: "Approved?" }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when ExclusiveGateway has no name", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "gw", type: "ExclusiveGateway" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("does not fire for ParallelGateway without a name", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "gw", type: "ParallelGateway" }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });
});

// ── 28. exclusive-gateway-condition ──────────────────────────────────────────

describe("bpmn/exclusive-gateway-condition", () => {
  const RULE = "bpmn/exclusive-gateway-condition";

  it("passes when all non-default outgoing flows have conditions", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "gw", type: "ExclusiveGateway", name: "Branch?" },
        { id: "t1", type: "Task", name: "A" },
        { id: "t2", type: "Task", name: "B" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "gw", target: "t1", conditionExpression: "${approved}" },
        { id: "f2", type: "sequenceFlow", source: "gw", target: "t2", isDefault: true },
      ],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when a non-default outgoing flow has no condition", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "gw", type: "ExclusiveGateway", name: "Branch?" },
        { id: "t1", type: "Task", name: "A" },
        { id: "t2", type: "Task", name: "B" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "gw", target: "t1" },
        { id: "f2", type: "sequenceFlow", source: "gw", target: "t2" },
      ],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 29. compensation-flow-target ─────────────────────────────────────────────

describe("bpmn/compensation-flow-target", () => {
  const RULE = "bpmn/compensation-flow-target";

  it("passes when compensation boundary has an association to a compensation-marked task", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "Book Hotel", markers: ["compensation"] },
        { id: "be", type: "BoundaryEvent", trigger: "compensation", parentId: "t1" },
        { id: "ct", type: "Task", name: "Cancel Hotel", markers: ["compensation"] },
      ],
      edges: [{ id: "a1", type: "association", source: "be", target: "ct" }],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when compensation boundary has no outgoing association", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "Book Hotel" },
        { id: "be", type: "BoundaryEvent", trigger: "compensation", parentId: "t1" },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 30. annotation-has-text ───────────────────────────────────────────────────

describe("bpmn/annotation-has-text", () => {
  const RULE = "bpmn/annotation-has-text";

  it("passes when annotation has text", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "an", type: "Annotation", name: "Important note" }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when annotation is empty", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "an", type: "Annotation" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 31. data-object-connected ─────────────────────────────────────────────────

describe("bpmn/data-object-connected", () => {
  const RULE = "bpmn/data-object-connected";

  it("passes when DataObject is connected via a dataAssociation", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "x" },
        { id: "do", type: "DataObject", name: "Invoice" },
      ],
      edges: [{ id: "da", type: "dataAssociation", source: "t1", target: "do" }],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when DataObject has no dataAssociation edge", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "do", type: "DataObject", name: "Invoice" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("passes when DataStore is connected via a dataAssociation", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "task", type: "Task", name: "Persist" },
        { id: "store", type: "DataStore", name: "ERP" },
      ],
      edges: [{ id: "da", type: "dataAssociation", source: "task", target: "store" }],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when DataStoreReference has no dataAssociation edge", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "storeRef", type: "DataStoreReference", name: "CRM Store" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

describe("bpmn/data-reference-target-exists", () => {
  const RULE = "bpmn/data-reference-target-exists";

  it("passes when DataObjectReference points to an existing DataObject", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "do1", type: "DataObject", name: "Invoice" },
        { id: "dor1", type: "DataObjectReference", name: "Invoice Ref", dataObjectRef: "do1" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when DataObjectReference points to a missing DataObject", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "dor1", type: "DataObjectReference", name: "Broken Ref", dataObjectRef: "missing" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("passes when DataStoreReference points to an existing DataStore", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "ds1", type: "DataStore", name: "ERP" },
        { id: "dsr1", type: "DataStoreReference", name: "ERP Ref", dataStoreRef: "ds1" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when DataStoreReference points to a missing DataStore", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "dsr1", type: "DataStoreReference", name: "Broken Store Ref", dataStoreRef: "missing-store" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 32. flow-node-has-incoming ────────────────────────────────────────────────

describe("bpmn/flow-node-has-incoming", () => {
  const RULE = "bpmn/flow-node-has-incoming";

  it("passes when non-start flow nodes have incoming sequence flows", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when a task has no incoming sequence flow", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "s1", type: "StartEvent" },
        { id: "t1", type: "Task", name: "Loose task" },
        { id: "e1", type: "EndEvent" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "t1", target: "e1" },
      ],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "t1")).toBe(true);
  });
});

// ── 33. flow-node-has-outgoing ────────────────────────────────────────────────

describe("bpmn/flow-node-has-outgoing", () => {
  const RULE = "bpmn/flow-node-has-outgoing";

  it("passes when non-end flow nodes have outgoing sequence flows", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when a task has no outgoing sequence flow", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "s1", type: "StartEvent" },
        { id: "t1", type: "Task", name: "Dead task" },
        { id: "e1", type: "EndEvent" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "s1", target: "t1" },
      ],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "t1")).toBe(true);
  });

  it("fires when a start event has no outgoing sequence flow", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "s1", type: "StartEvent" },
        { id: "e1", type: "EndEvent" },
      ],
      edges: [],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "s1")).toBe(true);
  });
});

// ── 34. reachable-from-start ─────────────────────────────────────────────────

describe("bpmn/reachable-from-start", () => {
  const RULE = "bpmn/reachable-from-start";

  it("passes when all flow nodes are reachable from a start event", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when a node is disconnected from every start event", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "s1", type: "StartEvent" },
        { id: "t1", type: "Task", name: "Main" },
        { id: "e1", type: "EndEvent" },
        { id: "t2", type: "Task", name: "Unreachable" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "s1", target: "t1" },
        { id: "f2", type: "sequenceFlow", source: "t1", target: "e1" },
      ],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "t2")).toBe(true);
  });
});

// ── 35. end-event-reachable ──────────────────────────────────────────────────

describe("bpmn/end-event-reachable", () => {
  const RULE = "bpmn/end-event-reachable";

  it("passes when at least one end event is reachable from a start event", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when no end event can be reached from any start event", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "s1", type: "StartEvent" },
        { id: "t1", type: "Task", name: "Main" },
        { id: "e1", type: "EndEvent" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "s1", target: "t1" },
      ],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── runBpmnLint config override ───────────────────────────────────────────────

// ── 37. sequence-flow-valid-endpoints ─────────────────────────────────────────

describe("bpmn/sequence-flow-valid-endpoints", () => {
  const RULE = "bpmn/sequence-flow-valid-endpoints";

  it("passes when sequence flow connects two flow nodes", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when a sequence flow targets a DataObject", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "Task" },
        { id: "d1", type: "DataObject" },
      ],
      edges: [{ id: "f1", type: "sequenceFlow", source: "t1", target: "d1" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when a sequence flow originates from a DataObjectReference", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "d1", type: "DataObjectReference" },
        { id: "t1", type: "Task", name: "Task" },
      ],
      edges: [{ id: "f1", type: "sequenceFlow", source: "d1", target: "t1" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("ignores non-sequence-flow edges", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "Task" },
        { id: "d1", type: "DataObject" },
      ],
      edges: [{ id: "a1", type: "dataAssociation", source: "t1", target: "d1" }],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });
});

// ── 38. data-association-valid-endpoints ──────────────────────────────────────

describe("bpmn/data-association-valid-endpoints", () => {
  const RULE = "bpmn/data-association-valid-endpoints";

  it("passes when data association connects DataObjectReference to a Task", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "Task" },
        { id: "d1", type: "DataObjectReference" },
      ],
      edges: [{ id: "a1", type: "dataAssociation", source: "d1", target: "t1" }],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("passes when data association connects a Task to a DataStore", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "Task" },
        { id: "ds1", type: "DataStore" },
      ],
      edges: [{ id: "a1", type: "dataAssociation", source: "t1", target: "ds1" }],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when a data association connects two flow nodes", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "Task A" },
        { id: "t2", type: "Task", name: "Task B" },
      ],
      edges: [{ id: "a1", type: "dataAssociation", source: "t1", target: "t2" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when a data association connects two data elements", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "d1", type: "DataObject" },
        { id: "d2", type: "DataObjectReference" },
      ],
      edges: [{ id: "a1", type: "dataAssociation", source: "d1", target: "d2" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 39. bpmn/aranza/task-has-owner ────────────────────────────────────────────

describe("bpmn/aranza/task-has-owner", () => {
  const RULE = "bpmn/aranza/task-has-owner";

  it("passes when all tasks have an owner", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "s1", type: "StartEvent" },
        { id: "t1", type: "Task", name: "Review", owner: "ops-team" },
        { id: "e1", type: "EndEvent" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "s1", target: "t1" },
        { id: "f2", type: "sequenceFlow", source: "t1", target: "e1" },
      ],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when a task has no owner", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "UserTask", name: "Approve" }],
      edges: [],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "t1")).toBe(true);
  });

  it("fires when a task has an empty owner string", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "ServiceTask", name: "Send", owner: "   " }],
      edges: [],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "t1")).toBe(true);
  });

  it("does not fire for non-task elements (e.g. events)", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "s1", type: "StartEvent" }],
      edges: [],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "s1")).toBe(false);
  });
});

// ── 40. bpmn/aranza/critical-task-has-sla ────────────────────────────────────

describe("bpmn/aranza/critical-task-has-sla", () => {
  const RULE = "bpmn/aranza/critical-task-has-sla";

  it("passes when critical task has an SLA", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "UserTask", name: "Review", priority: "critical", sla: "PT4H" }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("passes when a non-critical task has no SLA", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "Task", name: "Low prio", priority: "low" }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when a critical task has no SLA", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "UserTask", name: "Urgent", priority: "critical" }],
      edges: [],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "t1")).toBe(true);
  });

  it("fires when a critical task has an empty SLA string", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "Task", name: "Urgent", priority: "critical", sla: "" }],
      edges: [],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "t1")).toBe(true);
  });
});

// ── 41. bpmn/aranza/sla-format ────────────────────────────────────────────────

describe("bpmn/aranza/sla-format", () => {
  const RULE = "bpmn/aranza/sla-format";

  it("passes for valid ISO 8601 duration PT4H", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "Task", name: "Task", sla: "PT4H" }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("passes for valid ISO 8601 duration P1DT2H30M", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "Task", name: "Task", sla: "P1DT2H30M" }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("passes for valid ISO 8601 duration P1Y2M3D", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "Task", name: "Task", sla: "P1Y2M3D" }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("passes when sla is not set (no false positives)", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "Task", name: "Task" }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires for invalid value '4 hours'", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "Task", name: "Task", sla: "4 hours" }],
      edges: [],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "t1")).toBe(true);
  });

  it("fires for bare 'P' with no components", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "Task", name: "Task", sla: "P" }],
      edges: [],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "t1")).toBe(true);
  });

  it("fires for issue severity=error", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "Task", name: "Task", sla: "bad" }],
      edges: [],
    };
    const issues = issuesFor(d, RULE);
    expect(issues[0]?.severity).toBe("error");
  });
});

// ── lane-parent-pool ──────────────────────────────────────────────────────────

describe("bpmn/lane-parent-pool", () => {
  const RULE = "bpmn/lane-parent-pool";

  it("passes for a Lane directly inside a Pool", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "p1", type: "Pool" },
        { id: "l1", type: "Lane", parentId: "p1" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires for a Lane at root level (no parent)", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "l1", type: "Lane" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires for a Lane whose parent is not a Pool", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "sp", type: "SubProcess" },
        { id: "l1", type: "Lane", parentId: "sp" },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── pool-children-inside-lanes ────────────────────────────────────────────────

describe("bpmn/pool-children-inside-lanes", () => {
  const RULE = "bpmn/pool-children-inside-lanes";

  it("passes when Pool has no lanes", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "p1", type: "Pool" },
        { id: "t1", type: "Task", parentId: "p1", name: "T" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("passes when all flow nodes are inside lanes", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "p1", type: "Pool" },
        { id: "l1", type: "Lane", parentId: "p1" },
        { id: "t1", type: "Task", parentId: "l1", name: "T" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when pool has lanes but flow node is direct child of pool", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "p1", type: "Pool" },
        { id: "l1", type: "Lane", parentId: "p1" },
        { id: "t1", type: "Task", parentId: "p1", name: "Orphan" },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── process-node-outside-participant ─────────────────────────────────────────

describe("bpmn/process-node-outside-participant", () => {
  const RULE = "bpmn/process-node-outside-participant";

  it("passes in a simple process with no pools", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "s1", type: "StartEvent" },
        { id: "t1", type: "Task", name: "T" },
        { id: "e1", type: "EndEvent" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "s1", target: "t1" },
        { id: "f2", type: "sequenceFlow", source: "t1", target: "e1" },
      ],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when a flow node is at root level while pools exist", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "p1", type: "Pool" },
        { id: "t1", type: "Task", name: "Orphan" },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("passes when all flow nodes are inside a pool", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "p1", type: "Pool" },
        { id: "s1", type: "StartEvent", parentId: "p1" },
        { id: "e1", type: "EndEvent", parentId: "p1" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });
});

// ── boundary-no-incoming ──────────────────────────────────────────────────────

describe("bpmn/boundary-no-incoming", () => {
  const RULE = "bpmn/boundary-no-incoming";

  it("passes for a boundary event with no incoming flows", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "T" },
        { id: "be", type: "BoundaryEvent", parentId: "t1" },
        { id: "e1", type: "EndEvent" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "be", target: "e1" },
      ],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when a sequence flow targets a boundary event", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "s1", type: "StartEvent" },
        { id: "be", type: "BoundaryEvent" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "s1", target: "be" },
      ],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── boundary-has-outgoing ─────────────────────────────────────────────────────

describe("bpmn/boundary-has-outgoing", () => {
  const RULE = "bpmn/boundary-has-outgoing";

  it("passes when boundary event has an outgoing flow", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "be", type: "BoundaryEvent" },
        { id: "e1", type: "EndEvent" },
      ],
      edges: [{ id: "f1", type: "sequenceFlow", source: "be", target: "e1" }],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when boundary event has no outgoing flow", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "be", type: "BoundaryEvent" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("is a warning", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "be", type: "BoundaryEvent" }],
      edges: [],
    };
    expect(issuesFor(d, RULE)[0]?.severity).toBe("warning");
  });
});

// ── event-definition-ref-required ────────────────────────────────────────────

describe("bpmn/event-definition-ref-required", () => {
  const RULE = "bpmn/event-definition-ref-required";

  it("passes when message event has a ref", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "e1", type: "StartEvent", trigger: "message", eventDefinition: { type: "message", messageRef: "msg1" } },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when message event has no ref", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "e1", type: "StartEvent", trigger: "message", eventDefinition: { type: "message" } },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when signal event has no ref", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "e1", type: "IntermediateCatchEvent", trigger: "signal", eventDefinition: { type: "signal" } },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when error event has no ref", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "e1", type: "BoundaryEvent", trigger: "error", eventDefinition: { type: "error" } },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when escalation event has no ref", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "e1", type: "IntermediateThrowEvent", trigger: "escalation", eventDefinition: { type: "escalation" } },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("does not fire for timer event (different rule)", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "e1", type: "StartEvent", trigger: "timer", eventDefinition: { type: "timer" } },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });
});

// ── scope-single-start ────────────────────────────────────────────────────────

describe("bpmn/scope-single-start", () => {
  const RULE = "bpmn/scope-single-start";

  it("passes when subprocess has exactly one start event", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "sp", type: "SubProcess" },
        { id: "ss", type: "StartEvent", parentId: "sp" },
        { id: "se", type: "EndEvent", parentId: "sp" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when subprocess has multiple start events", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "sp", type: "SubProcess" },
        { id: "ss1", type: "StartEvent", parentId: "sp" },
        { id: "ss2", type: "StartEvent", parentId: "sp" },
        { id: "se", type: "EndEvent", parentId: "sp" },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires for EventSubProcess with multiple start events", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "esp", type: "EventSubProcess" },
        { id: "ss1", type: "StartEvent", parentId: "esp", trigger: "message" },
        { id: "ss2", type: "StartEvent", parentId: "esp", trigger: "timer" },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── gateway-single-default ────────────────────────────────────────────────────

describe("bpmn/gateway-single-default", () => {
  const RULE = "bpmn/gateway-single-default";

  it("passes when gateway has one default outgoing flow", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "s1", type: "StartEvent" },
        { id: "gw", type: "ExclusiveGateway" },
        { id: "e1", type: "EndEvent" },
        { id: "e2", type: "EndEvent" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "s1", target: "gw" },
        { id: "f2", type: "sequenceFlow", source: "gw", target: "e1", isDefault: true },
        { id: "f3", type: "sequenceFlow", source: "gw", target: "e2", conditionExpression: "x>0" },
      ],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when gateway has two default outgoing flows", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "gw", type: "ExclusiveGateway" },
        { id: "e1", type: "EndEvent" },
        { id: "e2", type: "EndEvent" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "gw", target: "e1", isDefault: true },
        { id: "f2", type: "sequenceFlow", source: "gw", target: "e2", isDefault: true },
      ],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("does not fire for ParallelGateway (no default concept)", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "gw", type: "ParallelGateway" },
        { id: "e1", type: "EndEvent" },
        { id: "e2", type: "EndEvent" },
      ],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "gw", target: "e1", isDefault: true },
        { id: "f2", type: "sequenceFlow", source: "gw", target: "e2", isDefault: true },
      ],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("is an error", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "gw", type: "ExclusiveGateway" }, { id: "e1", type: "EndEvent" }, { id: "e2", type: "EndEvent" }],
      edges: [
        { id: "f1", type: "sequenceFlow", source: "gw", target: "e1", isDefault: true },
        { id: "f2", type: "sequenceFlow", source: "gw", target: "e2", isDefault: true },
      ],
    };
    expect(issuesFor(d, RULE)[0]?.severity).toBe("error");
  });
});

// ── subprocess-has-start-end extended for EventSubProcess type ────────────────

describe("bpmn/subprocess-has-start-end (EventSubProcess node type)", () => {
  const RULE = "bpmn/subprocess-has-start-end";

  it("passes for EventSubProcess with a triggered start event", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "esp", type: "EventSubProcess" },
        { id: "ss", type: "StartEvent", parentId: "esp", trigger: "message" },
        { id: "se", type: "EndEvent", parentId: "esp" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires for EventSubProcess with no start event", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "esp", type: "EventSubProcess" },
        { id: "t1", type: "Task", name: "Work", parentId: "esp" },
        { id: "se", type: "EndEvent", parentId: "esp" },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires for EventSubProcess whose start event has no trigger", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "esp", type: "EventSubProcess" },
        { id: "ss", type: "StartEvent", parentId: "esp", trigger: "none" },
        { id: "se", type: "EndEvent", parentId: "esp" },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

describe("bpmn/event-subprocess-start-compatible", () => {
  const RULE = "bpmn/event-subprocess-start-compatible";

  it("passes for an interrupting error start event inside EventSubProcess", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "esp", type: "EventSubProcess" },
        { id: "ss", type: "StartEvent", parentId: "esp", trigger: "error", eventDefinition: { type: "error", errorRef: "err-1" } },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires for an EventSubProcess start event with unsupported link trigger", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "esp", type: "EventSubProcess" },
        { id: "ss", type: "StartEvent", parentId: "esp", trigger: "link", eventDefinition: { type: "link", linkName: "Resume" } },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("passes for a non-interrupting escalation start event inside EventSubProcess", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "esp", type: "EventSubProcess" },
        { id: "ss", type: "StartEvent", parentId: "esp", trigger: "escalation", isNonInterrupting: true, eventDefinition: { type: "escalation", escalationRef: "esc-1" } },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires for a non-interrupting error start event inside EventSubProcess", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "esp", type: "EventSubProcess" },
        { id: "ss", type: "StartEvent", parentId: "esp", trigger: "error", isNonInterrupting: true, eventDefinition: { type: "error", errorRef: "err-1" } },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 42. bpmn/aranza/automatable-task-action ───────────────────────────────────

describe("bpmn/aranza/automatable-task-action", () => {
  const RULE = "bpmn/aranza/automatable-task-action";

  it("passes when an automatable task has both connector and action", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "ServiceTask", name: "Call API", connector: "http", action: "POST" }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when connector is missing", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "ServiceTask", name: "Call API", action: "POST" }],
      edges: [],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "t1")).toBe(true);
  });

  it("fires when action is missing", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "Task", name: "Do work", connector: "salesforce" }],
      edges: [],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "t1")).toBe(true);
  });

  it("fires for all automatable types without config", () => {
    const types = ["Task", "ServiceTask", "ScriptTask", "BusinessRuleTask", "SendTask", "ReceiveTask"] as const;
    for (const type of types) {
      const d: BpmnDiagram = {
        nodes: [{ id: "t1", type, name: "Task" }],
        edges: [],
      };
      expect(issuesFor(d, RULE).some((i) => i.elementId === "t1")).toBe(true);
    }
  });

  it("does not fire for non-automatable types (UserTask, ManualTask, events)", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "u1", type: "UserTask", name: "Approve" },
        { id: "m1", type: "ManualTask", name: "Sign" },
        { id: "s1", type: "StartEvent" },
        { id: "e1", type: "EndEvent" },
      ],
      edges: [],
    };
    expect(issuesFor(d, RULE).length).toBe(0);
  });
});

// ── 43. bpmn/aranza/service-task-config ───────────────────────────────────────

describe("bpmn/aranza/service-task-config", () => {
  const RULE = "bpmn/aranza/service-task-config";

  it("passes when ServiceTask has connector and action", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "ServiceTask", name: "HTTP call", connector: "http", action: "POST" }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("passes when ServiceTask has flowableType", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "ServiceTask", name: "HTTP", flowableType: "http" }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("passes when ServiceTask has flowableDelegateExpression", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "ServiceTask", name: "Delegate", flowableDelegateExpression: "${myBean.execute}" }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when ServiceTask has no executable config at all", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "ServiceTask", name: "Unconfigured" }],
      edges: [],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "t1")).toBe(true);
  });

  it("passes when ServiceTask is configured through serviceConfig connector fields", () => {
    const d: BpmnDiagram = {
      nodes: [{
        id: "t1",
        type: "ServiceTask",
        name: "CRM connector",
        serviceConfig: { connectorId: "crm", connectorAction: "getCustomer" },
      }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("passes when ServiceTask is configured through serviceConfig endpoint", () => {
    const d: BpmnDiagram = {
      nodes: [{
        id: "t1",
        type: "ServiceTask",
        name: "Webhook",
        serviceConfig: { implementation: "http", httpMethod: "POST", endpoint: "https://api.example.com/customers" },
      }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when connector implementation is missing action", () => {
    const d: BpmnDiagram = {
      nodes: [{
        id: "t1",
        type: "ServiceTask",
        name: "CRM connector",
        serviceConfig: { implementation: "connector", connectorInstanceId: "cfg-1" },
      }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when http implementation is missing method", () => {
    const d: BpmnDiagram = {
      nodes: [{
        id: "t1",
        type: "ServiceTask",
        name: "Webhook",
        serviceConfig: { implementation: "http", endpoint: "https://api.example.com/customers" },
      }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when web service implementation is missing operationRef", () => {
    const d: BpmnDiagram = {
      nodes: [{
        id: "t1",
        type: "ServiceTask",
        name: "SOAP",
        serviceConfig: { implementation: "webService" },
      }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when implementation is none and no legacy Flowable config exists", () => {
    const d: BpmnDiagram = {
      nodes: [{
        id: "t1",
        type: "ServiceTask",
        name: "Legacy empty",
        serviceConfig: { implementation: "none" },
      }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("does not fire for non-ServiceTask types", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "u1", type: "UserTask", name: "Approve" },
        { id: "t1", type: "Task", name: "Generic" },
        { id: "s1", type: "ScriptTask", name: "Script" },
      ],
      edges: [],
    };
    expect(issuesFor(d, RULE).length).toBe(0);
  });
});

// ── 44. bpmn/aranza/variable-exists ──────────────────────────────────────────

describe("bpmn/aranza/variable-exists", () => {
  const RULE = "bpmn/aranza/variable-exists";

  it("passes when the referenced variable is declared in process definitions", () => {
    const d: BpmnDiagram = {
      definitions: {
        variables: [{ id: "var_customer_id", name: "customerId", type: "string" }],
      },
      nodes: [
        { id: "t1", type: "Task", name: "Use variable", owner: "{{ customerId }}" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("passes when the referenced variable is produced by another node", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "svc", type: "ServiceTask", name: "Fetch", outputVariable: "customer" },
        { id: "task", type: "Task", name: "Review", owner: "{{ customer }}" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when a referenced variable is not declared anywhere", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "task", type: "Task", name: "Review", owner: "{{ missingVar }}" },
      ],
      edges: [],
    };
    const issues = issuesFor(d, RULE);
    expect(issues.some((issue) => issue.elementId === "task")).toBe(true);
  });
});

// ── 45. bpmn/cyclomatic-complexity ────────────────────────────────────────────

describe("bpmn/cyclomatic-complexity", () => {
  const RULE = "bpmn/cyclomatic-complexity";

  function makeGateways(count: number): BpmnDiagram {
    return {
      nodes: Array.from({ length: count }, (_, i) => ({
        id: `gw${i}`,
        type: "ExclusiveGateway" as const,
        name: `GW ${i}`,
      })),
      edges: [],
    };
  }

  it("passes when gateway count is at or below threshold (10)", () => {
    expect(passes(makeGateways(10), RULE)).toBe(true);
  });

  it("fires when gateway count exceeds threshold", () => {
    expect(hasIssue(makeGateways(11), RULE)).toBe(true);
  });

  it("counts all decision gateway types", () => {
    const d: BpmnDiagram = {
      nodes: [
        ...Array.from({ length: 4 }, (_, i) => ({ id: `ex${i}`, type: "ExclusiveGateway" as const })),
        ...Array.from({ length: 4 }, (_, i) => ({ id: `in${i}`, type: "InclusiveGateway" as const })),
        ...Array.from({ length: 3 }, (_, i) => ({ id: `eb${i}`, type: "EventBasedGateway" as const })),
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("does not count gateways inside a subprocess toward the top-level total", () => {
    const d: BpmnDiagram = {
      nodes: [
        ...Array.from({ length: 8 }, (_, i) => ({ id: `gw${i}`, type: "ExclusiveGateway" as const })),
        ...Array.from({ length: 5 }, (_, i) => ({ id: `nested${i}`, type: "ExclusiveGateway" as const, parentId: "sp1" })),
        { id: "sp1", type: "SubProcess" as const },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });
});

// ── 45. bpmn/long-process ─────────────────────────────────────────────────────

describe("bpmn/long-process", () => {
  const RULE = "bpmn/long-process";

  function makeTasks(count: number, parentId?: string): BpmnDiagram {
    return {
      nodes: Array.from({ length: count }, (_, i) => ({
        id: `t${i}`,
        type: "Task" as const,
        name: `Task ${i}`,
        ...(parentId ? { parentId } : {}),
      })),
      edges: [],
    };
  }

  it("passes when task count is at or below threshold (20)", () => {
    expect(passes(makeTasks(20), RULE)).toBe(true);
  });

  it("fires when flat task count exceeds threshold", () => {
    expect(hasIssue(makeTasks(21), RULE)).toBe(true);
  });

  it("does not count tasks inside sub-processes toward the top-level total", () => {
    const d: BpmnDiagram = {
      nodes: [
        ...Array.from({ length: 18 }, (_, i) => ({ id: `t${i}`, type: "Task" as const, name: `T${i}` })),
        ...Array.from({ length: 10 }, (_, i) => ({ id: `nt${i}`, type: "Task" as const, name: `Nested ${i}`, parentId: "sp1" })),
        { id: "sp1", type: "SubProcess" as const },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("counts all task types (ServiceTask, UserTask, etc.)", () => {
    const d: BpmnDiagram = {
      nodes: [
        ...Array.from({ length: 8 }, (_, i) => ({ id: `st${i}`, type: "ServiceTask" as const, name: `S${i}` })),
        ...Array.from({ length: 8 }, (_, i) => ({ id: `ut${i}`, type: "UserTask" as const, name: `U${i}` })),
        ...Array.from({ length: 5 }, (_, i) => ({ id: `sc${i}`, type: "ScriptTask" as const, name: `Sc${i}` })),
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 46. bpmn/aranza/adhoc-has-completion-condition ───────────────────────────

describe("bpmn/aranza/adhoc-has-completion-condition", () => {
  const RULE = "bpmn/aranza/adhoc-has-completion-condition";

  it("passes when AdHocSubProcess has a completionCondition", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "ah1", type: "AdHocSubProcess", completionCondition: "done == true" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });

  it("fires info when AdHocSubProcess has no completionCondition", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "ah1", type: "AdHocSubProcess" }],
      edges: [],
    };
    const result = runBpmnLint(d, { rules: { [RULE]: "info" } });
    const issue = result.issues.find((i) => i.ruleId === RULE);
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("info");
    expect(issue?.elementId).toBe("ah1");
  });

  it("does not fire for regular SubProcess", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "sp1", type: "SubProcess" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });

  it("does not fire for Task nodes", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "Task", name: "Do work" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });
});

// ── 47. bpmn/aranza/user-task-has-form ───────────────────────────────────────

describe("bpmn/aranza/user-task-has-form", () => {
  const RULE = "bpmn/aranza/user-task-has-form";

  it("passes when UserTask has a formKey", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "ut1", type: "UserTask", name: "Review", formKey: "review-form" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });

  it("fires info when UserTask has no formKey", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "ut1", type: "UserTask", name: "Approve" }],
      edges: [],
    };
    const result = runBpmnLint(d, { rules: { [RULE]: "info" } });
    const issue = result.issues.find((i) => i.ruleId === RULE);
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("info");
    expect(issue?.elementId).toBe("ut1");
  });

  it("fires for multiple UserTasks without formKey", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "ut1", type: "UserTask", name: "Step 1" },
        { id: "ut2", type: "UserTask", name: "Step 2" },
        { id: "ut3", type: "UserTask", name: "Step 3", formKey: "step3-form" },
      ],
      edges: [],
    };
    const result = runBpmnLint(d, { rules: { [RULE]: "info" } });
    const issues = result.issues.filter((i) => i.ruleId === RULE);
    expect(issues).toHaveLength(2);
    expect(issues.map((i) => i.elementId)).toContain("ut1");
    expect(issues.map((i) => i.elementId)).toContain("ut2");
  });

  it("does not fire for non-UserTask nodes", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "Plain task" },
        { id: "st1", type: "ServiceTask", name: "Service" },
        { id: "mt1", type: "ManualTask", name: "Manual" },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });
});

// ── 48. bpmn/aranza/user-task-has-due-date ────────────────────────────────────

describe("bpmn/aranza/user-task-has-due-date", () => {
  const RULE = "bpmn/aranza/user-task-has-due-date";

  it("passes when UserTask has a dueDate", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "ut1", type: "UserTask", name: "Review", dueDate: "PT48H" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });

  it("fires info when UserTask has no dueDate", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "ut1", type: "UserTask", name: "Approve" }],
      edges: [],
    };
    const result = runBpmnLint(d, { rules: { [RULE]: "info" } });
    const issue = result.issues.find((i) => i.ruleId === RULE);
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("info");
    expect(issue?.elementId).toBe("ut1");
  });

  it("fires when dueDate is an empty string", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "ut1", type: "UserTask", name: "Approve", dueDate: "   " }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("does not fire for non-UserTask types", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "Generic" },
        { id: "st1", type: "ServiceTask", name: "Service" },
      ],
      edges: [],
    };
    expect(issuesFor(d, RULE)).toHaveLength(0);
  });
});

// ── 49. bpmn/aranza/multi-instance-has-cardinality ───────────────────────────

describe("bpmn/aranza/multi-instance-has-cardinality", () => {
  const RULE = "bpmn/aranza/multi-instance-has-cardinality";

  it("passes when sequential MI task has loopCardinality", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "UserTask", name: "Review", loopType: "sequentialMultiple", loopCardinality: "${items.size()}" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });

  it("passes when parallel MI task has loopCardinality", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "ServiceTask", name: "Call", loopType: "parallelMultiple", loopCardinality: "3" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });

  it("fires when sequential MI task has no loopCardinality", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "Task", name: "Loop", loopType: "sequentialMultiple" }],
      edges: [],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "t1")).toBe(true);
  });

  it("fires when parallel MI task has no loopCardinality", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "UserTask", name: "Notify All", loopType: "parallelMultiple" }],
      edges: [],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "t1")).toBe(true);
  });

  it("does not fire for standard loop tasks", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "Task", name: "Retry", loopType: "loop" }],
      edges: [],
    };
    expect(issuesFor(d, RULE)).toHaveLength(0);
  });

  it("does not fire for tasks with no loopType", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "t1", type: "Task", name: "Simple" }],
      edges: [],
    };
    expect(issuesFor(d, RULE)).toHaveLength(0);
  });
});

// ── 50. bpmn/aranza/business-rule-task-has-decision ──────────────────────────

describe("bpmn/aranza/business-rule-task-has-decision", () => {
  const RULE = "bpmn/aranza/business-rule-task-has-decision";

  it("passes when BusinessRuleTask has a decisionRef", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "brt1", type: "BusinessRuleTask", name: "Evaluate Risk", decisionRef: "risk-decision" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });

  it("passes when BusinessRuleTask has a minimally valid inline decision table", () => {
    const d: BpmnDiagram = {
      nodes: [{
        id: "brt1",
        type: "BusinessRuleTask",
        name: "Inline Decision",
        inlineDecisionTable: {
          hitPolicy: "UNIQUE",
          inputs: [{ id: "i1", label: "Amount", expression: "amount" }],
          outputs: [{ id: "o1", label: "Result", name: "result" }],
          rules: [{ id: "r1", inputs: { i1: "> 100" }, outputs: { o1: "\"APPROVE\"" } }],
        },
      }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });

  it("fires when BusinessRuleTask has no decisionRef", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "brt1", type: "BusinessRuleTask", name: "Unconfigured Rule" }],
      edges: [],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "brt1")).toBe(true);
  });

  it("fires when decisionRef is an empty string", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "brt1", type: "BusinessRuleTask", name: "Empty Ref", decisionRef: "  " }],
      edges: [],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "brt1")).toBe(true);
  });

  it("fires when inline decision table exists but has no rules", () => {
    const d: BpmnDiagram = {
      nodes: [{
        id: "brt1",
        type: "BusinessRuleTask",
        name: "Incomplete Inline",
        inlineDecisionTable: {
          hitPolicy: "UNIQUE",
          inputs: [{ id: "i1", label: "Amount", expression: "amount" }],
          outputs: [{ id: "o1", label: "Result", name: "result" }],
          rules: [],
        },
      }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("does not fire for non-BusinessRuleTask types", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "Generic" },
        { id: "u1", type: "UserTask", name: "Manual" },
      ],
      edges: [],
    };
    expect(issuesFor(d, RULE)).toHaveLength(0);
  });
});

// ── 51. bpmn/aranza/call-activity-has-called-element ─────────────────────────

describe("bpmn/aranza/call-activity-has-called-element", () => {
  const RULE = "bpmn/aranza/call-activity-has-called-element";

  it("passes when CallActivity has a calledElement", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "ca1", type: "CallActivity", name: "Run Subprocess", calledElement: "OrderProcess" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });

  it("warns when calledElement contains spaces", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "ca1", type: "CallActivity", name: "Run Subprocess", calledElement: "Order Process" }],
      edges: [],
    };
    const issues = issuesFor(d, "bpmn/aranza/call-activity-called-element-format");
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("warning");
  });

  it("fires error when CallActivity has no calledElement", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "ca1", type: "CallActivity", name: "Broken Call" }],
      edges: [],
    };
    const issues = issuesFor(d, RULE);
    expect(issues.some((i) => i.elementId === "ca1")).toBe(true);
    expect(issues[0]?.severity).toBe("error");
  });

  it("fires when calledElement is blank", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "ca1", type: "CallActivity", name: "Blank", calledElement: "" }],
      edges: [],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "ca1")).toBe(true);
  });

  it("does not fire for non-CallActivity types", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "T" },
        { id: "st1", type: "ServiceTask", name: "S" },
      ],
      edges: [],
    };
    expect(issuesFor(d, RULE)).toHaveLength(0);
  });
});

// ── 52. bpmn/aranza/script-task-has-format ────────────────────────────────────

describe("bpmn/aranza/script-task-has-format", () => {
  const RULE = "bpmn/aranza/script-task-has-format";

  it("passes when ScriptTask has scriptFormat", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "sc1", type: "ScriptTask", name: "Transform", scriptFormat: "javascript" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });

  it("passes for groovy format", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "sc1", type: "ScriptTask", name: "Calc", scriptFormat: "groovy" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });

  it("fires when ScriptTask has no scriptFormat", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "sc1", type: "ScriptTask", name: "No Format" }],
      edges: [],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "sc1")).toBe(true);
  });

  it("fires when scriptFormat is blank", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "sc1", type: "ScriptTask", name: "Blank", scriptFormat: "  " }],
      edges: [],
    };
    expect(issuesFor(d, RULE).some((i) => i.elementId === "sc1")).toBe(true);
  });

  it("does not fire for non-ScriptTask types", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "t1", type: "Task", name: "Generic" },
        { id: "u1", type: "ServiceTask", name: "HTTP" },
      ],
      edges: [],
    };
    expect(issuesFor(d, RULE)).toHaveLength(0);
  });
});

// ── 53. bpmn/aranza/script-task-has-script ────────────────────────────────────

describe("bpmn/aranza/script-task-has-script", () => {
  const RULE = "bpmn/aranza/script-task-has-script";

  it("passes when ScriptTask has a script body", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "st1", type: "ScriptTask", name: "Calc", script: "return amount * 0.2;" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });

  it("fires when ScriptTask has no script body", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "st1", type: "ScriptTask", name: "Empty", scriptFormat: "javascript" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 54. bpmn/aranza/user-task-has-assignment ─────────────────────────────────

describe("bpmn/aranza/user-task-has-assignment", () => {
  const RULE = "bpmn/aranza/user-task-has-assignment";

  it("passes when UserTask has candidate groups", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "u1", type: "UserTask", name: "Approve", candidateGroups: "ops" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });

  it("passes when UserTask has candidate users", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "u1", type: "UserTask", name: "Review", candidateUsers: "ana@example.com" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });

  it("passes when UserTask has owner", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "u1", type: "UserTask", name: "Sign", owner: "legal" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });

  it("fires when UserTask has no assignment strategy", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "u1", type: "UserTask", name: "Unassigned" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 55. bpmn/aranza/receive-task-message-context ─────────────────────────────

describe("bpmn/aranza/receive-task-message-context", () => {
  const RULE = "bpmn/aranza/receive-task-message-context";

  it("passes when ReceiveTask has an incoming message flow", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "send", type: "SendTask", name: "Notify" },
        { id: "recv", type: "ReceiveTask", name: "Wait reply" },
      ],
      edges: [{ id: "mf1", type: "messageFlow", source: "send", target: "recv" }],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });

  it("passes when ReceiveTask is targeted by an EventBasedGateway", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "gw", type: "EventBasedGateway", name: "Wait event" },
        { id: "recv", type: "ReceiveTask", name: "Receive order" },
      ],
      edges: [{ id: "f1", type: "sequenceFlow", source: "gw", target: "recv" }],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });

  it("fires when ReceiveTask has no visible message context", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "recv", type: "ReceiveTask", name: "Blind receive" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 56. bpmn/aranza/send-task-message-context ────────────────────────────────

describe("bpmn/aranza/send-task-message-context", () => {
  const RULE = "bpmn/aranza/send-task-message-context";

  it("passes when SendTask has an outgoing message flow", () => {
    const d: BpmnDiagram = {
      nodes: [
        { id: "send", type: "SendTask", name: "Notify" },
        { id: "recv", type: "ReceiveTask", name: "Receive" },
      ],
      edges: [{ id: "mf1", type: "messageFlow", source: "send", target: "recv" }],
    };
    expect(hasIssue(d, RULE)).toBe(false);
  });

  it("fires when SendTask has no outgoing message flow", () => {
    const d: BpmnDiagram = {
      nodes: [{ id: "send", type: "SendTask", name: "Silent send" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

describe("runBpmnLint config", () => {
  it("allows disabling a rule via config", () => {
    const d: BpmnDiagram = { nodes: [], edges: [] };
    const result = runBpmnLint(d, { rules: { "bpmn/start-event-required": "off" } });
    expect(result.issues.some((i) => i.ruleId === "bpmn/start-event-required")).toBe(false);
  });

  it("allows overriding severity via config", () => {
    const d: BpmnDiagram = { nodes: [{ id: "t1", type: "Task" }], edges: [] };
    const result = runBpmnLint(d, { rules: { "bpmn/task-has-name": "error" } });
    const issue = result.issues.find((i) => i.ruleId === "bpmn/task-has-name");
    expect(issue?.severity).toBe("error");
  });
});
