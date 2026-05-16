# Changelog

## Unreleased

## 0.2.7

### New rules
- `bpmn/aranza/automatable-task-action` — warns when an automatable task (Task, ServiceTask, ScriptTask, BusinessRuleTask, SendTask, ReceiveTask) lacks `connector` or `action`.
- `bpmn/aranza/service-task-config` — errors when a ServiceTask has neither an Aranza `connector+action` pair nor a valid Flowable execution config (`flowableType` or `flowableDelegateExpression`).
- `bpmn/lane-parent-pool` — errors when a Lane is not directly contained by a Pool.
- `bpmn/pool-children-inside-lanes` — warns when flow nodes inside a Pool are not assigned to a Lane.
- `bpmn/process-node-outside-participant` — warns when flow nodes exist at the process level alongside Pools.
- `bpmn/boundary-no-incoming` — errors when a BoundaryEvent has incoming sequence flows.
- `bpmn/boundary-has-outgoing` — warns when a BoundaryEvent has no outgoing sequence flows.
- `bpmn/event-definition-ref-required` — warns when a message/signal/error/escalation event has no corresponding ref declared.
- `bpmn/scope-single-start` — warns when a SubProcess/Transaction/EventSubProcess/AdHocSubProcess has more than one start event.
- `bpmn/gateway-single-default` — errors when a gateway has more than one default flow.

### Improvements
- `BpmnNode` now includes `connector`, `action`, `flowableType` and `flowableDelegateExpression` fields, enabling aranza-specific rules to run inside flowslint without requiring a webapp shim.
- `bpmn/exclusive-gateway-condition` extended to cover `ComplexGateway` in addition to ExclusiveGateway and InclusiveGateway.
- `bpmn/subprocess-has-start-end` extended to validate `EventSubProcess` nodes.
- `hashDiagramForLint` now includes edge `conditionExpression` and `isDefault` in the cache key, preventing stale lint results when gateway conditions change.
- `strict` preset enables `bpmn/aranza/service-task-config` (error) and `bpmn/aranza/automatable-task-action` (warning).
- `design` preset disables both new aranza rules.

## 0.2.6

- Added richer lint issue metadata: category, code, docs URL, related elements and quick fixes.
- Added BPMN lint presets: recommended, design and strict.
- Added `fromBpmnReactFlow` adapter for diagrams-bpmn/ReactFlow-like state.
- Aligned BPMN types with newer diagrams-bpmn container variants: Transaction, EventSubProcess and AdHocSubProcess.
- Added BPMN connection rules for sequence-flow endpoints and data-association endpoints.
- Added BPMN flow completeness rules for missing incoming/outgoing sequence flows, unreachable nodes and unreachable end events.
- Exported BPMN presets, adapter and config types from the root and BPMN subpath.
