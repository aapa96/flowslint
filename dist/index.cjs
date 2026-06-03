'use strict';

// src/core/runner.ts
function runRules(diagram, rules, config, options = {}) {
  const { bus } = options;
  const issues = [];
  for (const rule of rules) {
    const override = config.rules?.[rule.id];
    if (override === "off") continue;
    const severity = override ?? rule.defaultSeverity;
    bus?.emit("rule:started", { ruleId: rule.id, severity });
    let found;
    try {
      found = rule.check(diagram);
    } catch {
      found = [{
        ruleId: rule.id,
        severity: "error",
        message: `Rule "${rule.id}" threw an unexpected error.`
      }];
    }
    const enriched = found.map((issue) => {
      const e = { ...issue, code: issue.code ?? rule.id, severity };
      if (!e.category && rule.category) e.category = rule.category;
      if (!e.docsUrl && rule.docsUrl) e.docsUrl = rule.docsUrl;
      return e;
    });
    if (enriched.length === 0) {
      bus?.emit("rule:passed", { ruleId: rule.id });
    } else {
      bus?.emit("rule:failed", { ruleId: rule.id, issues: enriched });
      for (const issue of enriched) {
        bus?.emit("issue:found", { issue });
      }
    }
    issues.push(...enriched);
  }
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;
  const result = { issues, errors, warnings, infos, passed: errors === 0 };
  bus?.emit("lint:completed", { result });
  return result;
}
function filterIssues(result, options = {}) {
  return result.issues.filter((issue) => {
    if (options.severity && issue.severity !== options.severity) return false;
    if (options.elementId && issue.elementId !== options.elementId) return false;
    return true;
  });
}

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

// src/bpmn/rules/start-event-required.ts
function isInsideSubProcess(n, nodeById) {
  if (!n.parentId) return false;
  const parent = nodeById.get(n.parentId);
  if (!parent) return false;
  return parent.type === "SubProcess" ? true : isInsideSubProcess(parent, nodeById);
}
var startEventRequired = {
  id: "bpmn/start-event-required",
  description: "Every process scope must have at least one start event.",
  defaultSeverity: "error",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const pools = nodes.filter((n) => n.type === "Pool");
    if (pools.length === 0) {
      const hasStart = nodes.some(
        (n) => n.type === "StartEvent" && !isInsideSubProcess(n, nodeById)
      );
      return hasStart ? [] : [{ ruleId: "bpmn/start-event-required", severity: "error", message: "El proceso no tiene evento de inicio. Agrega un StartEvent para indicar d\xF3nde comienza el flujo." }];
    }
    const issues = [];
    for (const pool of pools) {
      const laneIds = new Set(nodes.filter((n) => n.type === "Lane" && n.parentId === pool.id).map((n) => n.id));
      const inPool = (n) => n.parentId === pool.id || n.parentId !== void 0 && laneIds.has(n.parentId);
      const hasStart = nodes.some(
        (n) => n.type === "StartEvent" && inPool(n) && !isInsideSubProcess(n, nodeById)
      );
      if (!hasStart) {
        issues.push({
          ruleId: "bpmn/start-event-required",
          severity: "error",
          message: `El pool "${pool.name ?? pool.id}" no tiene evento de inicio. Cada participante en una colaboraci\xF3n necesita su propio StartEvent.`,
          elementId: pool.id,
          elementType: pool.type
        });
      }
    }
    return issues;
  }
};

// src/bpmn/rules/end-event-required.ts
function isInsideSubProcess2(n, nodeById) {
  if (!n.parentId) return false;
  const parent = nodeById.get(n.parentId);
  if (!parent) return false;
  return parent.type === "SubProcess" ? true : isInsideSubProcess2(parent, nodeById);
}
var endEventRequired = {
  id: "bpmn/end-event-required",
  description: "Every process scope must have at least one end event.",
  defaultSeverity: "error",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const pools = nodes.filter((n) => n.type === "Pool");
    if (pools.length === 0) {
      const hasEnd = nodes.some(
        (n) => n.type === "EndEvent" && !isInsideSubProcess2(n, nodeById)
      );
      return hasEnd ? [] : [{ ruleId: "bpmn/end-event-required", severity: "error", message: "El proceso no tiene evento de fin. Agrega un EndEvent para cerrar el flujo." }];
    }
    const issues = [];
    for (const pool of pools) {
      const laneIds = new Set(nodes.filter((n) => n.type === "Lane" && n.parentId === pool.id).map((n) => n.id));
      const inPool = (n) => n.parentId === pool.id || n.parentId !== void 0 && laneIds.has(n.parentId);
      const hasEnd = nodes.some(
        (n) => n.type === "EndEvent" && inPool(n) && !isInsideSubProcess2(n, nodeById)
      );
      if (!hasEnd) {
        issues.push({
          ruleId: "bpmn/end-event-required",
          severity: "error",
          message: `El pool "${pool.name ?? pool.id}" no tiene evento de fin. Cada participante en una colaboraci\xF3n necesita su propio EndEvent.`,
          elementId: pool.id,
          elementType: pool.type
        });
      }
    }
    return issues;
  }
};

// src/bpmn/rules/no-orphan-edges.ts
var noOrphanEdges = {
  id: "bpmn/no-orphan-edges",
  description: "Every edge must reference valid source and target nodes.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const ids = new Set(nodes.map((n) => n.id));
    return edges.filter((e) => !ids.has(e.source) || !ids.has(e.target)).map((e) => ({
      ruleId: "bpmn/no-orphan-edges",
      severity: "error",
      message: `Edge "${e.id}" references a node that does not exist.`,
      elementId: e.id
    }));
  }
};

// src/bpmn/rules/no-self-loop.ts
var noSelfLoop = {
  id: "bpmn/no-self-loop",
  description: "A sequence flow must not connect a node to itself.",
  defaultSeverity: "error",
  check({ edges }) {
    return edges.filter((e) => e.type === "sequenceFlow" && e.source === e.target).map((e) => ({
      ruleId: "bpmn/no-self-loop",
      severity: "error",
      message: `El flujo "${e.id}" conecta un nodo consigo mismo. Un elemento no puede ser su propio origen y destino.`,
      elementId: e.id
    }));
  }
};

