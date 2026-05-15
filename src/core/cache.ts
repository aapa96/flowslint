import type { LintResult } from "./types";

// ─── Topology hash ────────────────────────────────────────────────────────────

interface HashableDiagram {
  nodes?: Array<{ id: string; type?: string }>;
  edges?: Array<{ id?: string; source?: string; target?: string }>;
}

/**
 * Produce a stable string key from a diagram's node/edge topology.
 * Two diagrams with the same node ids, types, and edge connections produce the same hash.
 */
export function hashDiagramForLint(diagram: unknown): string {
  const d = diagram as HashableDiagram;
  const nodes = [...(d.nodes ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const edges = [...(d.edges ?? [])].sort((a, b) =>
    `${a.source ?? ""}${a.target ?? ""}`.localeCompare(`${b.source ?? ""}${b.target ?? ""}`),
  );

  const nodeStr = nodes.map((n) => `${n.id}:${n.type ?? ""}`).join("|");
  const edgeStr = edges.map((e) => `${e.source ?? ""}→${e.target ?? ""}`).join("|");
  return `${nodeStr}§${edgeStr}`;
}

// ─── LintCache ────────────────────────────────────────────────────────────────

export interface LintCacheOptions {
  /** Maximum number of cached results. LRU eviction. Default: 32. */
  maxSize?: number;
}

/**
 * Memoize lint results by diagram topology hash.
 * Identical diagram structures (same node ids, types, edge connections)
 * will return the cached result without re-running rules.
 *
 * ```ts
 * const cache = createLintCache();
 * const cachedRun = withLintCache(runBpmnLint, cache);
 * const result = cachedRun(diagram, config); // first run computed
 * const result2 = cachedRun(diagram, config); // served from cache
 * ```
 */
export class LintCache {
  private readonly maxSize: number;
  private readonly entries = new Map<string, LintResult>();

  constructor(options: LintCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 32;
  }

  get(key: string): LintResult | undefined {
    const result = this.entries.get(key);
    if (result === undefined) return undefined;
    // LRU: re-insert to move to the end
    this.entries.delete(key);
    this.entries.set(key, result);
    return result;
  }

  set(key: string, result: LintResult): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else if (this.entries.size >= this.maxSize) {
      // Evict oldest (first inserted)
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, result);
  }

  invalidate(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

/** Factory — prefer this over `new LintCache()`. */
export function createLintCache(options?: LintCacheOptions): LintCache {
  return new LintCache(options);
}

// ─── withLintCache ────────────────────────────────────────────────────────────

export type LintRunner<TDiagram, TConfig> = (
  diagram: TDiagram,
  config?: TConfig,
) => LintResult;

/**
 * Wrap a lint runner function with topology-based caching.
 * The cache key is derived from `hashDiagramForLint(diagram)`.
 * When the diagram topology is unchanged, the cached result is returned immediately.
 *
 * @param runner - Any lint runner (runBpmnLint, runErdLint, etc.).
 * @param cache  - Shared `LintCache` instance (or a new one is created).
 */
export function withLintCache<TDiagram, TConfig>(
  runner: LintRunner<TDiagram, TConfig>,
  cache: LintCache = createLintCache(),
): LintRunner<TDiagram, TConfig> {
  return (diagram: TDiagram, config?: TConfig): LintResult => {
    const key = hashDiagramForLint(diagram);
    const cached = cache.get(key);
    if (cached) return cached;
    const result = runner(diagram, config);
    cache.set(key, result);
    return result;
  };
}
