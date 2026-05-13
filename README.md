# @aranzatech/flowslint

Pure lint rules for Aranza diagram packages. Rules are framework-agnostic and
can run in the browser, Node.js, workers or CI.

## Public Subpaths

```ts
import { runBpmnLint, fromBpmnReactFlow } from "@aranzatech/flowslint/bpmn";
import { runErdLint } from "@aranzatech/flowslint/erd";
import { runUmlLint } from "@aranzatech/flowslint/uml";
import { runC4Lint } from "@aranzatech/flowslint/c4";
```

## BPMN Usage

```ts
import {
  fromBpmnReactFlow,
  runBpmnLint,
} from "@aranzatech/flowslint/bpmn";

const diagram = fromBpmnReactFlow({ nodes, edges });
const result = runBpmnLint(diagram, { preset: "recommended" });
```

## BPMN Presets

- `recommended`: balanced linting for active modeling.
- `design`: softer hints while users are sketching.
- `strict`: stricter checks for publish/export gates.

```ts
const result = runBpmnLint(diagram, {
  preset: "strict",
  rules: {
    "bpmn/gateway-has-name": "off",
  },
});
```

## Issue Metadata

Issues include `ruleId`, `severity`, `message`, `elementId` and may also
include `category`, `code`, `relatedElementIds`, `docsUrl` and `quickFixes`.

