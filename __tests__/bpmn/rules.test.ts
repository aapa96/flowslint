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
    expect(issues.some((i) => i.message.includes("no incoming"))).toBe(true);
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
    expect(issues.some((i) => i.message.includes("no outgoing"))).toBe(true);
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

// ── 18. choreography-has-participants ────────────────────────────────────────

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
