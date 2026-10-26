# Schema Baron

A fresh application builder inspired by the interaction model of CodeCharge Studio 1.0, with a modern SQLite schema designer and TypeScript application output.

Status: baseline captured; implementation has not started. This repository is intentionally separate from the earlier Schemabaron experiment.

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
