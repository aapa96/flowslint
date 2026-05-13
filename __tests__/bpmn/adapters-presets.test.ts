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

