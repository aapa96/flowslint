import { describe, expect, it } from "vitest";
import {
  BPMN_DESIGN_PRESET,
  BPMN_STRICT_PRESET,
  fromBpmnReactFlow,
  runBpmnLint,
} from "../../src/bpmn";
import type { BpmnDiagram } from "../../src/bpmn";

describe("BPMN adapters and presets", () => {
  it("converts diagrams-bpmn ReactFlow-like state into flowslint BPMN diagrams", () => {
    const diagram = fromBpmnReactFlow({
      nodes: [
        {
          id: "s",
          type: "StartEvent",
          position: { x: 0, y: 0 },
          data: { elementType: "StartEvent", label: "Start" },
        } as never,
        {
          id: "t",
          type: "Task",
          position: { x: 100, y: 0 },
          data: {
            elementType: "UserTask",
            label: "Review",
            owner: "ops",
            sla: "PT4H",
            markers: ["loop"],
          },
        } as never,
      ],
      edges: [
        {
          id: "st",
          type: "sequenceFlow",
          source: "s",
          target: "t",
          data: { edgeType: "sequenceFlow", label: "go" },
        },
      ],
    });

    expect(diagram.nodes[1]).toMatchObject({
      id: "t",
      type: "UserTask",
      name: "Review",
      owner: "ops",
      sla: "PT4H",
      markers: ["loop"],
    });
    expect(diagram.edges[0]).toMatchObject({
      id: "st",
      type: "sequenceFlow",
      name: "go",
    });
  });

  it("supports design and strict presets", () => {
    const diagram: BpmnDiagram = {
      nodes: [
        { id: "s", type: "StartEvent" },
        { id: "t", type: "Task" },
        { id: "e", type: "EndEvent" },
      ],
      edges: [
        { id: "st", type: "sequenceFlow", source: "s", target: "t" },
        { id: "te", type: "sequenceFlow", source: "t", target: "e" },
      ],
    };

    const design = runBpmnLint(diagram, { preset: "design" });
    const strict = runBpmnLint(diagram, { preset: BPMN_STRICT_PRESET });

    expect(BPMN_DESIGN_PRESET.rules["bpmn/task-has-name"]).toBe("info");
    expect(design.issues.find((issue) => issue.ruleId === "bpmn/task-has-name")?.severity).toBe("info");
    expect(strict.issues.find((issue) => issue.ruleId === "bpmn/task-has-name")?.severity).toBe("error");
  });

  it("maps eventDefinition with timer to BpmnNode", () => {
    const diagram = fromBpmnReactFlow({
      nodes: [
        {
          id: "catch",
          type: "IntermediateCatchEvent",
          data: {
            elementType: "IntermediateCatchEvent",
            label: "Wait 2h",
            trigger: "timer",
            eventDefinition: {
              type: "timer",
              timer: { kind: "duration", value: "PT2H" },
            },
          },
        } as never,
      ],
      edges: [],
    });

    expect(diagram.nodes[0]).toMatchObject({
      id: "catch",
      type: "IntermediateCatchEvent",
      name: "Wait 2h",
      trigger: "timer",
      eventDefinition: { type: "timer", timer: { kind: "duration", value: "PT2H" } },
    });
  });

  it("maps eventDefinition with messageRef, signalRef, errorRef", () => {
    const msgNode = fromBpmnReactFlow({
      nodes: [
        {
          id: "msg",
          data: { elementType: "StartEvent", trigger: "message", eventDefinition: { type: "message", messageRef: "msg-1" } },
        } as never,
      ],
      edges: [],
    });
    expect(msgNode.nodes[0].eventDefinition?.messageRef).toBe("msg-1");

    const sigNode = fromBpmnReactFlow({
      nodes: [
        {
          id: "sig",
          data: { elementType: "IntermediateCatchEvent", eventDefinition: { type: "signal", signalRef: "sig-1" } },
        } as never,
      ],
      edges: [],
    });
    expect(sigNode.nodes[0].eventDefinition?.signalRef).toBe("sig-1");

    const errNode = fromBpmnReactFlow({
      nodes: [
        {
          id: "err",
          data: { elementType: "BoundaryEvent", eventDefinition: { type: "error", errorRef: "err-1" } },
        } as never,
      ],
      edges: [],
    });
    expect(errNode.nodes[0].eventDefinition?.errorRef).toBe("err-1");
  });

  it("maps eventDefinition with escalationRef, conditionExpression and linkName", () => {
    const escalation = fromBpmnReactFlow({
      nodes: [
        {
          id: "esc",
          data: { elementType: "BoundaryEvent", eventDefinition: { type: "escalation", escalationRef: "esc-1" } },
        } as never,
      ],
      edges: [],
    });
    expect(escalation.nodes[0].eventDefinition?.escalationRef).toBe("esc-1");

    const cond = fromBpmnReactFlow({
      nodes: [
        {
          id: "cond",
          data: { elementType: "IntermediateCatchEvent", eventDefinition: { type: "conditional", conditionExpression: "x > 0" } },
        } as never,
      ],
      edges: [],
    });
    expect(cond.nodes[0].eventDefinition?.conditionExpression).toBe("x > 0");

    const link = fromBpmnReactFlow({
      nodes: [
        {
          id: "lnk",
          data: { elementType: "IntermediateThrowEvent", eventDefinition: { type: "link", linkName: "GoTo-Review" } },
        } as never,
      ],
      edges: [],
    });
    expect(link.nodes[0].eventDefinition?.linkName).toBe("GoTo-Review");
  });

  it("maps node fields: parentId, isNonInterrupting, attachedToRef, subProcessVariant, isCollection, priority", () => {
    const diagram = fromBpmnReactFlow({
      nodes: [
        {
          id: "lane",
          type: "Lane",
          data: { elementType: "Lane" },
          parentId: "pool1",
        } as never,
        {
          id: "be",
          type: "BoundaryEvent",
          data: {
            elementType: "BoundaryEvent",
            isNonInterrupting: true,
            attachedToRef: "t1",
            priority: "critical",
          },
          parentId: "t1",
        } as never,
        {
          id: "sp",
          type: "SubProcess",
          data: {
            elementType: "SubProcess",
            subProcessVariant: "event",
            isCollection: true,
          },
        } as never,
      ],
      edges: [],
    });

    const lane = diagram.nodes.find((n) => n.id === "lane")!;
    expect(lane.parentId).toBe("pool1");

    const be = diagram.nodes.find((n) => n.id === "be")!;
    expect(be.isNonInterrupting).toBe(true);
    expect(be.attachedToRef).toBe("t1");
    expect(be.priority).toBe("critical");

    const sp = diagram.nodes.find((n) => n.id === "sp")!;
    expect(sp.subProcessVariant).toBe("event");
    expect(sp.isCollection).toBe(true);
  });

  it("maps choreography participants on nodes", () => {
    const diagram = fromBpmnReactFlow({
      nodes: [
        {
          id: "ct1",
          type: "ChoreographyTask",
          data: {
            elementType: "ChoreographyTask",
            participants: [
              { name: "Buyer", isInitiating: true },
              { name: "Seller", isInitiating: false },
            ],
          },
        } as never,
      ],
      edges: [],
    });

    const node = diagram.nodes[0]!;
    expect(node.participants).toHaveLength(2);
    expect(node.participants?.[0]).toMatchObject({ name: "Buyer", isInitiating: true });
  });

  it("maps edge conditionExpression and isDefault", () => {
    const diagram = fromBpmnReactFlow({
      nodes: [],
      edges: [
        {
          id: "e1",
          source: "gw",
          target: "t1",
          data: {
            edgeType: "sequenceFlow",
            conditionExpression: "amount > 1000",
            isDefault: false,
          },
        },
        {
          id: "e2",
          source: "gw",
          target: "t2",
          data: { edgeType: "sequenceFlow", isDefault: true },
        },
      ],
    });

    expect(diagram.edges[0]?.conditionExpression).toBe("amount > 1000");
    expect(diagram.edges[0]?.isDefault).toBe(false);
    expect(diagram.edges[1]?.isDefault).toBe(true);
  });

  it("falls back to node.type when data.elementType is absent", () => {
    const diagram = fromBpmnReactFlow({
      nodes: [{ id: "g", type: "ExclusiveGateway" } as never],
      edges: [],
    });
    expect(diagram.nodes[0]?.type).toBe("ExclusiveGateway");
  });

  it("adds rule metadata to issues", () => {
    const result = runBpmnLint({
      nodes: [{ id: "a", type: "Task" }, { id: "data", type: "DataObject" }],
      edges: [{ id: "bad", type: "sequenceFlow", source: "a", target: "data" }],
    });

    const issue = result.issues.find(
      (item) => item.ruleId === "bpmn/sequence-flow-valid-endpoints",
    );
    expect(issue).toMatchObject({
      category: "modeling",
      code: "bpmn/sequence-flow-valid-endpoints",
      relatedElementIds: ["a", "data"],
    });
    expect(issue?.quickFixes?.[0].id).toBe("convert-to-association-or-message-flow");
  });
});

