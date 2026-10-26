# Architecture boundaries

## Canonical model and operations

Maintain explicit project, schema, page, form and control models with stable IDs and validated references. Define reusable application operations over them. The Studio UI and MCP server are adapters to those same operations; neither bypasses validation or writes storage independently. Return structured diagnostics and revision information. Preview and apply use the same underlying plan and detect stale state.

The schema graph and application flow map are projections of that model. Database relationships, form bindings, links, actions and authorization are explicit metadata rather than inferred from example names. Neither the generator nor adapters may hardcode an acceptance application's table names or routes.

## Generated application

Keep Next.js pages/layouts/components focused on routing and presentation. Place application logic, runtime validation, authorization, transactions, queries and migrations behind clear module boundaries. TypeScript checking and runtime boundary validation are both required. Define generated and authored ownership so regeneration preserves user code and data. The output must run and test without Studio.

Database selection, SQL dialect, identity handling and migration planning belong to reusable capabilities. Begin with Node.js and SQLite. Choose exact libraries, supported versions and deployment details during implementation planning; these have not been selected yet.

## Migration and rendering guarantees

Schema changes are reviewed plans with backups and explicit data handling, especially SQLite table rebuilds. Generation does not silently reseed a database or alter unrelated data. A failed apply must report the actual committed/rolled-back state.

UI rerenders preserve selection, drafts, focus and navigation context. Data-derived displays declare their dependencies so cache invalidation follows writes. Authorization is enforced on the server for every operation, independent of which UI or MCP path invokes it.

## Reference experiment

The earlier Schemabaron source checkpoint is 291b4463b4696895a280cbf4940112f0ca025879 on feat/baron-core-slice. It contains useful behavior and tests but uses a different authoring model and Python-generated output. Treat it as evidence and reusable material, not as the new project's architectural foundation. Its demo and local authentication state remain outside this repository.
