import { fromBpmnReactFlow } from './chunk-HS7QVBJZ.js';
export { BPMN_DESIGN_PRESET, BPMN_PRESETS, BPMN_RECOMMENDED_PRESET, BPMN_RULES, BPMN_STRICT_PRESET, fromBpmnReactFlow, runBpmnLint } from './chunk-HS7QVBJZ.js';
export { ERD_RULES, runErdLint } from './chunk-7L3LT4MA.js';
export { UML_RULES, runUmlLint } from './chunk-A5YYYXX6.js';
export { C4_RULES, runC4Lint } from './chunk-JE2FDGKX.js';
export { filterIssues, runRules } from './chunk-R2R4ZLF5.js';

// src/core/events.ts
var LintEventBus = class {
  constructor() {
    this.listeners = /* @__PURE__ */ new Map();
  }
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, /* @__PURE__ */ new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }
  once(event, handler) {
    const wrapper = (payload) => {
      this.off(event, wrapper);
      handler(payload);
    };
    return this.on(event, wrapper);
  }
  off(event, handler) {
    this.listeners.get(event)?.delete(handler);
  }
  emit(event, payload) {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const h of handlers) {
      h(payload);
    }
  }
  /** Remove all listeners for a specific event, or all events if omitted. */
  clear(event) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
  /** Number of active listeners for a given event. */
  listenerCount(event) {
    return this.listeners.get(event)?.size ?? 0;
  }
};
function createLintEventBus() {
  return new LintEventBus();
}

// src/core/cache.ts
function hashDiagramForLint(diagram) {
  const d = diagram;
  const nodes = [...d.nodes ?? []].sort((a, b) => a.id.localeCompare(b.id));
  const edges = [...d.edges ?? []].sort(
    (a, b) => `${a.source ?? ""}${a.target ?? ""}`.localeCompare(`${b.source ?? ""}${b.target ?? ""}`)
  );
  const nodeStr = nodes.map((n) => `${n.id}:${n.type ?? ""}`).join("|");
  const edgeStr = edges.map((e) => {
    const cond = (typeof e.conditionExpression === "string" ? e.conditionExpression : "") || (typeof e.data?.conditionExpression === "string" ? e.data.conditionExpression : "");
    const isDef = e.isDefault ?? e.data?.isDefault ? "1" : "0";
    return `${e.source ?? ""}\u2192${e.target ?? ""}:${cond}:${isDef}`;
  }).join("|");
  return `${nodeStr}\xA7${edgeStr}`;
}
var LintCache = class {
  constructor(options = {}) {
    this.entries = /* @__PURE__ */ new Map();
    this.maxSize = options.maxSize ?? 32;
  }
  get(key) {
    const result = this.entries.get(key);
    if (result === void 0) return void 0;
    this.entries.delete(key);
    this.entries.set(key, result);
    return result;
  }
  set(key, result) {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else if (this.entries.size >= this.maxSize) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== void 0) this.entries.delete(oldest);
    }
    this.entries.set(key, result);
  }
  invalidate(key) {
    this.entries.delete(key);
  }
  clear() {
    this.entries.clear();
  }
  get size() {
    return this.entries.size;
  }
};
function createLintCache(options) {
  return new LintCache(options);
}
function withLintCache(runner, cache = createLintCache()) {
  return (diagram, config) => {
    const key = hashDiagramForLint(diagram);
    const cached = cache.get(key);
    if (cached) return cached;
    const result = runner(diagram, config);
    cache.set(key, result);
    return result;
  };
}

// src/core/serialization.ts
function serializeLintResult(result) {
  const doc = {
    schema: "aranzatech.lint",
    version: 1,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    issues: result.issues,
    errors: result.errors,
    warnings: result.warnings,
    infos: result.infos,
    passed: result.passed
  };
  return JSON.stringify(doc, null, 2);
}
function deserializeLintResult(json) {
  const doc = JSON.parse(json);
  if (doc.schema !== "aranzatech.lint") {
    throw new Error(`Invalid lint result schema: "${String(doc.schema)}"`);
  }
  if (!Array.isArray(doc.issues)) {
    throw new Error("Invalid lint result: missing issues array.");
  }
  return {
    issues: doc.issues,
    errors: doc.errors ?? doc.issues.filter((i) => i.severity === "error").length,
    warnings: doc.warnings ?? doc.issues.filter((i) => i.severity === "warning").length,
    infos: doc.infos ?? doc.issues.filter((i) => i.severity === "info").length,
    passed: doc.passed ?? doc.issues.every((i) => i.severity !== "error")
  };
}

