import { describe, expect, it } from "vitest";
import {
  isTask,
  isGateway,
  isEvent,
  isFlowNode,
  isContainer,
  isSubProcessLike,
  subProcessParent,
  poolAncestor,
  directChildren,
  topLevelFlowNodes,
  TASK_TYPES,
  GATEWAY_TYPES,
  EVENT_TYPES,
  FLOW_NODE_TYPES,
} from "../../src/bpmn/types";
import type { BpmnNode } from "../../src/bpmn/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function node(id: string, type: BpmnNode["type"], parentId?: string): BpmnNode {
  return { id, type, ...(parentId ? { parentId } : {}) };
}

function nodeMap(nodes: BpmnNode[]): Map<string, BpmnNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

// ─── Type guards ─────────────────────────────────────────────────────────────

describe("isTask", () => {
  it("returns true for all task types", () => {
    for (const t of TASK_TYPES) {
      expect(isTask(node("n", t))).toBe(true);
    }
  });

  it("returns false for non-task types", () => {
    expect(isTask(node("n", "StartEvent"))).toBe(false);
    expect(isTask(node("n", "ExclusiveGateway"))).toBe(false);
    expect(isTask(node("n", "Pool"))).toBe(false);
  });
});

describe("isGateway", () => {
  it("returns true for all gateway types", () => {
    for (const t of GATEWAY_TYPES) {
      expect(isGateway(node("n", t))).toBe(true);
    }
  });

  it("returns false for tasks and events", () => {
    expect(isGateway(node("n", "Task"))).toBe(false);
    expect(isGateway(node("n", "StartEvent"))).toBe(false);
  });
});

describe("isEvent", () => {
  it("returns true for all event types", () => {
    for (const t of EVENT_TYPES) {
      expect(isEvent(node("n", t))).toBe(true);
    }
  });

  it("returns false for tasks and containers", () => {
    expect(isEvent(node("n", "Task"))).toBe(false);
    expect(isEvent(node("n", "SubProcess"))).toBe(false);
  });
});

describe("isFlowNode", () => {
  it("returns true for all flow node types", () => {
    for (const t of FLOW_NODE_TYPES) {
      expect(isFlowNode(node("n", t))).toBe(true);
    }
  });

  it("returns false for Pool, Lane, Annotation, Group, data objects", () => {
    for (const t of ["Pool", "Lane", "Annotation", "Group", "DataObject", "DataStore"] as const) {
      expect(isFlowNode(node("n", t))).toBe(false);
    }
  });
});

describe("isContainer", () => {
  it("returns true for container types", () => {
    for (const t of ["Pool", "Lane", "SubProcess", "Transaction", "EventSubProcess",
      "AdHocSubProcess", "SubConversation", "SubChoreography"] as const) {
      expect(isContainer(node("n", t))).toBe(true);
    }
  });

  it("returns false for tasks and events", () => {
    expect(isContainer(node("n", "Task"))).toBe(false);
    expect(isContainer(node("n", "StartEvent"))).toBe(false);
  });
});

describe("isSubProcessLike", () => {
  it("returns true for SubProcess, Transaction, EventSubProcess, AdHocSubProcess", () => {
    for (const t of ["SubProcess", "Transaction", "EventSubProcess", "AdHocSubProcess"] as const) {
      expect(isSubProcessLike(node("n", t))).toBe(true);
    }
  });

  it("returns false for Pool, Lane, Task", () => {
    expect(isSubProcessLike(node("n", "Pool"))).toBe(false);
    expect(isSubProcessLike(node("n", "Lane"))).toBe(false);
    expect(isSubProcessLike(node("n", "Task"))).toBe(false);
  });
});

// ─── subProcessParent ─────────────────────────────────────────────────────────