// src/bpmn/rules/no-outgoing-from-end-event.ts
var noOutgoingFromEndEvent = {
  id: "bpmn/no-outgoing-from-end-event",
  description: "End events cannot have outgoing sequence flows.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    return nodes.filter((n) => n.type === "EndEvent").filter((n) => edges.some((e) => e.type === "sequenceFlow" && e.source === n.id)).map((n) => ({
      ruleId: "bpmn/no-outgoing-from-end-event",
      severity: "error",
      message: `End event "${n.name ?? n.id}" has an outgoing sequence flow, which is not allowed.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/start-event-no-incoming.ts
var startEventNoIncoming = {
  id: "bpmn/start-event-no-incoming",
  description: "Start events must not have incoming sequence flows.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const targets = new Set(edges.filter((e) => e.type === "sequenceFlow").map((e) => e.target));
    return nodes.filter((n) => n.type === "StartEvent" && targets.has(n.id)).map((n) => ({
      ruleId: "bpmn/start-event-no-incoming",
      severity: "error",
      message: `Start event "${n.name ?? n.id}" has an incoming sequence flow.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/end-event-has-incoming.ts
var endEventHasIncoming = {
  id: "bpmn/end-event-has-incoming",
  description: "Every end event must have at least one incoming sequence flow.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const targets = new Set(edges.filter((e) => e.type === "sequenceFlow").map((e) => e.target));
    return nodes.filter((n) => n.type === "EndEvent" && !targets.has(n.id)).map((n) => ({
      ruleId: "bpmn/end-event-has-incoming",
      severity: "error",
      message: `End event "${n.name ?? n.id}" has no incoming sequence flow.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/intermediate-event-both-flows.ts
var intermediateEventBothFlows = {
  id: "bpmn/intermediate-event-both-flows",
  description: "Intermediate (non-boundary) events must have both an incoming and an outgoing sequence flow.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const issues = [];
    const intermediates = nodes.filter(
      (n) => n.type === "IntermediateCatchEvent" || n.type === "IntermediateThrowEvent"
    );
    for (const n of intermediates) {
      const incoming = edges.filter((e) => e.type === "sequenceFlow" && e.target === n.id);
      const outgoing = edges.filter((e) => e.type === "sequenceFlow" && e.source === n.id);
      if (incoming.length === 0) {
        issues.push({
          ruleId: "bpmn/intermediate-event-both-flows",
          severity: "error",
          message: `El evento intermedio "${n.name ?? n.id}" no tiene conexi\xF3n de entrada. Los eventos intermedios deben conectarse por ambos lados del flujo.`,
          elementId: n.id,
          elementType: n.type
        });
      }
      if (outgoing.length === 0) {
        issues.push({
          ruleId: "bpmn/intermediate-event-both-flows",
          severity: "error",
          message: `El evento intermedio "${n.name ?? n.id}" no tiene conexi\xF3n de salida. Los eventos intermedios deben conectarse por ambos lados del flujo.`,
          elementId: n.id,
          elementType: n.type
        });
      }
    }
    return issues;
  }
};

// src/bpmn/types.ts
var TASK_TYPES = /* @__PURE__ */ new Set([
  "Task",
  "UserTask",
  "ServiceTask",
  "ScriptTask",
  "ManualTask",
  "BusinessRuleTask",
  "ReceiveTask",
  "SendTask",
  "CallActivity"
]);
var GATEWAY_TYPES = /* @__PURE__ */ new Set([
  "ExclusiveGateway",
  "InclusiveGateway",
  "ParallelGateway",
  "EventBasedGateway",
  "ComplexGateway"
]);
var SPLITTING_GATEWAY_TYPES = /* @__PURE__ */ new Set([
  "ExclusiveGateway",
  "InclusiveGateway",
  "ParallelGateway",
  "ComplexGateway"
]);
var JOINING_GATEWAY_TYPES = /* @__PURE__ */ new Set([
  "ExclusiveGateway",
  "InclusiveGateway",
  "ParallelGateway",
  "ComplexGateway"
]);
var EVENT_TYPES = /* @__PURE__ */ new Set([
  "StartEvent",
  "EndEvent",
  "IntermediateCatchEvent",
  "IntermediateThrowEvent",
  "BoundaryEvent"
]);
var FLOW_NODE_TYPES = /* @__PURE__ */ new Set([
  ...TASK_TYPES,
  ...GATEWAY_TYPES,
  ...EVENT_TYPES,
  "SubProcess",
  "Transaction",
  "EventSubProcess",
  "AdHocSubProcess",
  "ChoreographyTask",
  "SubChoreography",
  "CallChoreography"
]);
function isTask(n) {
  return TASK_TYPES.has(n.type);
}
function isJoiningGateway(n) {
  return JOINING_GATEWAY_TYPES.has(n.type);
}
function isSplittingGateway(n) {
  return SPLITTING_GATEWAY_TYPES.has(n.type);
}
function isFlowNode(n) {
  return FLOW_NODE_TYPES.has(n.type);
}
function isContainer(n) {
  return n.type === "Pool" || n.type === "Lane" || n.type === "SubProcess" || n.type === "Transaction" || n.type === "EventSubProcess" || n.type === "AdHocSubProcess" || n.type === "SubConversation" || n.type === "SubChoreography";
}
function isSubProcessLike(n) {
  return n.type === "SubProcess" || n.type === "Transaction" || n.type === "EventSubProcess" || n.type === "AdHocSubProcess";
}
function poolAncestor(n, nodeById) {
  if (!n.parentId) return void 0;
  const parent = nodeById.get(n.parentId);
  if (!parent) return void 0;
  return parent.type === "Pool" ? parent : poolAncestor(parent, nodeById);
}

// src/bpmn/rules/gateway-has-outgoing.ts
var gatewayHasOutgoing = {
  id: "bpmn/gateway-has-outgoing",
  description: "Splitting gateways must have at least 2 outgoing sequence flows.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    return nodes.filter(isSplittingGateway).filter((n) => {
      const outgoing = edges.filter((e) => e.type === "sequenceFlow" && e.source === n.id);
      return outgoing.length < 2;
    }).map((n) => ({
      ruleId: "bpmn/gateway-has-outgoing",
      severity: "error",
      message: `El gateway "${n.name ?? n.id}" necesita al menos 2 flujos de salida. Los gateways deben dividir el camino en m\xFAltiples ramas.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/gateway-has-incoming.ts
var gatewayHasIncoming = {
  id: "bpmn/gateway-has-incoming",
  description: "Joining gateways must have at least 2 incoming sequence flows.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    return nodes.filter(isJoiningGateway).filter((n) => {
      const outgoing = edges.filter((e) => e.type === "sequenceFlow" && e.source === n.id);
      if (outgoing.length >= 2) return false;
      const incoming = edges.filter((e) => e.type === "sequenceFlow" && e.target === n.id);
      return incoming.length < 2;
    }).map((n) => ({
      ruleId: "bpmn/gateway-has-incoming",
      severity: "error",
      message: `El gateway de uni\xF3n "${n.name ?? n.id}" necesita al menos 2 conexiones de entrada para poder hacer la convergencia de flujos.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/flow-node-has-incoming.ts
var EXEMPT = /* @__PURE__ */ new Set([
  "StartEvent",
  "BoundaryEvent",
  "EventSubProcess"
]);
function shouldHaveIncoming(node) {
  return (isTask(node) || isSubProcessLike(node) || node.type === "ChoreographyTask" || node.type === "SubChoreography" || node.type === "CallChoreography") && !EXEMPT.has(node.type);
}
var flowNodeHasIncoming = {
  id: "bpmn/flow-node-has-incoming",
  description: "Flow nodes should have an incoming sequence flow unless BPMN defines them as entry points.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const incoming = /* @__PURE__ */ new Set();
    for (const edge of edges) {
      if (edge.type === "sequenceFlow") incoming.add(edge.target);
    }
    return nodes.filter((node) => shouldHaveIncoming(node) && !incoming.has(node.id)).map((node) => ({
      ruleId: "bpmn/flow-node-has-incoming",
      severity: "error",
      message: `El elemento "${node.name ?? node.id}" no tiene conexi\xF3n de entrada. Con\xE9ctalo desde el nodo anterior del flujo.`,
      elementId: node.id,
      elementType: node.type
    }));
  }
};

// src/bpmn/rules/flow-node-has-outgoing.ts
var EXEMPT2 = /* @__PURE__ */ new Set([
  "EndEvent",
  "BoundaryEvent",
  "EventSubProcess"
]);
function shouldHaveOutgoing(node) {
  return (node.type === "StartEvent" || isTask(node) || isSubProcessLike(node) || node.type === "ChoreographyTask" || node.type === "SubChoreography" || node.type === "CallChoreography") && !EXEMPT2.has(node.type);
}
var flowNodeHasOutgoing = {
  id: "bpmn/flow-node-has-outgoing",
  description: "Flow nodes should have an outgoing sequence flow unless BPMN defines them as terminal points.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const outgoing = /* @__PURE__ */ new Set();
    for (const edge of edges) {
      if (edge.type === "sequenceFlow") outgoing.add(edge.source);
    }
    return nodes.filter((node) => shouldHaveOutgoing(node) && !outgoing.has(node.id)).map((node) => ({
      ruleId: "bpmn/flow-node-has-outgoing",
      severity: "error",
      message: `El elemento "${node.name ?? node.id}" no tiene conexi\xF3n de salida. Con\xE9ctalo hacia el siguiente nodo del flujo.`,
      elementId: node.id,
      elementType: node.type
    }));
  }
};

// src/bpmn/rules/event-based-gateway-min-outgoing.ts
var eventBasedGatewayMinOutgoing = {
  id: "bpmn/event-based-gateway-min-outgoing",
  description: "An event-based gateway must have at least 2 outgoing sequence flows.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    return nodes.filter((n) => n.type === "EventBasedGateway").filter((n) => edges.filter((e) => e.type === "sequenceFlow" && e.source === n.id).length < 2).map((n) => ({
      ruleId: "bpmn/event-based-gateway-min-outgoing",
      severity: "error",
      message: `Event-based gateway "${n.name ?? n.id}" must have at least 2 outgoing sequence flows.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/event-based-gateway-valid-targets.ts
var VALID_TARGETS = /* @__PURE__ */ new Set(["IntermediateCatchEvent", "ReceiveTask"]);
var eventBasedGatewayValidTargets = {
  id: "bpmn/event-based-gateway-valid-targets",
  description: "An event-based gateway may only connect to intermediate catch events or receive tasks.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const issues = [];
    for (const gateway of nodes.filter((n) => n.type === "EventBasedGateway")) {
      const outgoing = edges.filter((e) => e.type === "sequenceFlow" && e.source === gateway.id);
      for (const edge of outgoing) {
        const target = nodeById.get(edge.target);
        if (!target || !VALID_TARGETS.has(target.type)) {
          issues.push({
            ruleId: "bpmn/event-based-gateway-valid-targets",
            severity: "error",
            message: `Event-based gateway "${gateway.name ?? gateway.id}" connects to "${target?.type ?? "unknown"}" ("${edge.target}"). Only IntermediateCatchEvent and ReceiveTask are valid targets.`,
            elementId: gateway.id,
            elementType: gateway.type
          });
        }
      }
    }
    return issues;
  }
};

// src/bpmn/rules/reachable-from-start.ts
function reachableFromStarts(diagram) {
  const outgoing = /* @__PURE__ */ new Map();
  for (const edge of diagram.edges) {
    if (edge.type !== "sequenceFlow") continue;
    outgoing.set(edge.source, [...outgoing.get(edge.source) ?? [], edge.target]);
  }
  const starts = diagram.nodes.filter((node) => node.type === "StartEvent").map((node) => node.id);
  const reachable = /* @__PURE__ */ new Set();
  const queue = [...starts];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || reachable.has(id)) continue;
    reachable.add(id);
    for (const target of outgoing.get(id) ?? []) queue.push(target);
  }
  return reachable;
}
var reachableFromStart = {
  id: "bpmn/reachable-from-start",
  description: "Every flow node should be reachable from at least one start event.",
  defaultSeverity: "warning",
  check(diagram) {
    const hasStart = diagram.nodes.some((node) => node.type === "StartEvent");
    if (!hasStart) return [];
    const reachable = reachableFromStarts(diagram);
    return diagram.nodes.filter((node) => isFlowNode(node) && node.type !== "BoundaryEvent" && !reachable.has(node.id)).map((node) => ({
      ruleId: "bpmn/reachable-from-start",
      severity: "warning",
      message: `El elemento "${node.name ?? node.id}" no es alcanzable desde el inicio del proceso. Verifica que est\xE9 conectado al flujo principal.`,
      elementId: node.id,
      elementType: node.type
    }));
  }
};
var endEventReachable = {
  id: "bpmn/end-event-reachable",
  description: "At least one end event should be reachable from a start event.",
  defaultSeverity: "error",
  check(diagram) {
    const hasStart = diagram.nodes.some((node) => node.type === "StartEvent");
    const endEvents = diagram.nodes.filter((node) => node.type === "EndEvent");
    if (!hasStart || endEvents.length === 0) return [];
    const reachable = reachableFromStarts(diagram);
    if (endEvents.some((node) => reachable.has(node.id))) return [];
    return [{
      ruleId: "bpmn/end-event-reachable",
      severity: "error",
      message: "Ning\xFAn evento de fin es alcanzable desde el inicio. Revisa que el flujo llegue a un EndEvent."
    }];
  }
};

// src/bpmn/rules/sequence-flow-no-cross-pool.ts
var sequenceFlowNoCrossPool = {
  id: "bpmn/sequence-flow-no-cross-pool",
  description: "Sequence flows must not cross pool boundaries \u2014 use message flows instead.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const poolOf = /* @__PURE__ */ new Map();
    const pools = new Set(nodes.filter((n) => n.type === "Pool").map((n) => n.id));
    for (const n of nodes) {
      if (pools.has(n.id)) {
        poolOf.set(n.id, n.id);
      } else if (n.parentId) {
        let cur = n.parentId;
        while (cur && !pools.has(cur)) {
          cur = nodes.find((x) => x.id === cur)?.parentId;
        }
        if (cur) poolOf.set(n.id, cur);
      }
    }
    return edges.filter((e) => {
      if (e.type !== "sequenceFlow") return false;
      const srcPool = poolOf.get(e.source);
      const tgtPool = poolOf.get(e.target);
      return srcPool !== void 0 && tgtPool !== void 0 && srcPool !== tgtPool;
    }).map((e) => ({
      ruleId: "bpmn/sequence-flow-no-cross-pool",
      severity: "error",
      message: `El flujo de secuencia cruza entre dos pools, lo que no es v\xE1lido en BPMN. Usa un messageFlow para comunicar participantes de distintos pools.`,
      elementId: e.id
    }));
  }
};

// src/bpmn/rules/boundary-event-attached.ts
var VALID_HOSTS = /* @__PURE__ */ new Set([
  "Task",
  "UserTask",
  "ServiceTask",
  "ScriptTask",
  "ManualTask",
  "BusinessRuleTask",
  "ReceiveTask",
  "SendTask",
  "SubProcess",
  "CallActivity"
]);
var boundaryEventAttached = {
  id: "bpmn/boundary-event-attached",
  description: "Boundary events must be attached to a task or sub-process.",
  defaultSeverity: "error",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    return nodes.filter((n) => n.type === "BoundaryEvent").filter((n) => {
      if (!n.parentId) return true;
      const host = nodeById.get(n.parentId);
      return !host || !VALID_HOSTS.has(host.type);
    }).map((n) => ({
      ruleId: "bpmn/boundary-event-attached",
      severity: "error",
      message: `Boundary event "${n.name ?? n.id}" is not attached to a task or sub-process.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/subprocess-has-start-end.ts
var subprocessHasStartEnd = {
  id: "bpmn/subprocess-has-start-end",
  description: "Embedded and transaction sub-processes must have start and end events. Event sub-processes must have a triggering start event.",
  defaultSeverity: "error",
  check({ nodes }) {
    const subProcesses = nodes.filter(
      (n) => n.type === "SubProcess" || n.type === "EventSubProcess"
    );
    const issues = [];
    for (const sp of subProcesses) {
      const isEventSubProcess = sp.type === "EventSubProcess";
      const variant = isEventSubProcess ? "event" : sp.subProcessVariant ?? "embedded";
      if (variant === "adhoc") continue;
      const children = nodes.filter((n) => n.parentId === sp.id);
      if (variant === "event") {
        const starts = children.filter((n) => n.type === "StartEvent");
        if (starts.length === 0) {
          issues.push({
            ruleId: "bpmn/subprocess-has-start-end",
            severity: "error",
            message: `Event sub-process "${sp.name ?? sp.id}" must contain a start event with a trigger.`,
            elementId: sp.id,
            elementType: sp.type
          });
        } else {
          for (const s of starts) {
            if (!s.trigger || s.trigger === "none") {
              issues.push({
                ruleId: "bpmn/subprocess-has-start-end",
                severity: "error",
                message: `Event sub-process "${sp.name ?? sp.id}" start event must have a trigger (not "none").`,
                elementId: s.id,
                elementType: s.type
              });
            }
          }
        }
        continue;
      }
      const hasStart = children.some((n) => n.type === "StartEvent");
      const hasEnd = children.some((n) => n.type === "EndEvent");
      if (!hasStart) {
        issues.push({
          ruleId: "bpmn/subprocess-has-start-end",
          severity: "error",
          message: `Sub-process "${sp.name ?? sp.id}" (${variant}) has no start event.`,
          elementId: sp.id,
          elementType: sp.type
        });
      }
      if (!hasEnd) {
        issues.push({
          ruleId: "bpmn/subprocess-has-start-end",
          severity: "error",
          message: `Sub-process "${sp.name ?? sp.id}" (${variant}) has no end event.`,
          elementId: sp.id,
          elementType: sp.type
        });
      }
    }
    return issues;
  }
};

// src/bpmn/rules/link-event-pair.ts
var SUBPROCESS_SCOPE_TYPES = /* @__PURE__ */ new Set([
  "SubProcess",
  "Transaction",
  "EventSubProcess",
  "AdHocSubProcess"
]);
function linkNameOf(node) {
  const raw = node.eventDefinition?.linkName ?? node.name;
  return typeof raw === "string" && raw.trim() ? raw.trim() : void 0;
}
function linkScopeOf(node, nodeById) {
  let current = node.parentId ? nodeById.get(node.parentId) : void 0;
  let topPoolId;
  while (current) {
    if (SUBPROCESS_SCOPE_TYPES.has(current.type)) return `scope:${current.id}`;
    if (current.type === "Pool") topPoolId = current.id;
    current = current.parentId ? nodeById.get(current.parentId) : void 0;
  }
  if (topPoolId) return `pool:${topPoolId}`;
  return "root";
}
var linkEventPair = {
  id: "bpmn/link-event-pair",
  description: "Throw link events must match a unique catch link event with the same name in the same scope.",
  defaultSeverity: "error",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const catchLinks = nodes.filter(
      (n) => n.type === "IntermediateCatchEvent" && (n.eventDefinition?.type ?? n.trigger) === "link"
    );
    const throwLinks = nodes.filter(
      (n) => n.type === "IntermediateThrowEvent" && (n.eventDefinition?.type ?? n.trigger) === "link"
    );
    const issues = [];
    const catchCountByScopeAndName = /* @__PURE__ */ new Map();
    for (const node of catchLinks) {
      const name = linkNameOf(node);
      if (!name) continue;
      const scope = linkScopeOf(node, nodeById);
      const key = `${scope}::${name}`;
      const group = catchCountByScopeAndName.get(key) ?? [];
      group.push(node);
      catchCountByScopeAndName.set(key, group);
    }
    for (const node of catchLinks) {
      const name = linkNameOf(node);
      if (!name) continue;
      const scope = linkScopeOf(node, nodeById);
      const key = `${scope}::${name}`;
      const group = catchCountByScopeAndName.get(key) ?? [];
      if (group.length > 1) {
        issues.push({
          ruleId: "bpmn/link-event-pair",
          severity: "error",
          message: `Catch link event "${name}" appears ${group.length} times in the same scope. BPMN expects a unique catch target per link name.`,
          elementId: node.id,
          elementType: node.type
        });
      }
    }
    for (const node of throwLinks) {
      const name = linkNameOf(node);
      const scope = linkScopeOf(node, nodeById);
      const key = name ? `${scope}::${name}` : void 0;
      const matches = key ? catchCountByScopeAndName.get(key) ?? [] : [];
      if (!name || matches.length === 0) {
        issues.push({
          ruleId: "bpmn/link-event-pair",
          severity: "error",
          message: `Throw link event "${name ?? node.id}" has no matching catch link event with the same name in the same scope.`,
          elementId: node.id,
          elementType: node.type
        });
      }
    }
    return issues;
  }
};

// src/bpmn/rules/cancel-only-in-transaction.ts
var cancelOnlyInTransaction = {
  id: "bpmn/cancel-only-in-transaction",
  description: "Cancel events are only valid inside or attached to a Transaction sub-process.",
  defaultSeverity: "error",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const issues = [];
    const cancelNodes = nodes.filter(
      (n) => n.trigger === "cancel" && (n.type === "EndEvent" || n.type === "BoundaryEvent")
    );
    for (const n of cancelNodes) {
      let cur = n.parentId ? nodeById.get(n.parentId) : void 0;
      let inTransaction = false;
      while (cur) {
        if (cur.type === "SubProcess" && cur.subProcessVariant === "transaction") {
          inTransaction = true;
          break;
        }
        cur = cur.parentId ? nodeById.get(cur.parentId) : void 0;
      }
      if (!inTransaction) {
        issues.push({
          ruleId: "bpmn/cancel-only-in-transaction",
          severity: "error",
          message: `Cancel ${n.type === "EndEvent" ? "end" : "boundary"} event "${n.name ?? n.id}" must be inside or attached to a Transaction sub-process.`,
          elementId: n.id,
          elementType: n.type
        });
      }
    }
    return issues;
  }
};

// src/bpmn/rules/choreography-has-participants.ts
var CHOREOGRAPHY_TYPES = /* @__PURE__ */ new Set(["ChoreographyTask", "SubChoreography", "CallChoreography"]);
var choreographyHasParticipants = {
  id: "bpmn/choreography-has-participants",
  description: "Choreography activities must have at least 2 participant bands.",
  defaultSeverity: "error",
  check({ nodes }) {
    return nodes.filter((n) => CHOREOGRAPHY_TYPES.has(n.type)).filter((n) => !n.participants || n.participants.length < 2).map((n) => ({
      ruleId: "bpmn/choreography-has-participants",
      severity: "error",
      message: `Choreography activity "${n.name ?? n.id}" (${n.type}) must have at least 2 participant bands.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/lane-parent-pool.ts
var laneParentPool = {
  id: "bpmn/lane-parent-pool",
  description: "A Lane must be directly contained by a Pool.",
  defaultSeverity: "error",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    return nodes.filter((n) => n.type === "Lane").filter((n) => {
      if (!n.parentId) return true;
      const parent = nodeById.get(n.parentId);
      return !parent || parent.type !== "Pool";
    }).map((n) => ({
      ruleId: "bpmn/lane-parent-pool",
      severity: "error",
      message: `Lane "${n.name ?? n.id}" must be directly contained by a Pool.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/boundary-no-incoming.ts
var boundaryNoIncoming = {
  id: "bpmn/boundary-no-incoming",
  description: "Boundary events must not have incoming sequence flows.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const sequenceFlows = edges.filter((e) => e.type === "sequenceFlow");
    const targetsWithIncoming = new Set(sequenceFlows.map((e) => e.target));
    return nodes.filter((n) => n.type === "BoundaryEvent" && targetsWithIncoming.has(n.id)).map((n) => ({
      ruleId: "bpmn/boundary-no-incoming",
      severity: "error",
      message: `Boundary event "${n.name ?? n.id}" must not have an incoming sequence flow.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/event-definition-ref-required.ts
function triggerOf(node) {
  return node.eventDefinition?.type ?? node.trigger;
}
var eventDefinitionRefRequired = {
  id: "bpmn/event-definition-ref-required",
  description: "Message, signal, error, and escalation events must reference a declared definition via the appropriate ref field.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const issues = [];
    for (const node of nodes) {
      const trigger = triggerOf(node);
      if (trigger === "message" && !node.eventDefinition?.messageRef) {
        issues.push({
          ruleId: "bpmn/event-definition-ref-required",
          severity: "warning",
          message: `Message event "${node.name ?? node.id}" must set a message reference.`,
          elementId: node.id,
          elementType: node.type
        });
      }
      if (trigger === "signal" && !node.eventDefinition?.signalRef) {
        issues.push({
          ruleId: "bpmn/event-definition-ref-required",
          severity: "warning",
          message: `Signal event "${node.name ?? node.id}" must set a signal reference.`,
          elementId: node.id,
          elementType: node.type
        });
      }
      if (trigger === "error" && !node.eventDefinition?.errorRef) {
        issues.push({
          ruleId: "bpmn/event-definition-ref-required",
          severity: "warning",
          message: `Error event "${node.name ?? node.id}" must set an error reference.`,
          elementId: node.id,
          elementType: node.type
        });
      }
      if (trigger === "escalation" && !node.eventDefinition?.escalationRef) {
        issues.push({
          ruleId: "bpmn/event-definition-ref-required",
          severity: "warning",
          message: `Escalation event "${node.name ?? node.id}" must set an escalation reference.`,
          elementId: node.id,
          elementType: node.type
        });
      }
    }
    return issues;
  }
};

// src/bpmn/rules/event-trigger-compatible.ts
function triggerOf2(node) {
  return node.eventDefinition?.type ?? node.trigger;
}
var ALLOWED_TRIGGERS = {
  StartEvent: /* @__PURE__ */ new Set(["none", "message", "timer", "conditional", "signal", "multiple", "parallelMultiple"]),
  EndEvent: /* @__PURE__ */ new Set(["none", "message", "signal", "error", "escalation", "terminate", "compensation", "cancel", "multiple"]),
  IntermediateCatchEvent: /* @__PURE__ */ new Set(["none", "message", "timer", "conditional", "signal", "link", "multiple", "parallelMultiple"]),
  IntermediateThrowEvent: /* @__PURE__ */ new Set(["none", "message", "signal", "link", "escalation", "compensation", "multiple"]),
  BoundaryEvent: /* @__PURE__ */ new Set(["message", "timer", "conditional", "signal", "error", "escalation", "cancel", "compensation"])
};
var eventTriggerCompatible = {
  id: "bpmn/event-trigger-compatible",
  description: "Each BPMN event base type only allows a subset of triggers.",
  defaultSeverity: "error",
  check({ nodes }) {
    const issues = [];
    for (const node of nodes) {
      if (node.type !== "StartEvent" && node.type !== "EndEvent" && node.type !== "IntermediateCatchEvent" && node.type !== "IntermediateThrowEvent" && node.type !== "BoundaryEvent") {
        continue;
      }
      const trigger = triggerOf2(node);
      if (!trigger) continue;
      if (!ALLOWED_TRIGGERS[node.type].has(trigger)) {
        issues.push({
          ruleId: "bpmn/event-trigger-compatible",
          severity: "error",
          message: `El evento "${node.name ?? node.id}" (${node.type}) no admite el trigger "${trigger}". Revisa el subtipo BPMN seleccionado.`,
          elementId: node.id,
          elementType: node.type
        });
      }
    }
    return issues;
  }
};

// src/bpmn/rules/event-subprocess-start-compatible.ts
var ALLOWED_EVENT_SUBPROCESS_START_TRIGGERS = /* @__PURE__ */ new Set([
  "message",
  "timer",
  "escalation",
  "conditional",
  "error",
  "compensation",
  "signal",
  "multiple",
  "parallelMultiple"
]);
var NON_INTERRUPTIBLE_EVENT_SUBPROCESS_START_TRIGGERS = /* @__PURE__ */ new Set([
  "message",
  "timer",
  "escalation",
  "conditional",
  "signal",
  "multiple",
  "parallelMultiple"
]);
var eventSubprocessStartCompatible = {
  id: "bpmn/event-subprocess-start-compatible",
  description: "Event sub-process start events must use a valid trigger and only supported non-interrupting variants.",
  defaultSeverity: "error",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const issues = [];
    const eventSubprocessStarts = nodes.filter((node) => {
      if (node.type !== "StartEvent" || !node.parentId) return false;
      const parent = nodeById.get(node.parentId);
      return parent?.type === "EventSubProcess" || parent?.subProcessVariant === "event";
    });
    for (const start of eventSubprocessStarts) {
      const trigger = start.eventDefinition?.type ?? start.trigger;
      if (!trigger || trigger === "none") continue;
      if (!ALLOWED_EVENT_SUBPROCESS_START_TRIGGERS.has(trigger)) {
        issues.push({
          ruleId: "bpmn/event-subprocess-start-compatible",
          severity: "error",
          message: `El StartEvent "${start.name ?? start.id}" dentro de un EventSubProcess no admite el trigger "${trigger}".`,
          elementId: start.id,
          elementType: start.type
        });
        continue;
      }
      if (start.isNonInterrupting === true && !NON_INTERRUPTIBLE_EVENT_SUBPROCESS_START_TRIGGERS.has(trigger)) {
        issues.push({
          ruleId: "bpmn/event-subprocess-start-compatible",
          severity: "error",
          message: `El StartEvent no interruptivo "${start.name ?? start.id}" dentro de un EventSubProcess no admite el trigger "${trigger}".`,
          elementId: start.id,
          elementType: start.type
        });
      }
    }
    return issues;
  }
};

// src/bpmn/rules/gateway-single-default.ts
var CONDITION_GATEWAYS = /* @__PURE__ */ new Set([
  "ExclusiveGateway",
  "InclusiveGateway",
  "ComplexGateway"
]);
var gatewaySingleDefault = {
  id: "bpmn/gateway-single-default",
  description: "A gateway may have at most one default outgoing sequence flow.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const issues = [];
    const sequenceFlows = edges.filter((e) => e.type === "sequenceFlow");
    for (const node of nodes.filter((n) => CONDITION_GATEWAYS.has(n.type))) {
      const outgoing = sequenceFlows.filter((e) => e.source === node.id);
      const defaultEdges = outgoing.filter((e) => e.isDefault);
      if (defaultEdges.length > 1) {
        issues.push({
          ruleId: "bpmn/gateway-single-default",
          severity: "error",
          message: `Gateway "${node.name ?? node.id}" has ${defaultEdges.length} default outgoing flows; only one is allowed.`,
          elementId: node.id,
          elementType: node.type
        });
      }
    }
    return issues;
  }
};

// src/bpmn/rules/boundary-non-interrupting-compatible.ts
function triggerOf3(node) {
  return node.eventDefinition?.type ?? node.trigger;
}
var NON_INTERRUPTIBLE_BOUNDARY_TRIGGERS = /* @__PURE__ */ new Set([
  "error",
  "cancel",
  "compensation"
]);
var boundaryNonInterruptingCompatible = {
  id: "bpmn/boundary-non-interrupting-compatible",
  description: "Non-interrupting boundary events are not valid for error, cancel, or compensation triggers.",
  defaultSeverity: "error",
  check({ nodes }) {
    return nodes.filter((node) => node.type === "BoundaryEvent" && node.isNonInterrupting === true).filter((node) => NON_INTERRUPTIBLE_BOUNDARY_TRIGGERS.has(triggerOf3(node) ?? "")).map((node) => ({
      ruleId: "bpmn/boundary-non-interrupting-compatible",
      severity: "error",
      message: `El boundary event "${node.name ?? node.id}" no puede ser no interruptivo cuando usa trigger "${triggerOf3(node)}".`,
      elementId: node.id,
      elementType: node.type
    }));
  }
};

// src/bpmn/rules/pool-children-inside-lanes.ts
var poolChildrenInsideLanes = {
  id: "bpmn/pool-children-inside-lanes",
  description: "When a Pool contains Lanes, all flow nodes should be placed inside a Lane.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const issues = [];
    const pools = nodes.filter((n) => n.type === "Pool");
    for (const pool of pools) {
      const directChildren = nodes.filter((n) => n.parentId === pool.id);
      const lanes = directChildren.filter((n) => n.type === "Lane");
      if (lanes.length === 0) continue;
      const looseFlowNodes = directChildren.filter(
        (n) => n.type !== "Lane" && FLOW_NODE_TYPES.has(n.type)
      );
      if (looseFlowNodes.length > 0) {
        issues.push({
          ruleId: "bpmn/pool-children-inside-lanes",
          severity: "warning",
          message: `Pool "${pool.name ?? pool.id}" has lanes; place flow nodes inside a lane instead of directly in the pool.`,
          elementId: pool.id,
          elementType: pool.type
        });
      }
    }
    return issues;
  }
};

// src/bpmn/rules/process-node-outside-participant.ts
var processNodeOutsideParticipant = {
  id: "bpmn/process-node-outside-participant",
  description: "In a collaboration diagram (one or more Pools present), flow nodes should be placed inside a participant.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const hasPools = nodes.some((n) => n.type === "Pool");
    if (!hasPools) return [];
    return nodes.filter(
      (n) => !n.parentId && FLOW_NODE_TYPES.has(n.type) && n.type !== "BoundaryEvent"
    ).map((n) => ({
      ruleId: "bpmn/process-node-outside-participant",
      severity: "warning",
      message: `Flow node "${n.name ?? n.id}" is outside any pool. In a collaboration, place it inside a participant.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/boundary-has-outgoing.ts
var boundaryHasOutgoing = {
  id: "bpmn/boundary-has-outgoing",
  description: "Boundary events should have at least one outgoing sequence flow to model the exception path.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    const sequenceFlows = edges.filter((e) => e.type === "sequenceFlow");
    const sourcesWithOutgoing = new Set(sequenceFlows.map((e) => e.source));
    return nodes.filter((n) => n.type === "BoundaryEvent" && !sourcesWithOutgoing.has(n.id)).map((n) => ({
      ruleId: "bpmn/boundary-has-outgoing",
      severity: "warning",
      message: `Boundary event "${n.name ?? n.id}" has no outgoing sequence flow; model at least one exception path.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/scope-single-start.ts
var SCOPE_TYPES = /* @__PURE__ */ new Set(["SubProcess", "Transaction", "EventSubProcess", "AdHocSubProcess"]);
var scopeSingleStart = {
  id: "bpmn/scope-single-start",
  description: "A sub-process or scope should contain at most one start event.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const issues = [];
    const scopes = nodes.filter((n) => SCOPE_TYPES.has(n.type));
    for (const scope of scopes) {
      const starts = nodes.filter(
        (n) => n.parentId === scope.id && n.type === "StartEvent"
      );
      if (starts.length > 1) {
        issues.push({
          ruleId: "bpmn/scope-single-start",
          severity: "warning",
          message: `Scope "${scope.name ?? scope.id}" has ${starts.length} start events; review whether multiple triggers are intended.`,
          elementId: scope.id,
          elementType: scope.type
        });
      }
    }
    return issues;
  }
};

// src/bpmn/rules/no-disconnected-nodes.ts
var EXEMPT3 = /* @__PURE__ */ new Set([
  "Pool",
  "Lane",
  "Annotation",
  "Group",
  "DataObject",
  "DataStore"
]);
var noDisconnectedNodes = {
  id: "bpmn/no-disconnected-nodes",
  description: "Every flow node must have at least one sequence flow connection.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    const connected = /* @__PURE__ */ new Set();
    for (const e of edges) {
      if (e.type === "sequenceFlow") {
        connected.add(e.source);
        connected.add(e.target);
      }
    }
    return nodes.filter((n) => !EXEMPT3.has(n.type) && !isContainer(n) && !connected.has(n.id)).map((n) => ({
      ruleId: "bpmn/no-disconnected-nodes",
      severity: "warning",
      message: `El elemento "${n.name ?? n.id}" est\xE1 desconectado del proceso. Con\xE9ctalo al flujo con una secuencia de entrada y salida.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/no-implicit-split.ts
var noImplicitSplit = {
  id: "bpmn/no-implicit-split",
  description: "A task with more than one outgoing sequence flow is an implicit split \u2014 use a gateway.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    return nodes.filter((n) => isTask(n)).filter((n) => edges.filter((e) => e.type === "sequenceFlow" && e.source === n.id).length > 1).map((n) => ({
      ruleId: "bpmn/no-implicit-split",
      severity: "warning",
      message: `El elemento "${n.name ?? n.id}" tiene m\xFAltiples flujos de salida. Usa un gateway expl\xEDcito (ExclusiveGateway o ParallelGateway) para modelar la divisi\xF3n.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/no-implicit-join.ts
var noImplicitJoin = {
  id: "bpmn/no-implicit-join",
  description: "A task or intermediate event with multiple incoming flows is an implicit join \u2014 use a gateway.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    return nodes.filter(
      (n) => isTask(n) || n.type === "IntermediateCatchEvent" || n.type === "IntermediateThrowEvent"
    ).filter((n) => edges.filter((e) => e.type === "sequenceFlow" && e.target === n.id).length > 1).map((n) => ({
      ruleId: "bpmn/no-implicit-join",
      severity: "warning",
      message: `El elemento "${n.name ?? n.id}" tiene m\xFAltiples flujos de entrada. Usa un gateway expl\xEDcito para modelar la convergencia.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/no-multiple-start-events.ts
function isInsideSubProcess3(n, nodeById) {
  if (!n.parentId) return false;
  const parent = nodeById.get(n.parentId);
  if (!parent) return false;
  return parent.type === "SubProcess" ? true : isInsideSubProcess3(parent, nodeById);
}
var noMultipleStartEvents = {
  id: "bpmn/no-multiple-start-events",
  description: "A process scope should have at most one start event.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const pools = nodes.filter((n) => n.type === "Pool");
    const issues = [];
    if (pools.length === 0) {
      const starts = nodes.filter(
        (n) => n.type === "StartEvent" && !isInsideSubProcess3(n, nodeById)
      );
      if (starts.length > 1) {
        for (const n of starts) {
          issues.push({
            ruleId: "bpmn/no-multiple-start-events",
            severity: "warning",
            message: `The process has ${starts.length} start events at process level. Consider consolidating into one.`,
            elementId: n.id,
            elementType: n.type
          });
        }
      }
      return issues;
    }
    for (const pool of pools) {
      const laneIds = new Set(nodes.filter((n) => n.type === "Lane" && n.parentId === pool.id).map((n) => n.id));
      const inPool = (n) => n.parentId === pool.id || n.parentId !== void 0 && laneIds.has(n.parentId);
      const starts = nodes.filter(
        (n) => n.type === "StartEvent" && inPool(n) && !isInsideSubProcess3(n, nodeById)
      );
      if (starts.length > 1) {
        for (const n of starts) {
          issues.push({
            ruleId: "bpmn/no-multiple-start-events",
            severity: "warning",
            message: `Pool "${pool.name ?? pool.id}" has ${starts.length} start events. Consider consolidating into one.`,
            elementId: n.id,
            elementType: n.type
          });
        }
      }
    }
    return issues;
  }
};

// src/bpmn/rules/no-empty-pool.ts
var noEmptyPool = {
  id: "bpmn/no-empty-pool",
  description: "A pool must contain at least one flow node.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const pools = nodes.filter((n) => n.type === "Pool");
    if (pools.length === 0) return [];
    const lanesByPool = /* @__PURE__ */ new Map();
    for (const pool of pools) {
      lanesByPool.set(pool.id, nodes.filter((n) => n.type === "Lane" && n.parentId === pool.id).map((n) => n.id));
    }
    return pools.filter((pool) => {
      const laneIds = new Set(lanesByPool.get(pool.id) ?? []);
      const hasFlowNode = nodes.some(
        (n) => isFlowNode(n) && (n.parentId === pool.id || n.parentId !== void 0 && laneIds.has(n.parentId))
      );
      return !hasFlowNode;
    }).map((pool) => ({
      ruleId: "bpmn/no-empty-pool",
      severity: "warning",
      message: `El pool "${pool.name ?? pool.id}" est\xE1 vac\xEDo. Agrega al menos un evento de inicio, tarea o evento de fin.`,
      elementId: pool.id,
      elementType: pool.type
    }));
  }
};

// src/bpmn/rules/task-has-name.ts
var taskHasName = {
  id: "bpmn/task-has-name",
  description: "Every task should have a non-empty name.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter((n) => isTask(n) && !n.name?.trim()).map((n) => ({
      ruleId: "bpmn/task-has-name",
      severity: "warning",
      message: `La tarea "${n.id}" no tiene nombre. As\xEDgnale un nombre descriptivo para que el proceso sea legible.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/gateway-has-name.ts
var DECISION_GATEWAYS = /* @__PURE__ */ new Set(["ExclusiveGateway", "InclusiveGateway"]);
var gatewayHasName = {
  id: "bpmn/gateway-has-name",
  description: "Exclusive and inclusive gateways should be named with the decision question they represent.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter((n) => DECISION_GATEWAYS.has(n.type) && !n.name?.trim()).map((n) => ({
      ruleId: "bpmn/gateway-has-name",
      severity: "warning",
      message: `El gateway "${n.id}" no tiene nombre. As\xEDgnale un nombre que describa la condici\xF3n que eval\xFAa (ej: "\xBFAprobado?").`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/exclusive-gateway-condition.ts
var CONDITIONAL_GATEWAYS = /* @__PURE__ */ new Set(["ExclusiveGateway", "InclusiveGateway", "ComplexGateway"]);
var exclusiveGatewayCondition = {
  id: "bpmn/exclusive-gateway-condition",
  description: "Non-default outgoing flows of ExclusiveGateway, InclusiveGateway, and ComplexGateway must have a condition expression.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    const issues = [];
    const conditionalGateways = nodes.filter((n) => CONDITIONAL_GATEWAYS.has(n.type));
    for (const gw of conditionalGateways) {
      const outgoing = edges.filter((e) => e.type === "sequenceFlow" && e.source === gw.id);
      if (outgoing.length < 2) continue;
      for (const edge of outgoing) {
        if (!edge.isDefault && !edge.conditionExpression) {
          issues.push({
            ruleId: "bpmn/exclusive-gateway-condition",
            severity: "warning",
            message: `El flujo de salida del gateway "${gw.name ?? gw.id}" no tiene condici\xF3n definida. Etiqueta cada rama (ej: "Aprobado", "Rechazado") o m\xE1rcalo como flujo por defecto.`,
            elementId: edge.id
          });
        }
      }
    }
    return issues;
  }
};

// src/bpmn/rules/cyclomatic-complexity.ts
var DECISION_GATEWAYS2 = /* @__PURE__ */ new Set([
  "ExclusiveGateway",
  "InclusiveGateway",
  "ComplexGateway",
  "EventBasedGateway"
]);
var THRESHOLD = 10;
var cyclomaticComplexity = {
  id: "bpmn/cyclomatic-complexity",
  description: `Process has more than ${THRESHOLD} decision gateways. Consider splitting into sub-processes.`,
  defaultSeverity: "info",
  check({ nodes }) {
    const topLevelDecisions = nodes.filter(
      (n) => DECISION_GATEWAYS2.has(n.type) && !n.parentId
    );
    if (topLevelDecisions.length <= THRESHOLD) return [];
    return [
      {
        ruleId: "bpmn/cyclomatic-complexity",
        severity: "info",
        message: `El proceso tiene ${topLevelDecisions.length} gateways de decisi\xF3n (l\xEDmite recomendado: ${THRESHOLD}). Considera dividirlo en sub-procesos para facilitar su mantenimiento.`,
        elementId: "process"
      }
    ];
  }
};

// src/bpmn/rules/long-process.ts
var THRESHOLD2 = 20;
var longProcess = {
  id: "bpmn/long-process",
  description: `Process has more than ${THRESHOLD2} tasks at the top level. Consider grouping into sub-processes.`,
  defaultSeverity: "info",
  check({ nodes }) {
    const topLevelTasks = nodes.filter(
      (n) => TASK_TYPES.has(n.type) && !n.parentId
    );
    if (topLevelTasks.length <= THRESHOLD2) return [];
    return [
      {
        ruleId: "bpmn/long-process",
        severity: "info",
        message: `El proceso tiene ${topLevelTasks.length} tareas en el nivel principal (l\xEDmite recomendado: ${THRESHOLD2}). Considera agrupar tareas relacionadas en sub-procesos.`,
        elementId: "process"
      }
    ];
  }
};

// src/bpmn/rules/annotation-has-text.ts
var annotationHasText = {
  id: "bpmn/annotation-has-text",
  description: "Text annotations should contain text.",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes.filter((n) => n.type === "Annotation" && !n.name?.trim()).map((n) => ({
      ruleId: "bpmn/annotation-has-text",
      severity: "info",
      message: `Text annotation "${n.id}" is empty.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/no-duplicate-sequence-flow.ts
var noDuplicateSequenceFlow = {
  id: "bpmn/no-duplicate-sequence-flow",
  description: "Two sequence flows with the same source and target are a duplication.",
  defaultSeverity: "error",
  check({ edges }) {
    const sequenceFlows = edges.filter((e) => e.type === "sequenceFlow");
    const seen = /* @__PURE__ */ new Map();
    return sequenceFlows.flatMap((e) => {
      const key = `${e.source}\u2192${e.target}`;
      const existing = seen.get(key);
      if (existing) {
        return [
          {
            ruleId: "bpmn/no-duplicate-sequence-flow",
            severity: "error",
            message: `Duplicate sequence flow from "${e.source}" to "${e.target}" (duplicates "${existing}").`,
            elementId: e.id
          }
        ];
      }
      seen.set(key, e.id);
      return [];
    });
  }
};

// src/bpmn/rules/message-flow-valid-endpoints.ts
var messageFlowValidEndpoints = {
  id: "bpmn/message-flow-valid-endpoints",
  description: "A MessageFlow must connect elements in distinct pools.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const messageFlows = edges.filter((e) => e.type === "messageFlow");
    return messageFlows.flatMap((e) => {
      const sourceNode = nodeById.get(e.source);
      const targetNode = nodeById.get(e.target);
      if (!sourceNode || !targetNode) return [];
      const sourcePool = poolAncestor(sourceNode, nodeById);
      const targetPool = poolAncestor(targetNode, nodeById);
      if (sourcePool && targetPool && sourcePool.id === targetPool.id) {
        return [
          {
            ruleId: "bpmn/message-flow-valid-endpoints",
            severity: "error",
            message: `El messageFlow conecta dos elementos dentro del mismo pool "${sourcePool.name ?? sourcePool.id}". Los mensajes solo pueden cruzar entre pools distintos.`,
            elementId: e.id
          }
        ];
      }
      if (!sourcePool && !targetPool) {
        return [
          {
            ruleId: "bpmn/message-flow-valid-endpoints",
            severity: "error",
            message: `El messageFlow conecta elementos fuera de cualquier pool. Los mensajes deben cruzar entre dos pools participantes.`,
            elementId: e.id
          }
        ];
      }
      return [];
    });
  }
};

// src/bpmn/rules/compensation-flow-target.ts
var compensationFlowTarget = {
  id: "bpmn/compensation-flow-target",
  description: "A compensation BoundaryEvent should have an outgoing association to a compensation Task or SubProcess.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    const compensationBoundaries = nodes.filter(
      (n) => n.type === "BoundaryEvent" && n.trigger === "compensation"
    );
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    return compensationBoundaries.flatMap((boundary) => {
      const hasCompensationTarget = edges.some((e) => {
        if (e.type !== "association" || e.source !== boundary.id) return false;
        const target = nodeById.get(e.target);
        if (!target) return false;
        const isTaskOrSubProcess = target.type === "Task" || target.type === "SubProcess" || target.type === "UserTask" || target.type === "ServiceTask" || target.type === "ScriptTask" || target.type === "ManualTask" || target.type === "BusinessRuleTask" || target.type === "ReceiveTask" || target.type === "SendTask" || target.type === "CallActivity";
        if (!isTaskOrSubProcess) return false;
        return target.markers?.includes("compensation") ?? false;
      });
      if (hasCompensationTarget) return [];
      return [
        {
          ruleId: "bpmn/compensation-flow-target",
          severity: "warning",
          message: `Compensation BoundaryEvent "${boundary.name ?? boundary.id}" has no association to a compensation-marked Task or SubProcess.`,
          elementId: boundary.id,
          elementType: boundary.type
        }
      ];
    });
  }
};

// src/bpmn/rules/data-object-connected.ts
var DATA_TYPES = /* @__PURE__ */ new Set([
  "DataObject",
  "DataObjectReference",
  "DataInput",
  "DataOutput",
  "DataStore",
  "DataStoreReference"
]);
var dataObjectConnected = {
  id: "bpmn/data-object-connected",
  description: "DataObject, DataObjectReference, DataInput, DataOutput, DataStore and DataStoreReference should be connected via a dataAssociation edge.",
  defaultSeverity: "info",
  check({ nodes, edges }) {
    const dataNodes = nodes.filter((n) => DATA_TYPES.has(n.type));
    return dataNodes.flatMap((n) => {
      const connected = edges.some(
        (e) => e.type === "dataAssociation" && (e.source === n.id || e.target === n.id)
      );
      if (connected) return [];
      return [
        {
          ruleId: "bpmn/data-object-connected",
          severity: "info",
          message: `${n.type} "${n.name ?? n.id}" is not connected to any flow via a dataAssociation.`,
          elementId: n.id,
          elementType: n.type
        }
      ];
    });
  }
};

// src/bpmn/rules/data-reference-target-exists.ts
var dataReferenceTargetExists = {
  id: "bpmn/data-reference-target-exists",
  description: "DataObjectReference and DataStoreReference should point to an existing backing data element when an explicit ref is provided.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const nodeIds = new Set(nodes.map((node) => node.id));
    return nodes.flatMap((node) => {
      if (node.type === "DataObjectReference" && node.dataObjectRef && !nodeIds.has(node.dataObjectRef)) {
        return [{
          ruleId: "bpmn/data-reference-target-exists",
          severity: "warning",
          message: `La referencia de datos "${node.name ?? node.id}" apunta a dataObjectRef="${node.dataObjectRef}" pero ese DataObject no existe en el diagrama.`,
          elementId: node.id,
          elementType: node.type
        }];
      }
      if (node.type === "DataStoreReference" && node.dataStoreRef && !nodeIds.has(node.dataStoreRef)) {
        return [{
          ruleId: "bpmn/data-reference-target-exists",
          severity: "warning",
          message: `La referencia de almac\xE9n "${node.name ?? node.id}" apunta a dataStoreRef="${node.dataStoreRef}" pero ese DataStore no existe en el diagrama.`,
          elementId: node.id,
          elementType: node.type
        }];
      }
      return [];
    });
  }
};

// src/bpmn/rules/sequence-flow-valid-endpoints.ts
var sequenceFlowValidEndpoints = {
  id: "bpmn/sequence-flow-valid-endpoints",
  description: "Sequence flows must connect BPMN flow nodes.",
  defaultSeverity: "error",
  category: "modeling",
  check({ nodes, edges }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    return edges.flatMap((edge) => {
      if (edge.type !== "sequenceFlow") return [];
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) return [];
      if (!isFlowNode(source) || !isFlowNode(target)) {
        return [{
          ruleId: "bpmn/sequence-flow-valid-endpoints",
          severity: "error",
          message: `Sequence flow "${edge.name ?? edge.id}" must connect BPMN flow nodes.`,
          elementId: edge.id,
          elementType: edge.type,
          relatedElementIds: [edge.source, edge.target],
          quickFixes: [{
            id: "convert-to-association-or-message-flow",
            label: "Use a BPMN-compatible edge type"
          }]
        }];
      }
      return [];
    });
  }
};

// src/bpmn/rules/data-association-valid-endpoints.ts
var DATA_TYPES2 = /* @__PURE__ */ new Set([
  "DataObject",
  "DataObjectReference",
  "DataInput",
  "DataOutput",
  "DataStore",
  "DataStoreReference"
]);
var dataAssociationValidEndpoints = {
  id: "bpmn/data-association-valid-endpoints",
  description: "Data associations must connect data elements to BPMN flow nodes.",
  defaultSeverity: "error",
  category: "modeling",
  check({ nodes, edges }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    return edges.flatMap((edge) => {
      if (edge.type !== "dataAssociation") return [];
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) return [];
      const sourceIsData = DATA_TYPES2.has(source.type);
      const targetIsData = DATA_TYPES2.has(target.type);
      const sourceIsFlow = isFlowNode(source);
      const targetIsFlow = isFlowNode(target);
      const valid = sourceIsData && targetIsFlow || sourceIsFlow && targetIsData;
      if (valid) return [];
      return [{
        ruleId: "bpmn/data-association-valid-endpoints",
        severity: "error",
        message: `Data association "${edge.name ?? edge.id}" must connect one data element and one BPMN flow node.`,
        elementId: edge.id,
        elementType: edge.type,
        relatedElementIds: [edge.source, edge.target],
        quickFixes: [{
          id: "connect-data-to-flow-node",
          label: "Reconnect data association"
        }]
      }];
    });
  }
};

// src/bpmn/rules/event-definition-payload-required.ts
function triggerOf4(node) {
  return node.eventDefinition?.type ?? node.trigger;
}
var eventDefinitionPayloadRequired = {
  id: "bpmn/event-definition-payload-required",
  description: "Certain BPMN event definitions require additional payload such as refs, expressions, or link names.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const issues = [];
    for (const node of nodes) {
      const trigger = triggerOf4(node);
      if (!trigger || trigger === "none") continue;
      if (trigger === "timer" && !node.eventDefinition?.timer?.value?.trim()) {
        issues.push({
          ruleId: "bpmn/event-definition-payload-required",
          severity: "warning",
          message: `Timer event "${node.name ?? node.id}" requires a timer expression.`,
          elementId: node.id,
          elementType: node.type
        });
      }
      if (trigger === "conditional" && !node.eventDefinition?.conditionExpression?.trim()) {
        issues.push({
          ruleId: "bpmn/event-definition-payload-required",
          severity: "warning",
          message: `Conditional event "${node.name ?? node.id}" requires a condition expression.`,
          elementId: node.id,
          elementType: node.type
        });
      }
      if (trigger === "link" && !(node.eventDefinition?.linkName?.trim() || node.name?.trim())) {
        issues.push({
          ruleId: "bpmn/event-definition-payload-required",
          severity: "warning",
          message: `Link event "${node.name ?? node.id}" requires a link name.`,
          elementId: node.id,
          elementType: node.type
        });
      }
    }
    return issues;
  }
};

// src/bpmn/rules/event-definition-ref-declared.ts
function triggerOf5(node) {
  return node.eventDefinition?.type ?? node.trigger;
}
var eventDefinitionRefDeclared = {
  id: "bpmn/event-definition-ref-declared",
  description: "Message, signal, error, and escalation event references should point to declared global definitions.",
  defaultSeverity: "error",
  check({ nodes, definitions }) {
    const messageIds = new Set((definitions?.messages ?? []).map((item) => item.id));
    const signalIds = new Set((definitions?.signals ?? []).map((item) => item.id));
    const errorIds = new Set((definitions?.errors ?? []).map((item) => item.id));
    const escalationIds = new Set((definitions?.escalations ?? []).map((item) => item.id));
    const issues = [];
    for (const node of nodes) {
      const trigger = triggerOf5(node);
      if (trigger === "message") {
        const ref = node.eventDefinition?.messageRef;
        if (ref && messageIds.size > 0 && !messageIds.has(ref)) {
          issues.push({
            ruleId: "bpmn/event-definition-ref-declared",
            severity: "error",
            message: `Message event "${node.name ?? node.id}" references undeclared message "${ref}".`,
            elementId: node.id,
            elementType: node.type
          });
        }
      }
      if (trigger === "signal") {
        const ref = node.eventDefinition?.signalRef;
        if (ref && signalIds.size > 0 && !signalIds.has(ref)) {
          issues.push({
            ruleId: "bpmn/event-definition-ref-declared",
            severity: "error",
            message: `Signal event "${node.name ?? node.id}" references undeclared signal "${ref}".`,
            elementId: node.id,
            elementType: node.type
          });
        }
      }
      if (trigger === "error") {
        const ref = node.eventDefinition?.errorRef;
        if (ref && errorIds.size > 0 && !errorIds.has(ref)) {
          issues.push({
            ruleId: "bpmn/event-definition-ref-declared",
            severity: "error",
            message: `Error event "${node.name ?? node.id}" references undeclared error "${ref}".`,
            elementId: node.id,
            elementType: node.type
          });
        }
      }
      if (trigger === "escalation") {
        const ref = node.eventDefinition?.escalationRef;
        if (ref && escalationIds.size > 0 && !escalationIds.has(ref)) {
          issues.push({
            ruleId: "bpmn/event-definition-ref-declared",
            severity: "error",
            message: `Escalation event "${node.name ?? node.id}" references undeclared escalation "${ref}".`,
            elementId: node.id,
            elementType: node.type
          });
        }
      }
    }
    return issues;
  }
};

// src/bpmn/rules/aranza/task-has-owner.ts
var taskHasOwner = {
  id: "bpmn/aranza/task-has-owner",
  description: "Every task should declare an owner for accountability.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter((n) => isTask(n) && !n.owner?.trim()).map((n) => ({
      ruleId: "bpmn/aranza/task-has-owner",
      severity: "warning",
      message: `La tarea "${n.name ?? n.id}" no tiene responsable asignado. Asigna un usuario o rol en el panel de propiedades.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/aranza/critical-task-has-sla.ts
var criticalTaskHasSla = {
  id: "bpmn/aranza/critical-task-has-sla",
  description: "Tasks with priority 'critical' must have an SLA defined.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter((n) => isTask(n) && n.priority === "critical" && !n.sla?.trim()).map((n) => ({
      ruleId: "bpmn/aranza/critical-task-has-sla",
      severity: "warning",
      message: `Task "${n.id}" (${n.type}) is critical but has no SLA defined.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/aranza/sla-format.ts
var ISO_8601_DURATION = /^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/;
function isValidDuration(value) {
  if (!ISO_8601_DURATION.test(value)) return false;
  return value !== "P" && value !== "PT";
}
var slaFormat = {
  id: "bpmn/aranza/sla-format",
  description: "The SLA field must be a valid ISO 8601 duration (e.g. PT4H, P1DT2H).",
  defaultSeverity: "error",
  check({ nodes }) {
    return nodes.filter((n) => n.sla != null && n.sla.trim() !== "" && !isValidDuration(n.sla.trim())).map((n) => ({
      ruleId: "bpmn/aranza/sla-format",
      severity: "error",
      message: `Task "${n.id}" has an invalid SLA value "${n.sla}". Expected ISO 8601 duration (e.g. PT4H, P1DT2H).`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/aranza/automatable-task-action.ts
var AUTOMATABLE_TASK_TYPES = /* @__PURE__ */ new Set([
  "Task",
  "ServiceTask",
  "ScriptTask",
  "BusinessRuleTask",
  "SendTask",
  "ReceiveTask"
]);
var automatableTaskAction = {
  id: "bpmn/aranza/automatable-task-action",
  description: "Automatable tasks must define both connector and action.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter((n) => AUTOMATABLE_TASK_TYPES.has(n.type)).filter((n) => !n.connector || !n.action).map((n) => ({
      ruleId: "bpmn/aranza/automatable-task-action",
      severity: "warning",
      message: `La tarea "${n.name ?? n.id}" es automatizable pero no tiene conector ni acci\xF3n configurados. Def\xEDnelos en el panel de propiedades.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/aranza/service-task-config.ts
function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function connectorConfigured(config) {
  if (!config) return false;
  return (hasValue(config.connectorInstanceId) || hasValue(config.connectorId)) && hasValue(config.connectorAction);
}
function httpConfigured(config) {
  if (!config) return false;
  return hasValue(config.httpMethod) && hasValue(config.endpoint);
}
function webServiceConfigured(config) {
  if (!config) return false;
  return hasValue(config.operationRef);
}
function legacyFlowableConfigured(node) {
  return hasValue(node.flowableType) || hasValue(node.flowableDelegateExpression);
}
function legacyConnectorConfigured(node) {
  return hasValue(node.connector) && hasValue(node.action);
}
function messageFor(node) {
  const config = node.serviceConfig;
  const implementation = config?.implementation;
  if (implementation === "connector") {
    if (!connectorConfigured(config) && !legacyConnectorConfigured(node)) {
      return `La tarea de servicio "${node.name ?? node.id}" usa implementaci\xF3n por conector pero le falta conexi\xF3n y/o acci\xF3n. Define connectorInstanceId o connectorId, y connectorAction.`;
    }
    return null;
  }
  if (implementation === "http") {
    if (!httpConfigured(config)) {
      return `La tarea de servicio "${node.name ?? node.id}" usa implementaci\xF3n HTTP pero le falta m\xE9todo y/o endpoint. Completa httpMethod y endpoint.`;
    }
    return null;
  }
  if (implementation === "webService") {
    if (!webServiceConfigured(config)) {
      return `La tarea de servicio "${node.name ?? node.id}" usa implementaci\xF3n Web Service pero no tiene operationRef.`;
    }
    return null;
  }
  if (implementation === "none") {
    if (!legacyFlowableConfigured(node)) {
      return `La tarea de servicio "${node.name ?? node.id}" est\xE1 marcada sin implementaci\xF3n y no define configuraci\xF3n Flowable legacy. Usa flowableType o flowableDelegateExpression, o selecciona otro tipo de implementaci\xF3n.`;
    }
    return null;
  }
  if (connectorConfigured(config) || legacyConnectorConfigured(node) || httpConfigured(config) || webServiceConfigured(config) || legacyFlowableConfigured(node)) {
    return null;
  }
  return `La tarea de servicio "${node.name ?? node.id}" no tiene configuraci\xF3n de ejecuci\xF3n. Define un conector, HTTP, Web Service o configuraci\xF3n Flowable en las propiedades.`;
}
var serviceTaskConfig = {
  id: "bpmn/aranza/service-task-config",
  description: "ServiceTask must have execution config consistent with the selected implementation mode.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter((node) => node.type === "ServiceTask").flatMap((node) => {
      const message = messageFor(node);
      if (!message) return [];
      return [{
        ruleId: "bpmn/aranza/service-task-config",
        severity: "warning",
        message,
        elementId: node.id,
        elementType: node.type
      }];
    });
  }
};

// src/bpmn/rules/aranza/adhoc-has-completion-condition.ts
var adhocHasCompletionCondition = {
  id: "bpmn/aranza/adhoc-has-completion-condition",
  description: "AdHocSubProcess elements should define a completion condition.",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes.filter((n) => n.type === "AdHocSubProcess").filter((n) => !n.completionCondition).map((n) => ({
      ruleId: "bpmn/aranza/adhoc-has-completion-condition",
      severity: "info",
      message: `AdHocSubProcess "${n.name ?? n.id}" has no completion condition \u2014 it will require manual completion.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/aranza/user-task-has-form.ts
var userTaskHasForm = {
  id: "bpmn/aranza/user-task-has-form",
  description: "UserTask elements should define a formKey to link a form for data capture.",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes.filter((n) => n.type === "UserTask").filter((n) => !n.formKey).map((n) => ({
      ruleId: "bpmn/aranza/user-task-has-form",
      severity: "info",
      message: `La tarea de usuario "${n.name ?? n.id}" no tiene formulario asignado. Sin formulario, los operadores completar\xE1n la tarea sin gu\xEDa.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/aranza/user-task-has-due-date.ts
var userTaskHasDueDate = {
  id: "bpmn/aranza/user-task-has-due-date",
  description: "UserTask elements should define a dueDate to ensure timely completion.",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes.filter((n) => n.type === "UserTask").filter((n) => !n.dueDate?.trim()).map((n) => ({
      ruleId: "bpmn/aranza/user-task-has-due-date",
      severity: "info",
      message: `La tarea de usuario "${n.name ?? n.id}" no tiene fecha l\xEDmite. Sin una fecha de vencimiento, la tarea puede quedar sin atender indefinidamente.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/aranza/user-task-has-assignment.ts
function hasValue2(value) {
  return typeof value === "string" && value.trim().length > 0;
}
var userTaskHasAssignment = {
  id: "bpmn/aranza/user-task-has-assignment",
  description: "UserTask should define at least one assignment strategy so someone can act on it.",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes.filter((n) => n.type === "UserTask").filter((n) => !hasValue2(n.owner) && !hasValue2(n.candidateUsers) && !hasValue2(n.candidateGroups)).map((n) => ({
      ruleId: "bpmn/aranza/user-task-has-assignment",
      severity: "info",
      message: `La tarea de usuario "${n.name ?? n.id}" no tiene estrategia de asignaci\xF3n. Define owner, candidateUsers o candidateGroups para que alguien pueda atenderla.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/aranza/multi-instance-has-cardinality.ts
var multiInstanceHasCardinality = {
  id: "bpmn/aranza/multi-instance-has-cardinality",
  description: "Multi-instance tasks must define a loop cardinality expression.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter(
      (n) => n.loopType === "sequentialMultiple" || n.loopType === "parallelMultiple"
    ).filter((n) => !n.loopCardinality?.trim()).map((n) => ({
      ruleId: "bpmn/aranza/multi-instance-has-cardinality",
      severity: "warning",
      message: `La tarea "${n.name ?? n.id}" es multi-instancia pero no tiene cardinalidad definida. Define una expresi\xF3n de cardinalidad para controlar el n\xFAmero de instancias.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/aranza/business-rule-task-has-decision.ts
function hasInlineDecisionTable(table) {
  if (!table) return false;
  return table.inputs.length > 0 && table.outputs.length > 0 && table.rules.length > 0;
}
var businessRuleTaskHasDecision = {
  id: "bpmn/aranza/business-rule-task-has-decision",
  description: "BusinessRuleTask must reference a DMN decision table or define a minimally valid inline decision table.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter((n) => n.type === "BusinessRuleTask").filter((n) => !n.decisionRef?.trim() && !hasInlineDecisionTable(n.inlineDecisionTable)).map((n) => ({
      ruleId: "bpmn/aranza/business-rule-task-has-decision",
      severity: "warning",
      message: `La tarea de regla de negocio "${n.name ?? n.id}" no tiene una decisi\xF3n utilizable. Define decisionRef o completa una tabla inline con inputs, outputs y al menos una regla.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/aranza/call-activity-has-called-element.ts
var callActivityHasCalledElement = {
  id: "bpmn/aranza/call-activity-has-called-element",
  description: "CallActivity must reference the id of the process or global task it invokes.",
  defaultSeverity: "error",
  check({ nodes }) {
    return nodes.filter((n) => n.type === "CallActivity").filter((n) => !n.calledElement?.trim()).map((n) => ({
      ruleId: "bpmn/aranza/call-activity-has-called-element",
      severity: "error",
      message: `La actividad de llamada "${n.name ?? n.id}" no tiene un proceso referenciado. Define el campo calledElement en las propiedades.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/aranza/call-activity-called-element-format.ts
var callActivityCalledElementFormat = {
  id: "bpmn/aranza/call-activity-called-element-format",
  description: "CallActivity should use a stable, publishable calledElement identifier without spaces.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter((n) => n.type === "CallActivity").filter((n) => {
      const calledElement = n.calledElement?.trim();
      return Boolean(calledElement) && /\s/.test(calledElement);
    }).map((n) => ({
      ruleId: "bpmn/aranza/call-activity-called-element-format",
      severity: "warning",
      message: `La actividad de llamada "${n.name ?? n.id}" usa un calledElement con espacios. Usa un identificador publicable y estable, por ejemplo "Process_OrderFulfillment".`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/aranza/receive-task-message-context.ts
var receiveTaskMessageContext = {
  id: "bpmn/aranza/receive-task-message-context",
  description: "ReceiveTask should be contextualized by an incoming message flow or an event-based gateway branch.",
  defaultSeverity: "info",
  check({ nodes, edges }) {
    return nodes.filter((node) => node.type === "ReceiveTask").filter((node) => {
      const hasIncomingMessageFlow = edges.some((edge) => edge.type === "messageFlow" && edge.target === node.id);
      const isTargetOfEventBasedGateway = edges.some((edge) => {
        if (edge.type !== "sequenceFlow" || edge.target !== node.id) return false;
        const source = nodes.find((candidate) => candidate.id === edge.source);
        return source?.type === "EventBasedGateway";
      });
      return !hasIncomingMessageFlow && !isTargetOfEventBasedGateway;
    }).map((node) => ({
      ruleId: "bpmn/aranza/receive-task-message-context",
      severity: "info",
      message: `La tarea de recepci\xF3n "${node.name ?? node.id}" no muestra de d\xF3nde llega el mensaje. Con\xE9ctala con un messageFlow entrante o con una rama de EventBasedGateway para hacer expl\xEDcito el contexto.`,
      elementId: node.id,
      elementType: node.type
    }));
  }
};

// src/bpmn/rules/aranza/send-task-message-context.ts
var sendTaskMessageContext = {
  id: "bpmn/aranza/send-task-message-context",
  description: "SendTask should expose the outbound interaction through a message flow.",
  defaultSeverity: "info",
  check({ nodes, edges }) {
    return nodes.filter((node) => node.type === "SendTask").filter((node) => !edges.some((edge) => edge.type === "messageFlow" && edge.source === node.id)).map((node) => ({
      ruleId: "bpmn/aranza/send-task-message-context",
      severity: "info",
      message: `La tarea de env\xEDo "${node.name ?? node.id}" no tiene un messageFlow saliente. Agrega el intercambio para hacer visible qu\xE9 participante recibe el mensaje.`,
      elementId: node.id,
      elementType: node.type
    }));
  }
};

// src/bpmn/rules/aranza/script-task-has-format.ts
var scriptTaskHasFormat = {
  id: "bpmn/aranza/script-task-has-format",
  description: "ScriptTask should declare a scriptFormat (e.g. 'javascript', 'groovy').",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter((n) => n.type === "ScriptTask").filter((n) => !n.scriptFormat?.trim()).map((n) => ({
      ruleId: "bpmn/aranza/script-task-has-format",
      severity: "warning",
      message: `La tarea de script "${n.name ?? n.id}" no tiene formato de script definido. Especifica el lenguaje (javascript, groovy, etc.) en las propiedades.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/aranza/script-task-has-script.ts
var scriptTaskHasScript = {
  id: "bpmn/aranza/script-task-has-script",
  description: "ScriptTask should define a script body or expression to execute.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter((n) => n.type === "ScriptTask").filter((n) => !n.script?.trim()).map((n) => ({
      ruleId: "bpmn/aranza/script-task-has-script",
      severity: "warning",
      message: `La tarea de script "${n.name ?? n.id}" no tiene contenido ejecutable. Define el script o expresi\xF3n que debe ejecutarse.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/aranza/variable-exists.ts
var VARIABLE_PATTERN = /\{\{\s*([A-Za-z_][\w.]*)\s*\}\}|\$\{\s*([A-Za-z_][\w.]*)\s*\}/g;
function asString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : void 0;
}
function collectDeclaredVariables(diagram) {
  const declared = /* @__PURE__ */ new Set();
  for (const variable of diagram.definitions?.variables ?? []) {
    if (typeof variable?.name === "string" && variable.name.trim()) {
      declared.add(variable.name.trim());
    }
  }
  for (const node of diagram.nodes) {
    for (const item of node.variables ?? []) {
      if (typeof item === "string" && item.trim()) declared.add(item.trim());
      if (item && typeof item === "object" && typeof item.name === "string" && item.name.trim()) {
        declared.add(item.name.trim());
      }
    }
    const output = asString(node.outputVariable) ?? asString(node.resultVariable);
    if (output) declared.add(output);
  }
  return declared;
}
function collectVariableUsages(value, acc) {
  if (typeof value === "string") {
    for (const match of value.matchAll(VARIABLE_PATTERN)) {
      const name = match[1] ?? match[2];
      if (name) acc.add(name);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectVariableUsages(item, acc);
    return;
  }
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) {
      collectVariableUsages(nested, acc);
    }
  }
}
function declaredInNode(node) {
  const names = /* @__PURE__ */ new Set();
  for (const item of node.variables ?? []) {
    if (typeof item === "string" && item.trim()) names.add(item.trim());
    if (item && typeof item === "object" && typeof item.name === "string" && item.name.trim()) {
      names.add(item.name.trim());
    }
  }
  const output = asString(node.outputVariable) ?? asString(node.resultVariable);
  if (output) names.add(output);
  return names;
}
var variableExists = {
  id: "bpmn/aranza/variable-exists",
  description: "Variables referenced in expressions must be declared in the process or produced by a node.",
  defaultSeverity: "warning",
  check(diagram) {
    const declared = collectDeclaredVariables(diagram);
    return diagram.nodes.flatMap((node) => {
      const localDeclarations = declaredInNode(node);
      const referenced = /* @__PURE__ */ new Set();
      collectVariableUsages(node, referenced);
      return [...referenced].filter((name) => !declared.has(name) && !localDeclarations.has(name)).map((name) => ({
        ruleId: "bpmn/aranza/variable-exists",
        severity: "warning",
        message: `La variable "${name}" usada en "${node.name ?? node.id}" no est\xE1 declarada.`,
        elementId: node.id,
        elementType: node.type
      }));
    });
  }
};

// src/bpmn/runner.ts
var BPMN_RULES = [
  // Structural errors
  startEventRequired,
  endEventRequired,
  noOrphanEdges,
  noSelfLoop,
  noOutgoingFromEndEvent,
  startEventNoIncoming,
  endEventHasIncoming,
  intermediateEventBothFlows,
  gatewayHasOutgoing,
  gatewayHasIncoming,
  flowNodeHasIncoming,
  flowNodeHasOutgoing,
  eventBasedGatewayMinOutgoing,
  eventBasedGatewayValidTargets,
  endEventReachable,
  sequenceFlowNoCrossPool,
  boundaryEventAttached,
  subprocessHasStartEnd,
  linkEventPair,
  cancelOnlyInTransaction,
  choreographyHasParticipants,
  laneParentPool,
  boundaryNoIncoming,
  boundaryNonInterruptingCompatible,
  eventSubprocessStartCompatible,
  gatewaySingleDefault,
  noDuplicateSequenceFlow,
  messageFlowValidEndpoints,
  sequenceFlowValidEndpoints,
  dataAssociationValidEndpoints,
  eventDefinitionRefDeclared,
  eventTriggerCompatible,
  // Best-practice warnings
  poolChildrenInsideLanes,
  processNodeOutsideParticipant,
  boundaryHasOutgoing,
  scopeSingleStart,
  noDisconnectedNodes,
  reachableFromStart,
  noImplicitSplit,
  noImplicitJoin,
  noMultipleStartEvents,
  noEmptyPool,
  taskHasName,
  gatewayHasName,
  exclusiveGatewayCondition,
  compensationFlowTarget,
  eventDefinitionPayloadRequired,
  eventDefinitionRefRequired,
  // Informational hints
  cyclomaticComplexity,
  longProcess,
  annotationHasText,
  dataObjectConnected,
  dataReferenceTargetExists,
  // AranzaFlows extensions
  taskHasOwner,
  criticalTaskHasSla,
  slaFormat,
  automatableTaskAction,
  serviceTaskConfig,
  adhocHasCompletionCondition,
  userTaskHasForm,
  userTaskHasDueDate,
  userTaskHasAssignment,
  multiInstanceHasCardinality,
  businessRuleTaskHasDecision,
  callActivityHasCalledElement,
  callActivityCalledElementFormat,
  receiveTaskMessageContext,
  sendTaskMessageContext,
  scriptTaskHasFormat,
  scriptTaskHasScript,
  variableExists
];
var DEFAULT_CONFIG = {
  rules: Object.fromEntries(BPMN_RULES.map((r) => [r.id, r.defaultSeverity]))
};
var BPMN_RECOMMENDED_PRESET = {
  name: "recommended",
  description: "Balanced BPMN linting for active modeling.",
  rules: { ...DEFAULT_CONFIG.rules }
};
var BPMN_STRICT_PRESET = {
  name: "strict",
  description: "Stricter BPMN linting for publish/export gates.",
  rules: {
    ...DEFAULT_CONFIG.rules,
    "bpmn/no-multiple-start-events": "error",
    "bpmn/task-has-name": "error",
    "bpmn/gateway-has-name": "warning",
    "bpmn/data-object-connected": "warning",
    "bpmn/data-reference-target-exists": "warning",
    "bpmn/aranza/task-has-owner": "error",
    "bpmn/aranza/critical-task-has-sla": "error",
    "bpmn/aranza/service-task-config": "error",
    "bpmn/aranza/automatable-task-action": "warning",
    "bpmn/aranza/call-activity-has-called-element": "error",
    "bpmn/aranza/call-activity-called-element-format": "warning",
    "bpmn/aranza/receive-task-message-context": "info",
    "bpmn/aranza/send-task-message-context": "info",
    "bpmn/aranza/business-rule-task-has-decision": "error",
    "bpmn/aranza/script-task-has-format": "warning",
    "bpmn/aranza/script-task-has-script": "warning",
    "bpmn/aranza/user-task-has-assignment": "info",
    "bpmn/aranza/multi-instance-has-cardinality": "warning",
    "bpmn/aranza/user-task-has-due-date": "info",
    "bpmn/aranza/variable-exists": "warning"
  }
};
var BPMN_DESIGN_PRESET = {
  name: "design",
  description: "Softer BPMN hints while users are still sketching.",
  rules: {
    ...DEFAULT_CONFIG.rules,
    "bpmn/task-has-name": "info",
    "bpmn/gateway-has-name": "info",
    "bpmn/data-object-connected": "off",
    "bpmn/data-reference-target-exists": "off",
    "bpmn/no-disconnected-nodes": "info",
    "bpmn/no-multiple-start-events": "info",
    "bpmn/aranza/task-has-owner": "off",
    "bpmn/aranza/critical-task-has-sla": "off",
    "bpmn/aranza/automatable-task-action": "off",
    "bpmn/aranza/service-task-config": "off",
    "bpmn/aranza/adhoc-has-completion-condition": "off",
    "bpmn/aranza/user-task-has-due-date": "off",
    "bpmn/aranza/multi-instance-has-cardinality": "off",
    "bpmn/aranza/business-rule-task-has-decision": "off",
    "bpmn/aranza/call-activity-has-called-element": "off",
    "bpmn/aranza/call-activity-called-element-format": "off",
    "bpmn/aranza/receive-task-message-context": "off",
    "bpmn/aranza/send-task-message-context": "off",
    "bpmn/aranza/script-task-has-format": "off",
    "bpmn/aranza/script-task-has-script": "off",
    "bpmn/aranza/user-task-has-assignment": "off",
    "bpmn/aranza/variable-exists": "off"
  }
};
var BPMN_PRESETS = {
  recommended: BPMN_RECOMMENDED_PRESET,
  strict: BPMN_STRICT_PRESET,
  design: BPMN_DESIGN_PRESET
};
function resolvePreset(config) {
  if (!config.preset) return BPMN_RECOMMENDED_PRESET;
  if (typeof config.preset === "string") return BPMN_PRESETS[config.preset];
  return config.preset;
}
function runBpmnLint(diagram, config = {}) {
  const preset = resolvePreset(config);
  const merged = {
    rules: { ...preset.rules, ...config.rules }
  };
  return runRules(diagram, BPMN_RULES, merged, { ...config.bus !== void 0 ? { bus: config.bus } : {} });
}

// src/bpmn/adapters.ts
function asString2(value) {
  return typeof value === "string" ? value : void 0;
}
function asBoolean(value) {
  return typeof value === "boolean" ? value : void 0;
}
function asStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : void 0;
}
function asProcessVariables(value) {
  if (!Array.isArray(value)) return void 0;
  const variables = value.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item;
    return typeof candidate.name === "string" && candidate.name.trim().length > 0;
  }).map((item) => {
    const variable = { name: item.name };
    const id = asString2(item.id);
    const type = asString2(item.type);
    const defaultValue = asString2(item.defaultValue);
    const description = asString2(item.description);
    if (id) variable.id = id;
    if (type === "string" || type === "integer" || type === "boolean" || type === "date" || type === "object" || type === "array") {
      variable.type = type;
    }
    if (defaultValue) variable.defaultValue = defaultValue;
    if (description) variable.description = description;
    return variable;
  });
  return variables.length > 0 ? variables : void 0;
}
function asNodeVariableRefs(value) {
  if (!Array.isArray(value)) return void 0;
  const variables = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      variables.push(item);
      continue;
    }
    if (item && typeof item === "object") {
      const name = asString2(item.name);
      if (name) variables.push({ name });
    }
  }
  return variables.length > 0 ? variables : void 0;
}
function asServiceTaskConfig(value) {
  if (!value || typeof value !== "object") return void 0;
  const candidate = value;
  const implementation = asString2(candidate.implementation);
  const connectorParams = candidate.connectorParams;
  const httpMethod = asString2(candidate.httpMethod);
  const endpoint = asString2(candidate.endpoint);
  const connectorAction = asString2(candidate.connectorAction);
  const connectorId = asString2(candidate.connectorId);
  const connectorInstanceId = asString2(candidate.connectorInstanceId);
  const operationRef = asString2(candidate.operationRef);
  const config = {};
  if (implementation === "none" || implementation === "connector" || implementation === "http" || implementation === "webService") {
    config.implementation = implementation;
  }
  if (connectorParams && typeof connectorParams === "object" && !Array.isArray(connectorParams) && Object.values(connectorParams).every((item) => typeof item === "string")) {
    config.connectorParams = connectorParams;
  }
  if (httpMethod === "GET" || httpMethod === "POST" || httpMethod === "PUT" || httpMethod === "DELETE" || httpMethod === "PATCH") {
    config.httpMethod = httpMethod;
  }
  if (endpoint) config.endpoint = endpoint;
  if (connectorAction) config.connectorAction = connectorAction;
  if (connectorId) config.connectorId = connectorId;
  if (connectorInstanceId) config.connectorInstanceId = connectorInstanceId;
  if (operationRef) config.operationRef = operationRef;
  return Object.keys(config).length > 0 ? config : void 0;
}
function asInlineDecisionTable(value) {
  if (!value || typeof value !== "object") return void 0;
  const candidate = value;
  const hitPolicy = asString2(candidate.hitPolicy);
  if (hitPolicy !== "FIRST" && hitPolicy !== "UNIQUE" && hitPolicy !== "COLLECT") {
    return void 0;
  }
  const inputs = Array.isArray(candidate.inputs) ? candidate.inputs : [];
  const outputs = Array.isArray(candidate.outputs) ? candidate.outputs : [];
  const rules = Array.isArray(candidate.rules) ? candidate.rules : [];
  return {
    hitPolicy,
    inputs: inputs.filter((item) => Boolean(item && typeof item === "object")),
    outputs: outputs.filter((item) => Boolean(item && typeof item === "object")),
    rules: rules.filter((item) => Boolean(item && typeof item === "object"))
  };
}
function asParticipants(value) {
  if (!Array.isArray(value)) return void 0;
  return value.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item;
    return typeof candidate.name === "string" && typeof candidate.isInitiating === "boolean";
  }).map((item) => ({ name: item.name, isInitiating: item.isInitiating }));
}
function asTimerDefinition(value) {
  if (!value || typeof value !== "object") return void 0;
  const candidate = value;
  const kind = asString2(candidate.kind);
  const timerValue = asString2(candidate.value);
  if (!kind || !timerValue) return void 0;
  if (kind !== "date" && kind !== "duration" && kind !== "cycle") return void 0;
  return { kind, value: timerValue };
}
function asEventDefinition(value) {
  if (!value || typeof value !== "object") return void 0;
  const candidate = value;
  const type = asString2(candidate.type);
  if (!type) return void 0;
  const eventDefinition = {
    type
  };
  const timer = asTimerDefinition(candidate.timer);
  const messageRef = asString2(candidate.messageRef);
  const signalRef = asString2(candidate.signalRef);
  const errorRef = asString2(candidate.errorRef);
  const escalationRef = asString2(candidate.escalationRef);
  const conditionExpression = asString2(candidate.conditionExpression);
  const linkName = asString2(candidate.linkName);
  if (timer) eventDefinition.timer = timer;
  if (messageRef) eventDefinition.messageRef = messageRef;
  if (signalRef) eventDefinition.signalRef = signalRef;
  if (errorRef) eventDefinition.errorRef = errorRef;
  if (escalationRef) eventDefinition.escalationRef = escalationRef;
  if (conditionExpression) eventDefinition.conditionExpression = conditionExpression;
  if (linkName) eventDefinition.linkName = linkName;
  return eventDefinition;
}
function fromBpmnReactFlow(diagram) {
  const variables = asProcessVariables(diagram.definitions?.variables);
  return {
    ...diagram.id ? { id: diagram.id } : {},
    ...diagram.name ? { name: diagram.name } : {},
    ...diagram.definitions ? {
      definitions: {
        ...diagram.definitions,
        ...variables ? { variables } : {}
      }
    } : {},
    nodes: diagram.nodes.map((node) => {
      const data = node.data ?? {};
      const type = asString2(data.elementType) ?? node.type;
      const mapped = {
        id: node.id,
        type
      };
      const name = asString2(data.label);
      const trigger = asString2(data.trigger);
      const eventDefinition = asEventDefinition(data.eventDefinition);
      const isNonInterrupting = asBoolean(data.isNonInterrupting);
      const attachedToRef = asString2(data.attachedToRef);
      const subProcessVariant = asString2(data.subProcessVariant);
      const participants = asParticipants(data.participants);
      const isCollection = asBoolean(data.isCollection);
      const priority = asString2(data.priority);
      const owner = asString2(data.owner);
      const sla = asString2(data.sla);
      const connector = asString2(data.connector);
      const action = asString2(data.action);
      const flowableType = asString2(data.flowableType);
      const flowableDelegateExpression = asString2(data.flowableDelegateExpression);
      const decisionRef = asString2(data.decisionRef);
      const inlineDecisionTable = asInlineDecisionTable(data.inlineDecisionTable);
      const formKey = asString2(data.formKey);
      const candidateUsers = asString2(data.candidateUsers);
      const candidateGroups = asString2(data.candidateGroups);
      const dueDate = asString2(data.dueDate);
      const skipExpression = asString2(data.skipExpression);
      const businessCalendarName = asString2(data.businessCalendarName);
      const variables2 = asNodeVariableRefs(data.variables);
      const outputVariable = asString2(data.outputVariable);
      const resultVariable = asString2(data.resultVariable);
      const serviceConfig = asServiceTaskConfig(data.serviceConfig);
      const completionCondition = asString2(data.completionCondition);
      const calledElement = asString2(data.calledElement);
      const scriptFormat = asString2(data.scriptFormat);
      const script = asString2(data.script);
      const loopType = asString2(data.loopType);
      const loopCondition = asString2(data.loopCondition);
      const loopCardinality = asString2(data.loopCardinality);
      const loopCompletionCondition = asString2(data.loopCompletionCondition);
      const dataObjectRef = asString2(data.dataObjectRef);
      const dataStoreRef = asString2(data.dataStoreRef);
      const markers = asStringArray(data.markers);
      if (name) mapped.name = name;
      if (node.parentId) mapped.parentId = node.parentId;
      if (trigger) mapped.trigger = trigger;
      if (eventDefinition) mapped.eventDefinition = eventDefinition;
      if (isNonInterrupting !== void 0) mapped.isNonInterrupting = isNonInterrupting;
      if (attachedToRef) mapped.attachedToRef = attachedToRef;
      if (subProcessVariant) {
        mapped.subProcessVariant = subProcessVariant;
      }
      if (participants) mapped.participants = participants;
      if (isCollection !== void 0) mapped.isCollection = isCollection;
      if (priority) mapped.priority = priority;
      if (owner) mapped.owner = owner;
      if (sla) mapped.sla = sla;
      if (connector) mapped.connector = connector;
      if (action) mapped.action = action;
      if (flowableType) mapped.flowableType = flowableType;
      if (flowableDelegateExpression) mapped.flowableDelegateExpression = flowableDelegateExpression;
      if (decisionRef) mapped.decisionRef = decisionRef;
      if (inlineDecisionTable) mapped.inlineDecisionTable = inlineDecisionTable;
      if (formKey) mapped.formKey = formKey;
      if (candidateUsers) mapped.candidateUsers = candidateUsers;
      if (candidateGroups) mapped.candidateGroups = candidateGroups;
      if (dueDate) mapped.dueDate = dueDate;
      if (skipExpression) mapped.skipExpression = skipExpression;
      if (businessCalendarName) mapped.businessCalendarName = businessCalendarName;
      if (variables2) mapped.variables = variables2;
      if (outputVariable) mapped.outputVariable = outputVariable;
      if (resultVariable) mapped.resultVariable = resultVariable;
      if (serviceConfig) mapped.serviceConfig = serviceConfig;
      if (completionCondition) mapped.completionCondition = completionCondition;
      if (calledElement) mapped.calledElement = calledElement;
      if (scriptFormat) mapped.scriptFormat = scriptFormat;
      if (script) mapped.script = script;
      if (loopType) mapped.loopType = loopType;
      if (loopCondition) mapped.loopCondition = loopCondition;
      if (loopCardinality) mapped.loopCardinality = loopCardinality;
      if (loopCompletionCondition) mapped.loopCompletionCondition = loopCompletionCondition;
      if (dataObjectRef) mapped.dataObjectRef = dataObjectRef;
      if (dataStoreRef) mapped.dataStoreRef = dataStoreRef;
      if (markers) mapped.markers = markers;
      return mapped;
    }),
    edges: diagram.edges.map((edge) => {
      const data = edge.data ?? {};
      const type = asString2(data.edgeType) ?? edge.type;
      const mapped = {
        id: edge.id,
        type,
        source: edge.source,
        target: edge.target
      };
      const name = asString2(data.label);
      const conditionExpression = asString2(data.conditionExpression);
      const isDefault = asBoolean(data.isDefault);
      if (name) mapped.name = name;
      if (conditionExpression) mapped.conditionExpression = conditionExpression;
      if (isDefault !== void 0) mapped.isDefault = isDefault;
      return mapped;
    })
  };
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
  const FLOW_NODE_TYPES2 = /* @__PURE__ */ new Set([
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
  const flowNodes = scopedNodes.filter((n) => FLOW_NODE_TYPES2.has(n.type));
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

// src/erd/types.ts
function isEntity(n) {
  return n.type === "Entity" || n.type === "WeakEntity";
}
function isAttribute(n) {
  return n.type === "Attribute" || n.type === "PrimaryKey" || n.type === "MultivaluedAttribute" || n.type === "DerivedAttribute" || n.type === "CompositeAttribute";
}
function isRelationship(n) {
  return n.type === "Relationship" || n.type === "WeakRelationship";
}

// src/erd/rules/entity-has-primary-key.ts
var entityHasPrimaryKey = {
  id: "erd/entity-has-primary-key",
  description: "Every Entity and WeakEntity must have at least one primary key attribute.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const entities = nodes.filter(isEntity);
    return entities.flatMap((entity) => {
      const inlinePk = entity.attributes?.some((a) => a.isPrimaryKey) ?? false;
      if (inlinePk) return [];
      const hasPkNode = edges.some(
        (e) => e.type === "hasAttribute" && e.source === entity.id && nodes.find((n) => n.id === e.target)?.type === "PrimaryKey"
      );
      if (hasPkNode) return [];
      return [
        {
          ruleId: "erd/entity-has-primary-key",
          severity: "error",
          message: `Entity "${entity.name ?? entity.id}" has no primary key.`,
          elementId: entity.id,
          elementType: entity.type
        }
      ];
    });
  }
};

// src/erd/rules/relationship-has-entities.ts
var relationshipHasEntities = {
  id: "erd/relationship-has-entities",
  description: "Every Relationship must have at least two entities connected via participatesIn edges.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const relationships = nodes.filter(isRelationship);
    return relationships.flatMap((rel) => {
      const participantCount = edges.filter(
        (e) => e.type === "participatesIn" && e.target === rel.id
      ).length;
      if (participantCount >= 2) return [];
      return [
        {
          ruleId: "erd/relationship-has-entities",
          severity: "error",
          message: `Relationship "${rel.name ?? rel.id}" has fewer than 2 participating entities (found ${participantCount}).`,
          elementId: rel.id,
          elementType: rel.type
        }
      ];
    });
  }
};

// src/erd/rules/no-orphan-attribute.ts
var noOrphanAttribute = {
  id: "erd/no-orphan-attribute",
  description: "Every attribute node must be connected to an entity or relationship via a hasAttribute edge.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const attributeNodes = nodes.filter(isAttribute);
    return attributeNodes.flatMap((attr) => {
      const isConnected = edges.some(
        (e) => e.type === "hasAttribute" && e.target === attr.id
      );
      if (isConnected) return [];
      return [
        {
          ruleId: "erd/no-orphan-attribute",
          severity: "error",
          message: `Attribute "${attr.name ?? attr.id}" is not connected to any entity or relationship.`,
          elementId: attr.id,
          elementType: attr.type
        }
      ];
    });
  }
};

// src/erd/rules/no-duplicate-entity-names.ts
var noDuplicateEntityNames = {
  id: "erd/no-duplicate-entity-names",
  description: "Two entities must not share the same name.",
  defaultSeverity: "error",
  check({ nodes }) {
    const seen = /* @__PURE__ */ new Map();
    const issues = [];
    for (const node of nodes.filter(isEntity)) {
      const name = node.name?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const existing = seen.get(key);
      if (existing) {
        issues.push({
          ruleId: "erd/no-duplicate-entity-names",
          severity: "error",
          message: `Duplicate entity name "${name}": also used by "${existing}".`,
          elementId: node.id,
          elementType: node.type,
          relatedElementIds: [existing]
        });
      } else {
        seen.set(key, node.id);
      }
    }
    return issues;
  }
};

// src/erd/rules/entity-connected.ts
var entityConnected = {
  id: "erd/entity-connected",
  description: "Every Entity should participate in at least one Relationship.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    const entities = nodes.filter(isEntity);
    return entities.flatMap((entity) => {
      const participates = edges.some(
        (e) => e.type === "participatesIn" && e.source === entity.id
      );
      if (participates) return [];
      return [
        {
          ruleId: "erd/entity-connected",
          severity: "warning",
          message: `Entity "${entity.name ?? entity.id}" does not participate in any relationship.`,
          elementId: entity.id,
          elementType: entity.type
        }
      ];
    });
  }
};

// src/erd/rules/entity-has-name.ts
var entityHasName = {
  id: "erd/entity-has-name",
  description: "Entities and Relationships should have a non-empty name.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter((n) => isEntity(n) || isRelationship(n)).filter((n) => !n.name || n.name.trim() === "").map((n) => ({
      ruleId: "erd/entity-has-name",
      severity: "warning",
      message: `${n.type} "${n.id}" has no name.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/erd/rules/attribute-has-name.ts
var attributeHasName = {
  id: "erd/attribute-has-name",
  description: "Attribute nodes should have a non-empty name.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter(isAttribute).filter((n) => !n.name || n.name.trim() === "").map((n) => ({
      ruleId: "erd/attribute-has-name",
      severity: "warning",
      message: `Attribute "${n.id}" has no name.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/erd/rules/relationship-has-cardinality.ts
var relationshipHasCardinality = {
  id: "erd/relationship-has-cardinality",
  description: "Each participation edge should declare a cardinality (1, N, or M).",
  defaultSeverity: "warning",
  check({ edges }) {
    return edges.filter(
      (e) => e.type === "participatesIn" && (!e.sourceCardinality || !e.targetCardinality)
    ).map((e) => ({
      ruleId: "erd/relationship-has-cardinality",
      severity: "warning",
      message: `Participation edge "${e.id}" is missing cardinality (source: ${e.sourceCardinality ?? "?"}, target: ${e.targetCardinality ?? "?"}).`,
      elementId: e.id,
      elementType: e.type,
      relatedElementIds: [e.source, e.target]
    }));
  }
};

// src/erd/rules/field-has-type.ts
var fieldHasType = {
  id: "erd/field-has-type",
  description: "Every attribute should declare a data type.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const issues = [];
    for (const node of nodes.filter(isAttribute)) {
      if (!node.dataType?.trim()) {
        issues.push({
          ruleId: "erd/field-has-type",
          severity: "warning",
          message: `Attribute "${node.name ?? node.id}" has no data type.`,
          elementId: node.id,
          elementType: node.type
        });
      }
    }
    for (const entity of nodes.filter(isEntity)) {
      for (const attr of entity.attributes ?? []) {
        if (!attr.dataType?.trim()) {
          issues.push({
            ruleId: "erd/field-has-type",
            severity: "warning",
            message: `Attribute "${attr.name}" on entity "${entity.name ?? entity.id}" has no data type.`,
            elementId: entity.id,
            elementType: entity.type
          });
        }
      }
    }
    return issues;
  }
};

// src/erd/rules/foreign-key-references-pk.ts
var foreignKeyReferencesPk = {
  id: "erd/foreign-key-references-pk",
  description: "Foreign key attributes must match a primary key name on another entity.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const issues = [];
    const entities = nodes.filter(isEntity);
    const pkNames = /* @__PURE__ */ new Set();
    for (const entity of entities) {
      for (const attr of entity.attributes ?? []) {
        if (attr.isPrimaryKey && attr.name) pkNames.add(attr.name.toLowerCase());
      }
    }
    for (const entity of entities) {
      for (const attr of entity.attributes ?? []) {
        if (!attr.isForeignKey) continue;
        if (!attr.name || !pkNames.has(attr.name.toLowerCase())) {
          issues.push({
            ruleId: "erd/foreign-key-references-pk",
            severity: "warning",
            message: `Foreign key "${attr.name}" on entity "${entity.name ?? entity.id}" does not match any primary key name.`,
            elementId: entity.id,
            elementType: entity.type
          });
        }
      }
    }
    return issues;
  }
};

// src/erd/rules/no-self-relationship.ts
var noSelfRelationship = {
  id: "erd/no-self-relationship",
  description: "Relationships should connect at least two distinct entities.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    const issues = [];
    for (const rel of nodes.filter(isRelationship)) {
      const participatingEntities = edges.filter((e) => e.type === "participatesIn" && e.target === rel.id).map((e) => e.source);
      const distinct = new Set(participatingEntities);
      if (distinct.size === 1 && participatingEntities.length > 1) {
        issues.push({
          ruleId: "erd/no-self-relationship",
          severity: "warning",
          message: `Relationship "${rel.name ?? rel.id}" connects the same entity to itself on all sides.`,
          elementId: rel.id,
          elementType: rel.type,
          relatedElementIds: [...distinct]
        });
      }
    }
    return issues;
  }
};

// src/erd/rules/relationship-has-name.ts
var relationshipHasName = {
  id: "erd/relationship-has-name",
  description: "Relationships should have a name to document the type of association.",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes.filter(isRelationship).filter((n) => !n.name || n.name.trim() === "").map((n) => ({
      ruleId: "erd/relationship-has-name",
      severity: "info",
      message: `Relationship "${n.id}" has no name.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/erd/runner.ts
var ERD_RULES = [
  // Structural errors
  entityHasPrimaryKey,
  relationshipHasEntities,
  noOrphanAttribute,
  noDuplicateEntityNames,
  // Best-practice warnings
  entityConnected,
  entityHasName,
  attributeHasName,
  relationshipHasCardinality,
  fieldHasType,
  foreignKeyReferencesPk,
  noSelfRelationship,
  // Informational hints
  relationshipHasName
];
var DEFAULT_CONFIG2 = {
  rules: Object.fromEntries(ERD_RULES.map((r) => [r.id, r.defaultSeverity]))
};
function runErdLint(diagram, config = {}) {
  const merged = {
    rules: { ...DEFAULT_CONFIG2.rules, ...config.rules }
  };
  return runRules(diagram, ERD_RULES, merged, { ...config.bus !== void 0 ? { bus: config.bus } : {} });
}

// src/uml/types.ts
function isClassifier(n) {
  return n.type === "Class" || n.type === "AbstractClass" || n.type === "Interface" || n.type === "Enumeration" || n.type === "DataType";
}

// src/uml/rules/class-has-name.ts
var classHasName = {
  id: "uml/class-has-name",
  description: "Every classifier (Class, AbstractClass, Interface, Enumeration, DataType) must have a name.",
  defaultSeverity: "error",
  check({ nodes }) {
    return nodes.filter(isClassifier).filter((n) => !n.name || n.name.trim() === "").map((n) => ({
      ruleId: "uml/class-has-name",
      severity: "error",
      message: `${n.type} "${n.id}" has no name.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/uml/rules/no-circular-inheritance.ts
var noCircularInheritance = {
  id: "uml/no-circular-inheritance",
  description: "The inheritance graph must be acyclic.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const inheritanceEdges = edges.filter((e) => e.type === "inheritance");
    const nodeIds = new Set(nodes.map((n) => n.id));
    const parents = /* @__PURE__ */ new Map();
    for (const e of inheritanceEdges) {
      if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
      const list = parents.get(e.source) ?? [];
      list.push(e.target);
      parents.set(e.source, list);
    }
    const visited = /* @__PURE__ */ new Set();
    const inStack = /* @__PURE__ */ new Set();
    const issues = [];
    function dfs(nodeId) {
      if (inStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;
      visited.add(nodeId);
      inStack.add(nodeId);
      for (const parentId of parents.get(nodeId) ?? []) {
        if (dfs(parentId)) {
          const node = nodes.find((n) => n.id === nodeId);
          issues.push({
            ruleId: "uml/no-circular-inheritance",
            severity: "error",
            message: `Circular inheritance detected at "${node?.name ?? nodeId}".`,
            elementId: nodeId,
            ...node ? { elementType: node.type } : {}
          });
          inStack.delete(nodeId);
          return false;
        }
      }
      inStack.delete(nodeId);
      return false;
    }
    for (const node of nodes) {
      if (!visited.has(node.id)) dfs(node.id);
    }
    return issues;
  }
};

// src/uml/rules/realization-target-is-interface.ts
var realizationTargetIsInterface = {
  id: "uml/realization-target-is-interface",
  description: "Realization edges must target an Interface node.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    return edges.filter((e) => e.type === "realization").flatMap((e) => {
      const target = nodeById.get(e.target);
      if (!target || target.type === "Interface") return [];
      return [
        {
          ruleId: "uml/realization-target-is-interface",
          severity: "error",
          message: `Realization edge "${e.id}" targets "${target.name ?? target.id}" which is a ${target.type}, not an Interface.`,
          elementId: e.id
        }
      ];
    });
  }
};

// src/uml/rules/abstract-method-in-abstract-class.ts
var abstractMethodInAbstractClass = {
  id: "uml/abstract-method-in-abstract-class",
  description: "AbstractClass nodes should declare at least one abstract method.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter((n) => n.type === "AbstractClass").filter((n) => !n.methods?.some((m) => m.isAbstract)).map((n) => ({
      ruleId: "uml/abstract-method-in-abstract-class",
      severity: "warning",
      message: `AbstractClass "${n.name ?? n.id}" has no abstract methods.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/uml/rules/class-not-isolated.ts
var classNotIsolated = {
  id: "uml/class-not-isolated",
  description: "Every classifier should have at least one edge connecting it to another node.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    const classifiers = nodes.filter(isClassifier);
    return classifiers.flatMap((n) => {
      const connected = edges.some((e) => e.source === n.id || e.target === n.id);
      if (connected) return [];
      return [
        {
          ruleId: "uml/class-not-isolated",
          severity: "warning",
          message: `${n.type} "${n.name ?? n.id}" is isolated (no edges).`,
          elementId: n.id,
          elementType: n.type
        }
      ];
    });
  }
};

// src/uml/rules/enumeration-has-literals.ts
var enumerationHasLiterals = {
  id: "uml/enumeration-has-literals",
  description: "Enumeration nodes should have at least one attribute (literal).",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter((n) => n.type === "Enumeration").filter((n) => !n.attributes || n.attributes.length === 0).map((n) => ({
      ruleId: "uml/enumeration-has-literals",
      severity: "warning",
      message: `Enumeration "${n.name ?? n.id}" has no literals.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/uml/rules/no-duplicate-attribute.ts
var noDuplicateAttribute = {
  id: "uml/no-duplicate-attribute",
  description: "A class must not declare two attributes with the same name.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.flatMap((n) => {
      if (!n.attributes || n.attributes.length < 2) return [];
      const seen = /* @__PURE__ */ new Set();
      const duplicates = /* @__PURE__ */ new Set();
      for (const attr of n.attributes) {
        if (seen.has(attr.name)) duplicates.add(attr.name);
        seen.add(attr.name);
      }
      return [...duplicates].map((name) => ({
        ruleId: "uml/no-duplicate-attribute",
        severity: "warning",
        message: `${n.type} "${n.name ?? n.id}" has duplicate attribute "${name}".`,
        elementId: n.id,
        elementType: n.type
      }));
    });
  }
};

// src/uml/rules/package-has-name.ts
var packageHasName = {
  id: "uml/package-has-name",
  description: "Package nodes should have a name.",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes.filter((n) => n.type === "Package").filter((n) => !n.name || n.name.trim() === "").map((n) => ({
      ruleId: "uml/package-has-name",
      severity: "info",
      message: `Package "${n.id}" has no name.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/uml/runner.ts
var UML_RULES = [
  // Structural errors
  classHasName,
  noCircularInheritance,
  realizationTargetIsInterface,
  // Best-practice warnings
  abstractMethodInAbstractClass,
  classNotIsolated,
  enumerationHasLiterals,
  noDuplicateAttribute,
  // Informational hints
  packageHasName
];
var DEFAULT_CONFIG3 = {
  rules: Object.fromEntries(UML_RULES.map((r) => [r.id, r.defaultSeverity]))
};
function runUmlLint(diagram, config = {}) {
  const merged = {
    rules: { ...DEFAULT_CONFIG3.rules, ...config.rules }
  };
  return runRules(diagram, UML_RULES, merged, { ...config.bus !== void 0 ? { bus: config.bus } : {} });
}

// src/c4/rules/element-has-name.ts
var elementHasName = {
  id: "c4/element-has-name",
  description: "Every C4 element must have a non-empty name.",
  defaultSeverity: "error",
  check({ nodes }) {
    return nodes.filter((n) => !n.name || n.name.trim() === "").map((n) => ({
      ruleId: "c4/element-has-name",
      severity: "error",
      message: `${n.type} "${n.id}" has no name.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/c4/types.ts
function isPerson(n) {
  return n.type === "Person" || n.type === "ExternalPerson";
}
function isSystem(n) {
  return n.type === "SoftwareSystem" || n.type === "ExternalSystem";
}
function isContainer2(n) {
  return n.type === "Container" || n.type === "Database" || n.type === "MessageBus" || n.type === "MicroserviceContainer";
}
function isComponent(n) {
  return n.type === "Component" || n.type === "ExternalComponent";
}

// src/c4/rules/container-inside-system.ts
var containerInsideSystem = {
  id: "c4/container-inside-system",
  description: "Every Container must have a parentId pointing to a SoftwareSystem.",
  defaultSeverity: "error",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const containers = nodes.filter(isContainer2);
    return containers.flatMap((c) => {
      if (!c.parentId) {
        return [
          {
            ruleId: "c4/container-inside-system",
            severity: "error",
            message: `${c.type} "${c.name ?? c.id}" has no parent SoftwareSystem.`,
            elementId: c.id,
            elementType: c.type
          }
        ];
      }
      const parent = nodeById.get(c.parentId);
      if (!parent || !isSystem(parent)) {
        return [
          {
            ruleId: "c4/container-inside-system",
            severity: "error",
            message: `${c.type} "${c.name ?? c.id}" must be inside a SoftwareSystem, but its parent is "${parent?.type ?? "unknown"}".`,
            elementId: c.id,
            elementType: c.type
          }
        ];
      }
      return [];
    });
  }
};

// src/c4/rules/component-inside-container.ts
var componentInsideContainer = {
  id: "c4/component-inside-container",
  description: "Every Component must have a parentId pointing to a Container.",
  defaultSeverity: "error",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const components = nodes.filter(isComponent);
    return components.flatMap((comp) => {
      if (!comp.parentId) {
        return [
          {
            ruleId: "c4/component-inside-container",
            severity: "error",
            message: `${comp.type} "${comp.name ?? comp.id}" has no parent Container.`,
            elementId: comp.id,
            elementType: comp.type
          }
        ];
      }
      const parent = nodeById.get(comp.parentId);
      if (!parent || !isContainer2(parent)) {
        return [
          {
            ruleId: "c4/component-inside-container",
            severity: "error",
            message: `${comp.type} "${comp.name ?? comp.id}" must be inside a Container, but its parent is "${parent?.type ?? "unknown"}".`,
            elementId: comp.id,
            elementType: comp.type
          }
        ];
      }
      return [];
    });
  }
};

// src/c4/rules/no-direct-person-to-component.ts
var noDirectPersonToComponent = {
  id: "c4/no-direct-person-to-component",
  description: "A Person must not connect directly to a Component; persons interact with Systems or Containers.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    return edges.flatMap((e) => {
      const source = nodeById.get(e.source);
      const target = nodeById.get(e.target);
      if (!source || !target) return [];
      if (!isPerson(source) || !isComponent(target)) return [];
      return [
        {
          ruleId: "c4/no-direct-person-to-component",
          severity: "error",
          message: `Person "${source.name ?? source.id}" connects directly to Component "${target.name ?? target.id}". Persons should interact with Systems or Containers.`,
          elementId: e.id
        }
      ];
    });
  }
};

// src/c4/rules/person-interacts.ts
var personInteracts = {
  id: "c4/person-interacts",
  description: "Every Person should have at least one edge connecting to another element.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    const persons = nodes.filter(isPerson);
    return persons.flatMap((p) => {
      const connected = edges.some((e) => e.source === p.id || e.target === p.id);
      if (connected) return [];
      return [
        {
          ruleId: "c4/person-interacts",
          severity: "warning",
          message: `Person "${p.name ?? p.id}" has no interactions.`,
          elementId: p.id,
          elementType: p.type
        }
      ];
    });
  }
};

// src/c4/rules/system-has-description.ts
var systemHasDescription = {
  id: "c4/system-has-description",
  description: "Internal SoftwareSystems should have a description.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter((n) => n.type === "SoftwareSystem" && !n.isExternal).filter((n) => !n.description || n.description.trim() === "").map((n) => ({
      ruleId: "c4/system-has-description",
      severity: "warning",
      message: `SoftwareSystem "${n.name ?? n.id}" has no description.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/c4/rules/technology-specified.ts
var technologySpecified = {
  id: "c4/technology-specified",
  description: "Containers and Components should specify the technology used.",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes.filter((n) => isContainer2(n) || isComponent(n)).filter((n) => !n.technology || n.technology.trim() === "").map((n) => ({
      ruleId: "c4/technology-specified",
      severity: "info",
      message: `${n.type} "${n.name ?? n.id}" has no technology specified.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/c4/rules/element-has-description.ts
var elementHasDescription = {
  id: "c4/element-has-description",
  description: "All elements should have a description (optional for Persons).",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes.filter((n) => !isPerson(n)).filter((n) => !n.description || n.description.trim() === "").map((n) => ({
      ruleId: "c4/element-has-description",
      severity: "info",
      message: `${n.type} "${n.name ?? n.id}" has no description.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/c4/runner.ts
var C4_RULES = [
  // Structural errors
  elementHasName,
  containerInsideSystem,
  componentInsideContainer,
  noDirectPersonToComponent,
  // Best-practice warnings
  personInteracts,
  systemHasDescription,
  // Informational hints
  technologySpecified,
  elementHasDescription
];
var DEFAULT_CONFIG4 = {
  rules: Object.fromEntries(C4_RULES.map((r) => [r.id, r.defaultSeverity]))
};
function runC4Lint(diagram, config = {}) {
  const merged = {
    rules: { ...DEFAULT_CONFIG4.rules, ...config.rules }
  };
  return runRules(diagram, C4_RULES, merged, { ...config.bus !== void 0 ? { bus: config.bus } : {} });
}

exports.BPMN_DESIGN_PRESET = BPMN_DESIGN_PRESET;
exports.BPMN_PRESETS = BPMN_PRESETS;
exports.BPMN_RECOMMENDED_PRESET = BPMN_RECOMMENDED_PRESET;
exports.BPMN_RULES = BPMN_RULES;
exports.BPMN_STRICT_PRESET = BPMN_STRICT_PRESET;
exports.C4_RULES = C4_RULES;
exports.ERD_RULES = ERD_RULES;
exports.LintCache = LintCache;
exports.LintEventBus = LintEventBus;
exports.UML_RULES = UML_RULES;
exports.createLintCache = createLintCache;
exports.createLintEventBus = createLintEventBus;
exports.deserializeLintResult = deserializeLintResult;
exports.diffLintResults = diffLintResults;
exports.filterIssues = filterIssues;
exports.fromBpmnDiagramState = fromBpmnDiagramState;
exports.fromBpmnReactFlow = fromBpmnReactFlow;
exports.getBpmnFlowTabOrder = getBpmnFlowTabOrder;
exports.groupIssuesByCategory = groupIssuesByCategory;
exports.groupIssuesByElement = groupIssuesByElement;
exports.groupIssuesByRule = groupIssuesByRule;
exports.hashDiagramForLint = hashDiagramForLint;
exports.runBpmnLint = runBpmnLint;
exports.runC4Lint = runC4Lint;
exports.runErdLint = runErdLint;
exports.runRules = runRules;
exports.runUmlLint = runUmlLint;
exports.serializeLintResult = serializeLintResult;
exports.summarizeByElement = summarizeByElement;
exports.withLintCache = withLintCache;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map