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
      return hasStart ? [] : [{ ruleId: "bpmn/start-event-required", severity: "error", message: "The process has no start event." }];
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
          message: `Pool "${pool.name ?? pool.id}" has no start event.`,
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
      return hasEnd ? [] : [{ ruleId: "bpmn/end-event-required", severity: "error", message: "The process has no end event." }];
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
          message: `Pool "${pool.name ?? pool.id}" has no end event.`,
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
      message: `Sequence flow "${e.id}" is a self-loop (source and target are the same node).`,
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
          message: `Intermediate event "${n.name ?? n.id}" (${n.type}) has no incoming sequence flow.`,
          elementId: n.id,
          elementType: n.type
        });
      }
      if (outgoing.length === 0) {
        issues.push({
          ruleId: "bpmn/intermediate-event-both-flows",
          severity: "error",
          message: `Intermediate event "${n.name ?? n.id}" (${n.type}) has no outgoing sequence flow.`,
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
function isGateway(n) {
  return GATEWAY_TYPES.has(n.type);
}
function isJoiningGateway(n) {
  return JOINING_GATEWAY_TYPES.has(n.type);
}
function isSplittingGateway(n) {
  return SPLITTING_GATEWAY_TYPES.has(n.type);
}
function isEvent(n) {
  return EVENT_TYPES.has(n.type);
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
      message: `Gateway "${n.name ?? n.id}" (${n.type}) must have at least 2 outgoing sequence flows.`,
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
      const incoming = edges.filter((e) => e.type === "sequenceFlow" && e.target === n.id);
      return incoming.length < 2;
    }).map((n) => ({
      ruleId: "bpmn/gateway-has-incoming",
      severity: "error",
      message: `Gateway "${n.name ?? n.id}" (${n.type}) must have at least 2 incoming sequence flows.`,
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
      message: `"${node.name ?? node.id}" (${node.type}) has no incoming sequence flow.`,
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
      message: `"${node.name ?? node.id}" (${node.type}) has no outgoing sequence flow.`,
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
      message: `"${node.name ?? node.id}" (${node.type}) is not reachable from any start event.`,
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
      message: "No end event is reachable from any start event."
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
      message: `Sequence flow "${e.id}" crosses pool boundaries. Use a message flow instead.`,
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
    const subProcesses = nodes.filter((n) => n.type === "SubProcess");
    const issues = [];
    for (const sp of subProcesses) {
      const variant = sp.subProcessVariant ?? "embedded";
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
var linkEventPair = {
  id: "bpmn/link-event-pair",
  description: "Every throw link event must have a matching catch link event with the same name.",
  defaultSeverity: "error",
  check({ nodes }) {
    const throwLinks = nodes.filter(
      (n) => n.type === "IntermediateThrowEvent" && n.trigger === "link"
    );
    const catchLinkNames = new Set(
      nodes.filter((n) => n.type === "IntermediateCatchEvent" && n.trigger === "link").map((n) => n.name?.trim()).filter(Boolean)
    );
    return throwLinks.filter((n) => !n.name || !catchLinkNames.has(n.name.trim())).map((n) => ({
      ruleId: "bpmn/link-event-pair",
      severity: "error",
      message: `Throw link event "${n.name ?? n.id}" has no matching catch link event with the same name.`,
      elementId: n.id,
      elementType: n.type
    }));
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
      message: `"${n.name ?? n.id}" (${n.type}) has no sequence flow connections.`,
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
      message: `"${n.name ?? n.id}" has multiple outgoing flows. Use an explicit gateway to model the split.`,
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
      message: `"${n.name ?? n.id}" (${n.type}) has multiple incoming flows. Use an explicit gateway to model the join.`,
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
      message: `Pool "${pool.name ?? pool.id}" contains no flow nodes.`,
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
      message: `Task "${n.id}" (${n.type}) has no name.`,
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
      message: `${n.type} "${n.id}" has no name. Decision gateways should describe the condition being evaluated.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/bpmn/rules/exclusive-gateway-condition.ts
var CONDITIONAL_GATEWAYS = /* @__PURE__ */ new Set(["ExclusiveGateway", "InclusiveGateway"]);
var exclusiveGatewayCondition = {
  id: "bpmn/exclusive-gateway-condition",
  description: "Non-default outgoing flows of ExclusiveGateway / InclusiveGateway must have a condition expression.",
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
            message: `Outgoing flow "${edge.name ?? edge.id}" from ${gw.type} "${gw.name ?? gw.id}" has no condition expression and is not marked as default.`,
            elementId: edge.id
          });
        }
      }
    }
    return issues;
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
            message: `MessageFlow "${e.id}" connects two elements within the same pool "${sourcePool.name ?? sourcePool.id}".`,
            elementId: e.id
          }
        ];
      }
      if (!sourcePool && !targetPool) {
        return [
          {
            ruleId: "bpmn/message-flow-valid-endpoints",
            severity: "error",
            message: `MessageFlow "${e.id}" connects two elements with no pool \u2014 message flows must cross pool boundaries.`,
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
  "DataOutput"
]);
var dataObjectConnected = {
  id: "bpmn/data-object-connected",
  description: "DataObject, DataObjectReference, DataInput and DataOutput should be connected via a dataAssociation edge.",
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
function triggerOf(node) {
  return node.eventDefinition?.type ?? node.trigger;
}
var eventDefinitionPayloadRequired = {
  id: "bpmn/event-definition-payload-required",
  description: "Certain BPMN event definitions require additional payload such as refs, expressions, or link names.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const issues = [];
    for (const node of nodes) {
      const trigger = triggerOf(node);
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
function triggerOf2(node) {
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
      const trigger = triggerOf2(node);
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
      message: `Task "${n.id}" (${n.type}) has no owner assigned.`,
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
  noDuplicateSequenceFlow,
  messageFlowValidEndpoints,
  sequenceFlowValidEndpoints,
  dataAssociationValidEndpoints,
  eventDefinitionRefDeclared,
  // Best-practice warnings
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
  // Informational hints
  annotationHasText,
  dataObjectConnected,
  // AranzaFlows extensions
  taskHasOwner,
  criticalTaskHasSla,
  slaFormat
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
    "bpmn/aranza/task-has-owner": "error",
    "bpmn/aranza/critical-task-has-sla": "error"
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
    "bpmn/no-disconnected-nodes": "info",
    "bpmn/no-multiple-start-events": "info",
    "bpmn/aranza/task-has-owner": "off",
    "bpmn/aranza/critical-task-has-sla": "off"
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
function asString(value) {
  return typeof value === "string" ? value : void 0;
}
function asBoolean(value) {
  return typeof value === "boolean" ? value : void 0;
}
function asStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : void 0;
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
  const kind = asString(candidate.kind);
  const timerValue = asString(candidate.value);
  if (!kind || !timerValue) return void 0;
  if (kind !== "date" && kind !== "duration" && kind !== "cycle") return void 0;
  return { kind, value: timerValue };
}
function asEventDefinition(value) {
  if (!value || typeof value !== "object") return void 0;
  const candidate = value;
  const type = asString(candidate.type);
  if (!type) return void 0;
  const eventDefinition = {
    type
  };
  const timer = asTimerDefinition(candidate.timer);
  const messageRef = asString(candidate.messageRef);
  const signalRef = asString(candidate.signalRef);
  const errorRef = asString(candidate.errorRef);
  const escalationRef = asString(candidate.escalationRef);
  const conditionExpression = asString(candidate.conditionExpression);
  const linkName = asString(candidate.linkName);
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
  return {
    ...diagram.id ? { id: diagram.id } : {},
    ...diagram.name ? { name: diagram.name } : {},
    nodes: diagram.nodes.map((node) => {
      const data = node.data ?? {};
      const type = asString(data.elementType) ?? node.type;
      const mapped = {
        id: node.id,
        type
      };
      const name = asString(data.label);
      const trigger = asString(data.trigger);
      const eventDefinition = asEventDefinition(data.eventDefinition);
      const isNonInterrupting = asBoolean(data.isNonInterrupting);
      const attachedToRef = asString(data.attachedToRef);
      const subProcessVariant = asString(data.subProcessVariant);
      const participants = asParticipants(data.participants);
      const isCollection = asBoolean(data.isCollection);
      const priority = asString(data.priority);
      const owner = asString(data.owner);
      const sla = asString(data.sla);
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
      if (markers) mapped.markers = markers;
      return mapped;
    }),
    edges: diagram.edges.map((edge) => {
      const data = edge.data ?? {};
      const type = asString(data.edgeType) ?? edge.type;
      const mapped = {
        id: edge.id,
        type,
        source: edge.source,
        target: edge.target
      };
      const name = asString(data.label);
      const conditionExpression = asString(data.conditionExpression);
      const isDefault = asBoolean(data.isDefault);
      if (name) mapped.name = name;
      if (conditionExpression) mapped.conditionExpression = conditionExpression;
      if (isDefault !== void 0) mapped.isDefault = isDefault;
      return mapped;
    })
  };
}

exports.BPMN_DESIGN_PRESET = BPMN_DESIGN_PRESET;
exports.BPMN_PRESETS = BPMN_PRESETS;
exports.BPMN_RECOMMENDED_PRESET = BPMN_RECOMMENDED_PRESET;
exports.BPMN_RULES = BPMN_RULES;
exports.BPMN_STRICT_PRESET = BPMN_STRICT_PRESET;
exports.EVENT_TYPES = EVENT_TYPES;
exports.FLOW_NODE_TYPES = FLOW_NODE_TYPES;
exports.GATEWAY_TYPES = GATEWAY_TYPES;
exports.TASK_TYPES = TASK_TYPES;
exports.fromBpmnReactFlow = fromBpmnReactFlow;
exports.isContainer = isContainer;
exports.isEvent = isEvent;
exports.isFlowNode = isFlowNode;
exports.isGateway = isGateway;
exports.isTask = isTask;
exports.runBpmnLint = runBpmnLint;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map