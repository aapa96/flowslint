import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index:     "src/index.ts",
    "bpmn/index": "src/bpmn/index.ts",
    "erd/index":  "src/erd/index.ts",
    "uml/index":  "src/uml/index.ts",
    "c4/index":   "src/c4/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
