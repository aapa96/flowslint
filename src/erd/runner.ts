import { runRules } from "../core/runner";
import type { LintConfig, LintResult, LintRule } from "../core/types";
import type { ErdDiagram } from "./types";

import { entityHasPrimaryKey } from "./rules/entity-has-primary-key";
import { relationshipHasEntities } from "./rules/relationship-has-entities";
import { noOrphanAttribute } from "./rules/no-orphan-attribute";
import { entityConnected } from "./rules/entity-connected";
import { entityHasName } from "./rules/entity-has-name";
import { attributeHasName } from "./rules/attribute-has-name";
import { relationshipHasName } from "./rules/relationship-has-name";

export const ERD_RULES: LintRule<ErdDiagram>[] = [
  // Structural errors
  entityHasPrimaryKey,
  relationshipHasEntities,
  noOrphanAttribute,
  // Best-practice warnings
  entityConnected,
  entityHasName,
  attributeHasName,
  // Informational hints
  relationshipHasName,
];

const DEFAULT_CONFIG: LintConfig = {
  rules: Object.fromEntries(ERD_RULES.map((r) => [r.id, r.defaultSeverity])),
};

export function runErdLint(
  diagram: ErdDiagram,
  config: Partial<LintConfig> = {},
): LintResult {
  const merged: LintConfig = {
    rules: { ...DEFAULT_CONFIG.rules, ...config.rules },
  };
  return runRules(diagram, ERD_RULES, merged);
}
