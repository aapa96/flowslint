import { describe, expect, it } from "vitest";
import {
  createLintEventBus,
  fromBpmnDiagramState,
  getBpmnFlowTabOrder,
  runBpmnLint,
  type BpmnDiagram,
  type BpmnDiagramStateLike,
} from "../../src/index";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function simpleDiagram(): BpmnDiagram {
  return {
    nodes: [
      { id: "start", type: "StartEvent" },
      { id: "task1", type: "Task" },
      { id: "task2", type: "Task" },
      { id: "end",   type: "EndEvent" },
    ],
    edges: [
      { id: "e1", type: "sequenceFlow", source: "start", target: "task1" },
      { id: "e2", type: "sequenceFlow", source: "task1", target: "task2" },
      { id: "e3", type: "sequenceFlow", source: "task2", target: "end" },
    ],
  };
}

// ─── 6. BPMN flow tab order ───────────────────────────────────────────────────

describe("getBpmnFlowTabOrder", () => {
  it("returns nodes in BFS order from start event", () => {
    const order = getBpmnFlowTabOrder(simpleDiagram());
    expect(order[0]).toBe("start");
    expect(order).toEqual(["start", "task1", "task2", "end"]);
  });

  it("returns empty array for empty diagram", () => {
    expect(getBpmnFlowTabOrder({ nodes: [], edges: [] })).toEqual([]);
  });

  it("appends unreachable flow nodes at the end", () => {
    const diagram: BpmnDiagram = {
      nodes: [
        { id: "start", type: "StartEvent" },
        { id: "task1", type: "Task" },
        { id: "isolated", type: "Task" }, // not connected
        { id: "end", type: "EndEvent" },
      ],
      edges: [
        { id: "e1", type: "sequenceFlow", source: "start", target: "task1" },
        { id: "e2", type: "sequenceFlow", source: "task1", target: "end" },
      ],
    };
    const order = getBpmnFlowTabOrder(diagram);
    expect(order).toContain("isolated");
    // isolated should be after the main flow
    expect(order.indexOf("end")).toBeLessThan(order.indexOf("isolated"));
  });

  it("scopes to parentId when scopeId is provided", () => {
    const diagram: BpmnDiagram = {
      nodes: [
        { id: "pool1", type: "Pool" },
        { id: "start", type: "StartEvent", parentId: "pool1" },
        { id: "task1", type: "Task",       parentId: "pool1" },
        // outside pool
        { id: "start2", type: "StartEvent" },
        { id: "task2",  type: "Task" },
      ],
      edges: [
        { id: "e1", type: "sequenceFlow", source: "start", target: "task1" },
        { id: "e2", type: "sequenceFlow", source: "start2", target: "task2" },
      ],
    };
    const order = getBpmnFlowTabOrder(diagram, "pool1");
    expect(order).toContain("start");
    expect(order).toContain("task1");
    expect(order).not.toContain("start2");
    expect(order).not.toContain("task2");
  });
});

// ─── 7. fromBpmnDiagramState adapter ─────────────────────────────────────────

describe("fromBpmnDiagramState", () => {
  it("converts a BpmnDiagramStateLike to BpmnDiagram", () => {
    const state: BpmnDiagramStateLike = {
      nodes: [
        { id: "start", type: "StartEvent", data: { elementType: "StartEvent" } },
        { id: "task1", type: "Task",       data: { elementType: "Task", label: "My Task" } },
        { id: "end",   type: "EndEvent",   data: { elementType: "EndEvent" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "task1", data: { edgeType: "SequenceFlow" } },
        { id: "e2", source: "task1", target: "end",   data: { edgeType: "SequenceFlow" } },
      ],
    };
    const diagram = fromBpmnDiagramState(state);
    expect(diagram.nodes).toHaveLength(3);
    expect(diagram.edges).toHaveLength(2);
    // elementType from data takes priority over node.type
    const task = diagram.nodes.find((n) => n.id === "task1");
    expect(task?.name).toBe("My Task");
  });

  it("produces a diagram that can be linted by runBpmnLint", () => {
    const state: BpmnDiagramStateLike = {
      nodes: [
        { id: "start", type: "StartEvent", data: { elementType: "StartEvent" } },
        { id: "end",   type: "EndEvent",   data: { elementType: "EndEvent" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "end", data: { edgeType: "SequenceFlow" } },
      ],
    };
    const diagram = fromBpmnDiagramState(state);
    const result = runBpmnLint(diagram);
    expect(result).toBeDefined();
    expect(result.passed).toBeDefined();
  });
});

// ─── Event bus integration with runBpmnLint ───────────────────────────────────

describe("runBpmnLint + event bus", () => {
  it("emits lint:completed when bus is provided", () => {
    const bus = createLintEventBus();
    let completed = false;
    bus.on("lint:completed", () => { completed = true; });
    runBpmnLint(simpleDiagram(), { bus });
    expect(completed).toBe(true);
  });

  it("emits issue:found for each issue found", () => {
    const bus = createLintEventBus();
    const issueRuleIds: string[] = [];
    bus.on("issue:found", ({ issue }) => issueRuleIds.push(issue.ruleId));
    // empty diagram should trigger issues (no start event, etc.)
    runBpmnLint({ nodes: [], edges: [] }, { bus });
    expect(issueRuleIds.length).toBeGreaterThan(0);
  });
});