describe("subProcessParent", () => {
  it("returns undefined when node has no parentId", () => {
    const nodes = [node("t1", "Task")];
    expect(subProcessParent(nodes[0]!, nodeMap(nodes))).toBeUndefined();
  });

  it("returns the parent SubProcess when node is directly inside one", () => {
    const sp = node("sp", "SubProcess");
    const t = node("t", "Task", "sp");
    const all = [sp, t];
    expect(subProcessParent(t, nodeMap(all))).toBe(sp);
  });

  it("returns undefined when parent is a Lane (not SubProcess-like)", () => {
    const lane = node("lane", "Lane", "pool1");
    const t = node("t", "Task", "lane");
    const all = [lane, t];
    expect(subProcessParent(t, nodeMap(all))).toBeUndefined();
  });

  it("finds grandparent SubProcess through a nested Lane", () => {
    const sp = node("sp", "SubProcess");
    const lane = node("lane", "Lane", "sp");
    // A node inside a SubProcess directly (no intermediate lane SubProcess)
    const t = node("t", "Task", "sp");
    const all = [sp, lane, t];
    expect(subProcessParent(t, nodeMap(all))).toBe(sp);
  });

  it("returns undefined when parentId points to a non-existent node", () => {
    const t = node("t", "Task", "ghost");
    expect(subProcessParent(t, new Map())).toBeUndefined();
  });
});

// ─── poolAncestor ─────────────────────────────────────────────────────────────

describe("poolAncestor", () => {
  it("returns undefined when node has no parentId", () => {
    const t = node("t", "Task");
    expect(poolAncestor(t, new Map())).toBeUndefined();
  });

  it("returns Pool when node is directly inside a Pool", () => {
    const pool = node("pool", "Pool");
    const t = node("t", "Task", "pool");
    const all = [pool, t];
    expect(poolAncestor(t, nodeMap(all))).toBe(pool);
  });

  it("finds Pool through Lane ancestry", () => {
    const pool = node("pool", "Pool");
    const lane = node("lane", "Lane", "pool");
    const t = node("t", "Task", "lane");
    const all = [pool, lane, t];
    expect(poolAncestor(t, nodeMap(all))).toBe(pool);
  });

  it("returns undefined when parentId is missing from map", () => {
    const t = node("t", "Task", "ghost");
    expect(poolAncestor(t, new Map())).toBeUndefined();
  });
});

// ─── directChildren ───────────────────────────────────────────────────────────

describe("directChildren", () => {
  it("returns nodes whose parentId matches", () => {
    const nodes = [
      node("pool", "Pool"),
      node("lane1", "Lane", "pool"),
      node("lane2", "Lane", "pool"),
      node("t", "Task", "lane1"),
    ];
    expect(directChildren("pool", nodes)).toHaveLength(2);
    expect(directChildren("lane1", nodes)).toHaveLength(1);
    expect(directChildren("lane2", nodes)).toHaveLength(0);
  });
});

// ─── topLevelFlowNodes ────────────────────────────────────────────────────────

describe("topLevelFlowNodes", () => {
  it("returns flow nodes without any parentId", () => {
    const nodes = [
      node("s", "StartEvent"),
      node("t", "Task"),
      node("e", "EndEvent"),
    ];
    expect(topLevelFlowNodes(nodes)).toHaveLength(3);
  });

  it("excludes non-flow-node types (Pool, Lane, Annotation, DataObject)", () => {
    const nodes = [
      node("pool", "Pool"),
      node("ann", "Annotation"),
      node("do", "DataObject"),
      node("s", "StartEvent"),
    ];
    const result = topLevelFlowNodes(nodes);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("s");
  });

  it("includes flow nodes parented to a Lane (Lane is top-level scope)", () => {
    const nodes = [
      node("pool", "Pool"),
      node("lane", "Lane", "pool"),
      node("t", "Task", "lane"),
    ];
    expect(topLevelFlowNodes(nodes)).toHaveLength(1);
    expect(topLevelFlowNodes(nodes)[0]?.id).toBe("t");
  });

  it("excludes flow nodes nested inside a SubProcess", () => {
    const nodes = [
      node("sp", "SubProcess"),
      node("t", "Task", "sp"),
      node("s", "StartEvent"),
    ];
    const result = topLevelFlowNodes(nodes);
    // Only the root StartEvent is top-level; Task inside SubProcess is excluded
    expect(result.map((n) => n.id)).toContain("s");
    expect(result.map((n) => n.id)).not.toContain("t");
  });
});
