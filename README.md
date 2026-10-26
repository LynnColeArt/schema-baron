# Schema Baron

A fresh application builder inspired by the interaction model of CodeCharge Studio 1.0, with a modern SQLite schema designer and TypeScript application output.

Status: whole-app specification and implementation plan prepared; implementation has not started. This repository is intentionally separate from the earlier Schemabaron experiment.

## Build mission

The active mission is [Schema Baron Studio](kitty-specs/schema-baron-studio-01M5W3Q9/spec.md), on `feat/schema-baron-studio` for a later PR into `main`.

- [Implementation plan](kitty-specs/schema-baron-studio-01M5W3Q9/plan.md)
- [Acceptance walkthrough](kitty-specs/schema-baron-studio-01M5W3Q9/quickstart.md)
- [Requirement-to-evidence matrix](kitty-specs/schema-baron-studio-01M5W3Q9/contracts/acceptance-matrix.md)
- [Manual reading-pack instructions](docs/references/README.md)

The plan is not implemented behavior. Work-package authoring is the next phase.

## Direction

- A compact Studio workspace: Project Explorer, central document, Toolbox, contextual Properties, and Messages.
- Pages contain forms; forms contain controls. Start with Grid, Record, Search, and Login.
- An application flow map is a core document view, showing how pages, forms, actions and parameters fit together.
- A visual schema designer supports tables, relationships, constraints and reviewed SQLite migrations.
- The first generated application target is TypeScript, Next.js, Node.js and SQLite.
- A small MCP interface is present from the first implementation slice and uses the same operations as the UI.
- Generated projects are readable, modular, independently runnable, and safe to regenerate around handwritten extensions.

See [the baseline](docs/baseline.md) for scope and [architecture boundaries](docs/architecture.md) for implementation constraints.

The earlier experiment is retained as a local reference. Its interface and accumulated feature set do not define the new baseline.
