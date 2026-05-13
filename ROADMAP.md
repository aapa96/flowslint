# @aranzatech/flowslint — Roadmap

Librería de validación y linting para diagramas. Expone reglas puras (sin DOM,
sin ReactFlow, sin React) que reciben la estructura de un diagrama y retornan
una lista de issues con severidad, mensaje y referencia al elemento problemático.

El diseño está inspirado en `bpmnlint` pero generalizado para soportar los
cuatro tipos de diagrama que maneja AranzaGroup: BPMN, ERD, UML y C4.

---

## Principio fundamental

> **Cada regla es una función pura.**
> `(diagram: Diagram) => LintIssue[]`
>
> No hay estado, no hay efectos secundarios, no hay dependencias de red.
> Esto permite correr las mismas reglas en el browser, en Node.js,
> en un CI pipeline y en un worker thread, sin cambiar una línea.

---

## Estructura de módulos

```
src/
  core/       ← runner, tipos base, interfaz LintRule
  bpmn/       ← reglas específicas de BPMN 2.0
  erd/        ← reglas específicas de ERD
  uml/        ← reglas específicas de UML
  c4/         ← reglas específicas de C4
  index.ts    ← barrel principal
```

---

## `src/core/` — Infraestructura compartida

Todo lo que es agnóstico al tipo de diagrama vive aquí.

**Qué implementar:**

### Tipos base

```ts
type Severity = "error" | "warning" | "info";

interface LintIssue {
  ruleId: string;          // ej. "bpmn/end-event-required"
  severity: Severity;
  message: string;
  elementId?: string;      // id del nodo/edge problemático, si aplica
  elementType?: string;    // ej. "ExclusiveGateway"
}

interface LintRule<D> {
  id: string;
  description: string;
  severity: Severity;
  check: (diagram: D) => LintIssue[];
}

interface LintConfig {
  rules: Record<string, "error" | "warning" | "off">;
}

interface LintResult {
  issues: LintIssue[];
  errors: number;
  warnings: number;
  passed: boolean;         // true si errors === 0
}
```

### Runner

```ts
function runRules<D>(
  diagram: D,
  rules: LintRule<D>[],
  config: LintConfig
): LintResult
```

Itera las reglas activas (no "off"), ejecuta `rule.check(diagram)`,
aplica overrides de severidad desde `config.rules`, y agrega los resultados.

### Helper de filtro

```ts
function filterIssues(
  result: LintResult,
  options: { severity?: Severity; elementId?: string }
): LintIssue[]
```

---

## `src/bpmn/` — Reglas BPMN 2.0

### Tipo de entrada

```ts
interface BpmnDiagram {
  nodes: BpmnNode[];   // elementos del proceso
  edges: BpmnEdge[];   // sequence flows, message flows, associations
  pools?: BpmnPool[];
}
```

### Reglas a implementar

#### Reglas de estructura básica (MVP)

| ID | Severidad | Descripción |
|---|---|---|
| `bpmn/start-event-required` | error | Todo proceso debe tener al menos un start event |
| `bpmn/end-event-required` | error | Todo proceso debe tener al menos un end event |
| `bpmn/no-disconnected-nodes` | warning | Ningún nodo puede quedar sin conexiones entrantes Y salientes (excepto start/end) |
| `bpmn/no-orphan-edges` | error | Todo edge debe tener source y target válidos |
| `bpmn/gateway-has-outgoing` | error | Un gateway exclusivo/inclusivo debe tener al menos 2 salidas |
| `bpmn/gateway-has-incoming` | error | Un gateway de join debe tener al menos 2 entradas |
| `bpmn/sequence-flow-no-cross-pool` | error | Un sequence flow no puede cruzar entre pools (debe ser message flow) |

#### Reglas de buenas prácticas (v2)