// src/core/grouping.ts
function groupIssuesByElement(result) {
  const map = /* @__PURE__ */ new Map();
  for (const issue of result.issues) {
    const key = issue.elementId ?? "__diagram__";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(issue);
  }
  return map;
}
function groupIssuesByCategory(result) {
  const map = /* @__PURE__ */ new Map();
  for (const issue of result.issues) {
    const key = issue.category ?? "uncategorized";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(issue);
  }
  return map;
}
function groupIssuesByRule(result) {
  const map = /* @__PURE__ */ new Map();
  for (const issue of result.issues) {
    const key = issue.ruleId;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(issue);
  }
  return map;
}
function summarizeByElement(result) {
  const summary = {};
  for (const issue of result.issues) {
    const key = issue.elementId ?? "__diagram__";
    if (!summary[key]) summary[key] = { errors: 0, warnings: 0, infos: 0 };
    if (issue.severity === "error") summary[key].errors += 1;
    else if (issue.severity === "warning") summary[key].warnings += 1;
    else if (issue.severity === "info") summary[key].infos += 1;
  }
  return summary;
}

// src/core/diff.ts
function issueKey(issue) {
  return `${issue.ruleId}::${issue.elementId ?? "__"}::${issue.severity}`;
}
function diffLintResults(before, after) {
  const beforeKeys = /* @__PURE__ */ new Map();
  for (const issue of before.issues) {
    beforeKeys.set(issueKey(issue), issue);
  }
  const afterKeys = /* @__PURE__ */ new Map();
  for (const issue of after.issues) {
    afterKeys.set(issueKey(issue), issue);
  }
  const added = [];
  const unchanged = [];
  const resolved = [];
  for (const [key, issue] of afterKeys) {
    if (beforeKeys.has(key)) {
      unchanged.push(issue);
    } else {
      added.push(issue);
    }
  }
  for (const [key, issue] of beforeKeys) {
    if (!afterKeys.has(key)) {
      resolved.push(issue);
    }
  }
  return { added, resolved, unchanged };
}

// src/bpmn/adapters-bpmn-state.ts
function fromBpmnDiagramState(state) {
  return fromBpmnReactFlow({
    nodes: state.nodes,
    edges: state.edges
  });
}

// src/bpmn/tab-order.ts
function getBpmnFlowTabOrder(diagram, scopeId) {
  const sequenceFlows = diagram.edges.filter((e) => e.type === "sequenceFlow");
  const scopedNodes = scopeId ? diagram.nodes.filter((n) => n.id !== scopeId && n.parentId === scopeId) : diagram.nodes.filter((n) => !n.parentId);
  const FLOW_NODE_TYPES = /* @__PURE__ */ new Set([
    "StartEvent",
    "EndEvent",
    "Task",
    "UserTask",
    "ServiceTask",
    "ScriptTask",
    "BusinessRuleTask",
    "ManualTask",
    "ReceiveTask",
    "SendTask",
    "CallActivity",
    "SubProcess",
    "ExclusiveGateway",
    "InclusiveGateway",
    "ParallelGateway",
    "EventBasedGateway",
    "ComplexGateway",
    "IntermediateCatchEvent",
    "IntermediateThrowEvent",
    "BoundaryEvent"
  ]);
  const flowNodes = scopedNodes.filter((n) => FLOW_NODE_TYPES.has(n.type));
  const flowNodeIds = new Set(flowNodes.map((n) => n.id));
  const inDegree = /* @__PURE__ */ new Map();
  for (const n of flowNodes) inDegree.set(n.id, 0);
  for (const e of sequenceFlows) {
    if (flowNodeIds.has(e.source) && flowNodeIds.has(e.target)) {
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    }
  }
  const outgoing = /* @__PURE__ */ new Map();
  for (const n of flowNodes) outgoing.set(n.id, []);
  for (const e of sequenceFlows) {
    if (flowNodeIds.has(e.source) && flowNodeIds.has(e.target)) {
      outgoing.get(e.source)?.push(e.target);
    }
  }
  const startEventIds = flowNodes.filter((n) => n.type === "StartEvent" && (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  const queue = startEventIds.length > 0 ? startEventIds : flowNodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  const ordered = [];
  const visited = /* @__PURE__ */ new Set();
  while (queue.length > 0) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    ordered.push(id);
    for (const next of outgoing.get(id) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  for (const n of flowNodes) {
    if (!visited.has(n.id)) ordered.push(n.id);
  }
  return ordered;
}

export { LintCache, LintEventBus, createLintCache, createLintEventBus, deserializeLintResult, diffLintResults, fromBpmnDiagramState, getBpmnFlowTabOrder, groupIssuesByCategory, groupIssuesByElement, groupIssuesByRule, hashDiagramForLint, serializeLintResult, summarizeByElement, withLintCache };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map