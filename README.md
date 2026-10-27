# Schema Baron

Schema Baron is a local application builder with a compact Studio, SQLite schema and query designers, application flow views, and independently runnable TypeScript/Next.js output. Pages contain forms; forms contain controls. Grid, Record, Search and Login wizards create ordinary editable objects.

Start with the [author guide](docs/user-guide/index.md). Contributors should follow the [supported setup](docs/development/release.md) before starting Studio. [Owner service and MCP](docs/development/operations.md) describes private local configuration and the shared command interface.

The current implementation includes reviewed migrations, local visitor identity and access rules, query-backed reports, Design/HTML/Code/Preview/Live Page, authored extension modules, recoverable regeneration and portable export. The [readiness record](docs/development/release.md#observed-readiness) separates observed results from limitations. Linux x64/glibc is the exercised platform; there is one SQLite connection per project and one output target.

The active [Schema Baron Studio mission](kitty-specs/schema-baron-studio-01M5W3Q9/spec.md) lands on `feat/schema-baron-studio` before a later reviewable PR into `main`. Planning tables retain their original Open/Planned wording; the [observed requirement reconciliation](docs/user-guide/readiness.md) records execution evidence. This checkout is not a deployment.

The earlier experiment remains archived. It does not define this product's scope or supply demo credentials. The [manual reading-pack builder](docs/references/README.md) creates private local reference material; the supplied PDF and its derivatives are not distributed here.
