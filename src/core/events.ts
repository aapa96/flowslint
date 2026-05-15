import type { LintIssue, LintResult, Severity } from "./types";

// ─── Event map ────────────────────────────────────────────────────────────────

export interface LintEventMap {
  /** Fired before a rule's check() is called. */
  "rule:started": { ruleId: string; severity: Severity };
  /** Fired after a rule produces zero issues. */
  "rule:passed": { ruleId: string };
  /** Fired after a rule produces one or more issues. */
  "rule:failed": { ruleId: string; issues: LintIssue[] };
  /** Fired for each individual issue found. */
  "issue:found": { issue: LintIssue };
  /** Fired after all rules have been evaluated. */
  "lint:completed": { result: LintResult };
}

export type LintEventType = keyof LintEventMap;
export type LintEventPayload<K extends LintEventType> = LintEventMap[K];
export type LintEventHandler<K extends LintEventType> = (payload: LintEventPayload<K>) => void;

// ─── LintEventBus ─────────────────────────────────────────────────────────────

type AnyHandler = (payload: unknown) => void;

/**
 * Typed publish/subscribe event bus for streaming lint execution feedback.
 *
 * Usage:
 * ```ts
 * const bus = createLintEventBus();
 * bus.on("issue:found", ({ issue }) => console.log(issue.message));
 * runBpmnLint(diagram, config, { bus });
 * ```
 */
export class LintEventBus {
  private listeners = new Map<string, Set<AnyHandler>>();

  on<K extends LintEventType>(event: K, handler: LintEventHandler<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as AnyHandler);
    return () => this.off(event, handler);
  }

  once<K extends LintEventType>(event: K, handler: LintEventHandler<K>): () => void {
    const wrapper: LintEventHandler<K> = (payload) => {
      this.off(event, wrapper);
      handler(payload);
    };
    return this.on(event, wrapper);
  }

  off<K extends LintEventType>(event: K, handler: LintEventHandler<K>): void {
    this.listeners.get(event)?.delete(handler as AnyHandler);
  }

  emit<K extends LintEventType>(event: K, payload: LintEventPayload<K>): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const h of handlers) {
      h(payload);
    }
  }

  /** Remove all listeners for a specific event, or all events if omitted. */
  clear(event?: LintEventType): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /** Number of active listeners for a given event. */
  listenerCount(event: LintEventType): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

/** Factory — prefer this over `new LintEventBus()` for testability. */
export function createLintEventBus(): LintEventBus {
  return new LintEventBus();
}