| ID | Severidad | Descripción |
|---|---|---|
| `bpmn/task-has-name` | warning | Toda task debe tener un nombre no vacío |
| `bpmn/gateway-has-name` | warning | Los gateways deberían tener nombre (la pregunta de decisión) |
| `bpmn/no-implicit-split` | warning | Una task con más de una salida sin gateway previo es un split implícito |
| `bpmn/end-event-has-incoming` | error | El end event debe tener al menos una conexión entrante |
| `bpmn/start-event-no-incoming` | error | El start event no debe tener conexiones entrantes |
| `bpmn/no-multiple-start-events` | warning | Un proceso con más de un start event (sin event-based gateway) es ambiguo |
| `bpmn/boundary-event-attached` | error | Un boundary event debe estar adjunto a una task o sub-proceso |
| `bpmn/subprocess-has-start-end` | error | Un sub-proceso embebido debe tener su propio start y end event |

#### Reglas aranzaflows (namespace extendido, v3)

| ID | Severidad | Descripción |
|---|---|---|
| `bpmn/aranza/task-has-owner` | warning | Toda task en un proceso de producción debe tener `owner` asignado |
| `bpmn/aranza/critical-task-has-sla` | warning | Tasks con `priority: critical` deben tener `sla` definido |
| `bpmn/aranza/sla-format` | error | El valor de `sla` debe ser una duración ISO 8601 (ej. `PT4H`) |

---

## `src/erd/` — Reglas ERD

### Tipo de entrada

```ts
interface ErdDiagram {
  entities: ErdEntity[];
  relationships: ErdRelationship[];
}
```

### Reglas a implementar

| ID | Severidad | Descripción |
|---|---|---|
| `erd/entity-has-primary-key` | error | Toda entidad debe tener al menos un campo marcado como PK |
| `erd/entity-has-name` | error | Toda entidad debe tener un nombre |
| `erd/no-duplicate-entity-names` | error | Dos entidades no pueden tener el mismo nombre |
| `erd/relationship-has-endpoints` | error | Toda relación debe tener source y target válidos |
| `erd/relationship-has-cardinality` | warning | Toda relación debería tener cardinalidad definida (1:1, 1:N, N:M) |
| `erd/field-has-type` | warning | Todo campo debería tener un tipo definido (VARCHAR, INT, etc.) |
| `erd/no-orphan-entity` | warning | Una entidad sin ninguna relación podría estar incompleta |
| `erd/foreign-key-references-pk` | error | Un FK debe referenciar un campo PK de la entidad destino |
| `erd/no-self-relationship` | warning | Una relación de una entidad consigo misma debe ser intencional y documentada |

---

## `src/uml/` — Reglas UML

El alcance inicial cubre **Class Diagrams** y **Sequence Diagrams**.

### Reglas — Class Diagram

| ID | Severidad | Descripción |
|---|---|---|
| `uml/class-has-name` | error | Toda clase debe tener un nombre |
| `uml/no-duplicate-class-names` | error | Dos clases no pueden tener el mismo nombre en el mismo namespace |
| `uml/interface-has-methods` | warning | Una interfaz sin métodos es probablemente un marcador — documentar |
| `uml/association-has-endpoints` | error | Toda asociación debe tener source y target |
| `uml/circular-dependency` | warning | Dependencias circulares entre clases deben ser revisadas |
| `uml/abstract-class-no-instance` | info | Clases abstractas no deberían instanciarse directamente |

### Reglas — Sequence Diagram

| ID | Severidad | Descripción |
|---|---|---|
| `uml/sequence-has-actors` | error | Un sequence diagram debe tener al menos 2 participantes |
| `uml/message-has-name` | warning | Todo mensaje entre participantes debe tener un nombre |
| `uml/activation-is-closed` | error | Todo bloque de activación abierto debe cerrarse |
| `uml/self-message-allowed` | info | Los mensajes de un objeto a sí mismo son válidos pero deben revisarse |

---

## `src/c4/` — Reglas C4 Model

Los cuatro niveles de C4 son: Context, Container, Component, Code.

### Reglas — Context Diagram (Nivel 1)

| ID | Severidad | Descripción |
|---|---|---|
| `c4/system-has-name` | error | Todo sistema debe tener nombre |
| `c4/system-has-description` | warning | Todo sistema debería tener descripción |
| `c4/person-has-name` | error | Todo actor persona debe tener nombre |
| `c4/relationship-has-label` | warning | Toda relación debería describir el tipo de interacción |
| `c4/context-has-person` | warning | Un Context diagram sin ninguna persona es inusual |

### Reglas — Container Diagram (Nivel 2)

