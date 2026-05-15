import { describe, expect, it, vi } from "vitest";
import {
  createLintEventBus,
  LintCache,
  createLintCache,
  withLintCache,
  hashDiagramForLint,
  serializeLintResult,
  deserializeLintResult,
  groupIssuesByElement,
  groupIssuesByCategory,
  groupIssuesByRule,
  summarizeByElement,
  diffLintResults,
  runRules,
  type LintResult,
  type LintIssue,
  type LintRule,
} from "../../src/index";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeResult(issues: Partial<LintIssue>[]): LintResult {
  const full: LintIssue[] = issues.map((i) => ({
    ruleId: i.ruleId ?? "test/rule",
    severity: i.severity ?? "warning",
    message: i.message ?? "test message",
    ...i,
  }));
  const errors = full.filter((i) => i.severity === "error").length;
  const warnings = full.filter((i) => i.severity === "warning").length;
  const infos = full.filter((i) => i.severity === "info").length;
  return { issues: full, errors, warnings, infos, passed: errors === 0 };
}

// ─── 1. LintEventBus ─────────────────────────────────────────────────────────

describe("LintEventBus", () => {
  it("emits and receives events", () => {
    const bus = createLintEventBus();
    const received: string[] = [];
    bus.on("rule:started", ({ ruleId }) => received.push(ruleId));
    bus.emit("rule:started", { ruleId: "test/rule", severity: "warning" });
    expect(received).toEqual(["test/rule"]);
  });

  it("once() fires only once", () => {
    const bus = createLintEventBus();
    let count = 0;
    bus.once("rule:passed", () => { count += 1; });
    bus.emit("rule:passed", { ruleId: "r1" });
    bus.emit("rule:passed", { ruleId: "r1" });
    expect(count).toBe(1);
  });

  it("off() removes handler", () => {
    const bus = createLintEventBus();
    const handler = vi.fn();
    bus.on("lint:completed", handler);
    bus.off("lint:completed", handler);
    bus.emit("lint:completed", { result: makeResult([]) });
    expect(handler).not.toHaveBeenCalled();
  });

  it("clear() removes all listeners for an event", () => {
    const bus = createLintEventBus();
    const handler = vi.fn();
    bus.on("rule:failed", handler);
    bus.clear("rule:failed");
    expect(bus.listenerCount("rule:failed")).toBe(0);
  });

  it("unsubscribe fn returned by on() removes the listener", () => {
    const bus = createLintEventBus();
    const handler = vi.fn();
    const unsub = bus.on("rule:passed", handler);
    unsub();
    bus.emit("rule:passed", { ruleId: "r1" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("integrates with runRules — emits events per rule", () => {
    const bus = createLintEventBus();
    const events: string[] = [];
    bus.on("rule:started",   ({ ruleId }) => events.push(`started:${ruleId}`));
    bus.on("rule:passed",    ({ ruleId }) => events.push(`passed:${ruleId}`));
    bus.on("rule:failed",    ({ ruleId }) => events.push(`failed:${ruleId}`));
    bus.on("issue:found",    ({ issue })  => events.push(`issue:${issue.ruleId}`));
    bus.on("lint:completed", ()           => events.push("completed"));

    const alwaysFails: LintRule<unknown> = {
      id: "always-fail", description: "", defaultSeverity: "error",
      check: () => [{ ruleId: "always-fail", severity: "error", message: "fail" }],
    };
    const alwaysPasses: LintRule<unknown> = {
      id: "always-pass", description: "", defaultSeverity: "warning",
      check: () => [],
    };

    runRules({}, [alwaysFails, alwaysPasses], {}, { bus });

    expect(events).toContain("started:always-fail");
    expect(events).toContain("failed:always-fail");
    expect(events).toContain("issue:always-fail");
    expect(events).toContain("started:always-pass");
    expect(events).toContain("passed:always-pass");
    expect(events).toContain("completed");
  });
});

// ─── 2. LintCache ────────────────────────────────────────────────────────────

describe("LintCache + withLintCache + hashDiagramForLint", () => {
  it("stores and retrieves a result", () => {
    const cache = createLintCache();
    const result = makeResult([]);
    cache.set("key1", result);
    expect(cache.get("key1")).toBe(result);
    expect(cache.size).toBe(1);
  });

  it("returns undefined for unknown key", () => {
    const cache = createLintCache();
    expect(cache.get("missing")).toBeUndefined();
  });

  it("evicts oldest entry when maxSize is exceeded", () => {
    const cache = new LintCache({ maxSize: 2 });
    cache.set("a", makeResult([]));
    cache.set("b", makeResult([]));
    cache.set("c", makeResult([])); // evicts "a"
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeDefined();
    expect(cache.get("c")).toBeDefined();
  });

  it("invalidate() removes entry", () => {
    const cache = createLintCache();
    cache.set("x", makeResult([]));
    cache.invalidate("x");
    expect(cache.get("x")).toBeUndefined();
  });

  it("clear() empties the cache", () => {
    const cache = createLintCache();
    cache.set("a", makeResult([]));
    cache.set("b", makeResult([]));
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("withLintCache — second call returns cached result without running again", () => {
    let callCount = 0;
    const runner = (diagram: unknown) => {
      callCount += 1;
      return makeResult([]);
    };
    const cache = createLintCache();
    const cached = withLintCache(runner, cache);

    const diagram = { nodes: [{ id: "n1", type: "Task" }], edges: [] };
    cached(diagram);
    cached(diagram);
    expect(callCount).toBe(1);
  });

  it("hashDiagramForLint produces same key for same topology", () => {
    const d1 = { nodes: [{ id: "a", type: "Task" }, { id: "b", type: "Task" }], edges: [] };
    const d2 = { nodes: [{ id: "b", type: "Task" }, { id: "a", type: "Task" }], edges: [] };
    expect(hashDiagramForLint(d1)).toBe(hashDiagramForLint(d2));
  });

  it("hashDiagramForLint produces different keys for different topologies", () => {
    const d1 = { nodes: [{ id: "a", type: "Task" }], edges: [] };
    const d2 = { nodes: [{ id: "b", type: "Task" }], edges: [] };
    expect(hashDiagramForLint(d1)).not.toBe(hashDiagramForLint(d2));
  });
});

// ─── 3. Serializable lint results ────────────────────────────────────────────

describe("serializeLintResult / deserializeLintResult", () => {
  it("round-trips a lint result", () => {
    const result = makeResult([
      { ruleId: "test/rule", severity: "error", message: "oops", elementId: "node1" },
    ]);
    const json = serializeLintResult(result);
    const back = deserializeLintResult(json);
    expect(back.issues).toHaveLength(1);
    expect(back.errors).toBe(1);
    expect(back.passed).toBe(false);
  });

  it("serialized JSON contains the aranzatech schema marker", () => {
    const json = serializeLintResult(makeResult([]));
    expect(JSON.parse(json).schema).toBe("aranzatech.lint");
  });

  it("throws when schema is invalid", () => {
    expect(() => deserializeLintResult(JSON.stringify({ schema: "wrong" }))).toThrow();
  });

  it("throws when issues array is missing", () => {
    expect(() => deserializeLintResult(JSON.stringify({ schema: "aranzatech.lint", version: 1 }))).toThrow();
  });
});

// ─── 4. Grouping utilities ────────────────────────────────────────────────────

describe("groupIssuesByElement / groupIssuesByCategory / groupIssuesByRule", () => {
  const result = makeResult([
    { ruleId: "r1", severity: "error",   message: "e1", elementId: "n1", category: "structure" },
    { ruleId: "r1", severity: "warning", message: "w1", elementId: "n1", category: "naming" },
    { ruleId: "r2", severity: "error",   message: "e2", elementId: "n2", category: "structure" },
    { ruleId: "r3", severity: "info",    message: "i1" },
  ]);

  it("groupIssuesByElement groups by elementId", () => {
    const map = groupIssuesByElement(result);
    expect(map.get("n1")).toHaveLength(2);
    expect(map.get("n2")).toHaveLength(1);
    expect(map.get("__diagram__")).toHaveLength(1); // no elementId
  });

  it("groupIssuesByCategory groups by category", () => {
    const map = groupIssuesByCategory(result);
    expect(map.get("structure")).toHaveLength(2);
    expect(map.get("naming")).toHaveLength(1);
    expect(map.get("uncategorized")).toHaveLength(1);
  });

  it("groupIssuesByRule groups by ruleId", () => {
    const map = groupIssuesByRule(result);
    expect(map.get("r1")).toHaveLength(2);
    expect(map.get("r2")).toHaveLength(1);
    expect(map.get("r3")).toHaveLength(1);
  });

  it("summarizeByElement produces error/warning/info counts", () => {
    const summary = summarizeByElement(result);
    expect(summary["n1"]).toEqual({ errors: 1, warnings: 1, infos: 0 });
    expect(summary["n2"]).toEqual({ errors: 1, warnings: 0, infos: 0 });
    expect(summary["__diagram__"]).toEqual({ errors: 0, warnings: 0, infos: 1 });
  });
});

// ─── 5. Lint diff ─────────────────────────────────────────────────────────────

describe("diffLintResults", () => {
  it("detects added issues", () => {
    const before = makeResult([]);
    const after = makeResult([{ ruleId: "r1", severity: "error", elementId: "n1" }]);
    const diff = diffLintResults(before, after);
    expect(diff.added).toHaveLength(1);
    expect(diff.resolved).toHaveLength(0);
    expect(diff.unchanged).toHaveLength(0);
  });

  it("detects resolved issues", () => {
    const before = makeResult([{ ruleId: "r1", severity: "error", elementId: "n1" }]);
    const after = makeResult([]);
    const diff = diffLintResults(before, after);
    expect(diff.added).toHaveLength(0);
    expect(diff.resolved).toHaveLength(1);
  });

  it("detects unchanged issues", () => {
    const issue = { ruleId: "r1", severity: "error" as const, elementId: "n1" };
    const before = makeResult([issue]);
    const after = makeResult([issue]);
    const diff = diffLintResults(before, after);
    expect(diff.unchanged).toHaveLength(1);
    expect(diff.added).toHaveLength(0);
    expect(diff.resolved).toHaveLength(0);
  });

  it("treats same ruleId+elementId+severity as same issue", () => {
    const before = makeResult([{ ruleId: "r1", severity: "warning", elementId: "n1", message: "old msg" }]);
    const after = makeResult([{ ruleId: "r1", severity: "warning", elementId: "n1", message: "new msg" }]);
    const diff = diffLintResults(before, after);
    expect(diff.unchanged).toHaveLength(1);
    expect(diff.added).toHaveLength(0);
  });
});
