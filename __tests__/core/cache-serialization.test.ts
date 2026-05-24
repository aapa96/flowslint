import { describe, expect, it, vi } from "vitest";
import {
  LintCache,
  createLintCache,
  hashDiagramForLint,
  withLintCache,
} from "../../src/core/cache";
import {
  serializeLintResult,
  deserializeLintResult,
} from "../../src/core/serialization";
import type { LintResult } from "../../src/core/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeResult(errors = 0): LintResult {
  const issues = errors > 0
    ? [{ ruleId: "test/rule", severity: "error" as const, message: "bad", elementId: "n1", elementType: "Task" }]
    : [];
  return { issues, errors, warnings: 0, infos: 0, passed: errors === 0 };
}

// ─── hashDiagramForLint ──────────────────────────────────────────────────────

describe("hashDiagramForLint", () => {
  it("produces the same hash for identical diagrams", () => {
    const d = { nodes: [{ id: "a", type: "Task" }], edges: [{ id: "e1", source: "a", target: "b" }] };
    expect(hashDiagramForLint(d)).toBe(hashDiagramForLint(d));
  });

  it("produces different hashes for different node sets", () => {
    const d1 = { nodes: [{ id: "a", type: "Task" }], edges: [] };
    const d2 = { nodes: [{ id: "b", type: "Task" }], edges: [] };
    expect(hashDiagramForLint(d1)).not.toBe(hashDiagramForLint(d2));
  });

  it("produces different hashes when conditionExpression differs", () => {
    const base = { nodes: [], edges: [{ id: "e1", source: "a", target: "b", conditionExpression: "x > 0" }] };
    const other = { nodes: [], edges: [{ id: "e1", source: "a", target: "b", conditionExpression: "x > 1" }] };
    expect(hashDiagramForLint(base)).not.toBe(hashDiagramForLint(other));
  });

  it("reads conditionExpression from edge.data when not on edge directly", () => {
    const edgeDirect = { nodes: [], edges: [{ source: "a", target: "b", conditionExpression: "x" }] };
    const edgeData = { nodes: [], edges: [{ source: "a", target: "b", data: { conditionExpression: "x" } }] };
    expect(hashDiagramForLint(edgeDirect)).toBe(hashDiagramForLint(edgeData));
  });

  it("reflects isDefault flag in hash", () => {
    const def = { nodes: [], edges: [{ source: "a", target: "b", isDefault: true }] };
    const notDef = { nodes: [], edges: [{ source: "a", target: "b", isDefault: false }] };
    expect(hashDiagramForLint(def)).not.toBe(hashDiagramForLint(notDef));
  });

  it("handles empty/undefined nodes and edges gracefully", () => {
    expect(() => hashDiagramForLint({})).not.toThrow();
    expect(() => hashDiagramForLint({ nodes: undefined, edges: undefined })).not.toThrow();
  });
});

// ─── LintCache ───────────────────────────────────────────────────────────────

