import type { LintResult, LintIssue } from "./types";

// ─── Serialized format ────────────────────────────────────────────────────────

export interface SerializedLintResult {
  schema: "aranzatech.lint";
  version: 1;
  /** ISO 8601 timestamp of when this result was produced. */
  timestamp: string;
  issues: LintIssue[];
  errors: number;
  warnings: number;
  infos: number;
  passed: boolean;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Serialize a lint result to a stable JSON string suitable for CI caching,
 * report storage, or diffing across runs.
 *
 * ```ts
 * const json = serializeLintResult(result);
 * fs.writeFileSync("lint-result.json", json);
 * ```
 */
export function serializeLintResult(result: LintResult): string {
  const doc: SerializedLintResult = {
    schema: "aranzatech.lint",
    version: 1,
    timestamp: new Date().toISOString(),
    issues: result.issues,
    errors: result.errors,
    warnings: result.warnings,
    infos: result.infos,
    passed: result.passed,
  };
  return JSON.stringify(doc, null, 2);
}

/**
 * Deserialize a lint result that was previously serialized with
 * `serializeLintResult`. Throws when the document is not a valid
 * `aranzatech.lint` schema.
 */
export function deserializeLintResult(json: string): LintResult {
  const doc = JSON.parse(json) as Partial<SerializedLintResult>;
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
    passed: doc.passed ?? doc.issues.every((i) => i.severity !== "error"),
  };
}