| ID | Severidad | Descripción |
|---|---|---|
| `c4/container-has-technology` | warning | Todo contenedor debería especificar la tecnología (ej. "Next.js", "PostgreSQL") |
| `c4/container-has-description` | warning | Todo contenedor debería tener descripción |
| `c4/database-has-technology` | warning | Una base de datos debe indicar el motor (ej. "PostgreSQL 15") |

### Reglas — Component Diagram (Nivel 3)

| ID | Severidad | Descripción |
|---|---|---|
| `c4/component-has-responsibility` | warning | Todo componente debería tener su responsabilidad descrita |
| `c4/no-cross-boundary-direct` | warning | Componentes de distintos contenedores no deberían comunicarse directamente sin pasar por una API/interfaz |

---

## API pública del paquete

### Uso básico

```ts
import { runBpmnLint } from "@aranzatech/flowslint/bpmn";

const result = runBpmnLint(diagram, {
  rules: {
    "bpmn/end-event-required": "error",
    "bpmn/task-has-name": "warning",
    "bpmn/gateway-has-name": "off",
  }
});

if (!result.passed) {
  console.log(result.issues);
}
```

### Entry points por tipo

```ts
// Solo reglas BPMN
import { runBpmnLint, BPMN_RULES } from "@aranzatech/flowslint/bpmn";

// Solo reglas ERD
import { runErdLint, ERD_RULES } from "@aranzatech/flowslint/erd";

// Solo reglas UML
import { runUmlLint, UML_RULES } from "@aranzatech/flowslint/uml";

// Solo reglas C4
import { runC4Lint, C4_RULES } from "@aranzatech/flowslint/c4";

// Todo junto + tipos core
import { runRules, type LintIssue, type LintResult } from "@aranzatech/flowslint";
```

---

## Plan de implementación sugerido

| Fase | Módulo | Descripción | Estimado |
|---|---|---|---|
| 1 | `core/` | Tipos base, runner, helpers | 1 día |
| 2 | `bpmn/` | Reglas MVP (7 reglas de estructura básica) | 2 días |
| 2 | `bpmn/` | Tests unitarios de reglas MVP | 1 día |
| 3 | `bpmn/` | Reglas de buenas prácticas (8 reglas) | 2 días |
| 4 | `erd/` | Reglas ERD (9 reglas) + tests | 2 días |
| 5 | `uml/` | Reglas UML class diagram (6 reglas) | 2 días |
| 6 | `uml/` | Reglas UML sequence diagram (4 reglas) | 1 día |
| 7 | `c4/` | Reglas C4 Context + Container + Component | 2 días |
| 8 | `bpmn/` | Reglas aranzaflows namespace | 1 día |
| — | Integración | Wiring en aranzaflows webapp (sidebar de lint) | 2 días |

**Total estimado: ~16 días-persona**

---

## Criterios de aceptación

- [ ] Cada regla tiene al menos 1 test de caso válido y 1 de caso inválido
- [ ] `runBpmnLint` con un diagrama vacío retorna `start-event-required` y `end-event-required`
- [ ] Un diagrama BPMN sin nombres en tareas retorna warnings (no errors)
- [ ] Las reglas en "off" no aparecen en los resultados
- [ ] El override de severidad en config funciona correctamente
- [ ] El paquete tiene **cero dependencias de producción** (solo devDependencies)
- [ ] `tsc --noEmit` pasa sin errores
- [ ] Bundle size del entry point BPMN < 20 KB (gzip)

---

## Convenciones de desarrollo

**Nombre de reglas**: `{tipo}/{kebab-case}` — ej. `bpmn/end-event-required`,
`erd/entity-has-primary-key`. Las reglas del namespace extendido van en
`bpmn/aranza/{nombre}`.

**Archivo por regla**: cada regla vive en su propio archivo dentro de
`src/{tipo}/rules/{rule-name}.ts` y exporta un objeto `LintRule`.

**Tests**: `__tests__/{tipo}/{rule-name}.test.ts`, co-ubicado con la estructura
de reglas para facilitar la búsqueda.

**Sin efectos secundarios**: las funciones `check` no deben llamar a `console`,
no deben hacer `fetch`, no deben lanzar excepciones (capturar internamente y
retornar como issue de tipo "error" si algo falla inesperadamente).