describe("LintCache", () => {
  it("returns undefined for cache miss", () => {
    const cache = new LintCache();
    expect(cache.get("missing")).toBeUndefined();
  });

  it("stores and retrieves a result", () => {
    const cache = new LintCache();
    const result = makeResult();
    cache.set("key1", result);
    expect(cache.get("key1")).toBe(result);
  });

  it("updates size correctly", () => {
    const cache = new LintCache();
    expect(cache.size).toBe(0);
    cache.set("a", makeResult());
    cache.set("b", makeResult(1));
    expect(cache.size).toBe(2);
  });

  it("invalidates a specific key", () => {
    const cache = new LintCache();
    cache.set("k", makeResult());
    cache.invalidate("k");
    expect(cache.get("k")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("clears all entries", () => {
    const cache = new LintCache();
    cache.set("a", makeResult());
    cache.set("b", makeResult(1));
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("evicts the oldest entry (LRU) when maxSize is reached", () => {
    const cache = new LintCache({ maxSize: 3 });
    cache.set("a", makeResult());
    cache.set("b", makeResult());
    cache.set("c", makeResult());
    // Adding a 4th should evict "a" (oldest)
    cache.set("d", makeResult());
    expect(cache.size).toBe(3);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeDefined();
    expect(cache.get("d")).toBeDefined();
  });

  it("re-setting an existing key does not grow beyond maxSize", () => {
    const cache = new LintCache({ maxSize: 2 });
    cache.set("a", makeResult());
    cache.set("b", makeResult());
    // Re-set "a" — should update without evicting "b"
    const updated = makeResult(1);
    cache.set("a", updated);
    expect(cache.size).toBe(2);
    expect(cache.get("a")).toBe(updated);
    expect(cache.get("b")).toBeDefined();
  });

  it("LRU: a recently accessed entry is not evicted", () => {
    const cache = new LintCache({ maxSize: 3 });
    cache.set("a", makeResult());
    cache.set("b", makeResult());
    cache.set("c", makeResult());
    // Access "a" to make it recently used
    cache.get("a");
    // Adding "d" should evict "b" (now oldest), not "a"
    cache.set("d", makeResult());
    expect(cache.get("a")).toBeDefined();
    expect(cache.get("b")).toBeUndefined();
  });

  it("createLintCache factory returns a working cache", () => {
    const cache = createLintCache({ maxSize: 10 });
    expect(cache).toBeInstanceOf(LintCache);
    cache.set("x", makeResult());
    expect(cache.get("x")).toBeDefined();
  });
});

// ─── withLintCache ───────────────────────────────────────────────────────────

describe("withLintCache", () => {
  it("calls runner on first invocation and caches result", () => {
    const runner = vi.fn().mockReturnValue(makeResult());
    const cached = withLintCache(runner);
    const d = { nodes: [{ id: "a", type: "Task" }], edges: [] };

    const r1 = cached(d);
    const r2 = cached(d); // same topology → cache hit

    expect(runner).toHaveBeenCalledTimes(1);
    expect(r1).toBe(r2);
  });

  it("calls runner again when diagram topology changes", () => {
    const runner = vi.fn().mockReturnValue(makeResult());
    const cached = withLintCache(runner);

    cached({ nodes: [{ id: "a", type: "Task" }], edges: [] });
    cached({ nodes: [{ id: "b", type: "Task" }], edges: [] });

    expect(runner).toHaveBeenCalledTimes(2);
  });

  it("accepts an external shared cache", () => {
    const sharedCache = createLintCache();
    const runner = vi.fn().mockReturnValue(makeResult());
    const cached = withLintCache(runner, sharedCache);

    const d = { nodes: [], edges: [] };
    cached(d);
    expect(sharedCache.size).toBe(1);
  });
});

// ─── serializeLintResult / deserializeLintResult ──────────────────────────────

describe("serializeLintResult / deserializeLintResult", () => {
  it("round-trips a result with no issues", () => {
    const result = makeResult();
    const json = serializeLintResult(result);
    const parsed = deserializeLintResult(json);
    expect(parsed.passed).toBe(true);
    expect(parsed.errors).toBe(0);
    expect(parsed.issues).toHaveLength(0);
  });

  it("round-trips a result with errors", () => {
    const result = makeResult(1);
    const json = serializeLintResult(result);
    const parsed = deserializeLintResult(json);
    expect(parsed.passed).toBe(false);
    expect(parsed.errors).toBe(1);
    expect(parsed.issues).toHaveLength(1);
    expect(parsed.issues[0]?.ruleId).toBe("test/rule");
  });

  it("serialized JSON contains the aranzatech.lint schema marker", () => {
    const json = serializeLintResult(makeResult());
    expect(json).toContain('"schema": "aranzatech.lint"');
    expect(json).toContain('"version": 1');
  });

  it("throws on invalid schema", () => {
    const bad = JSON.stringify({ schema: "unknown", issues: [] });
    expect(() => deserializeLintResult(bad)).toThrow(/schema/i);
  });

  it("throws when issues array is missing", () => {
    const bad = JSON.stringify({ schema: "aranzatech.lint", version: 1 });
    expect(() => deserializeLintResult(bad)).toThrow(/issues/i);
  });

  it("infers counts from issues when fields are absent in JSON", () => {
    const raw = {
      schema: "aranzatech.lint",
      version: 1,
      issues: [
        { ruleId: "r", severity: "warning", message: "w", elementId: "n", elementType: "Task" },
      ],
    };
    const parsed = deserializeLintResult(JSON.stringify(raw));
    expect(parsed.warnings).toBe(1);
    expect(parsed.errors).toBe(0);
    expect(parsed.passed).toBe(true);
  });
});
