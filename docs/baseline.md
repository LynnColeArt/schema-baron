# Product baseline

## Reference and learning goal

The primary visual and workflow reference is the user-supplied CodeCharge Studio 1.0 manual, filename 586401818-CodeCharge-Studio-Manual-B3.pdf. It documents an evolving beta. Useful sections: workspace pp. 20–30; data sources/query designer pp. 53–64; forms pp. 79–81; Grid and Record wizard pp. 117–124; document modes pp. 134–137. Do not redistribute the manual without permission.

The goal is a coherent tool a person or agent can learn through a small vocabulary and consistent operations. The acceptance test is building a different application through the product, without editing its saved model or database through hidden setup scripts.

## Authoring experience

Use the original workspace proportions, compact controls and docked panes as the visual baseline. Preserve legible modern text, keyboard operation, resizing and high-DPI support. Select an object in the document or Explorer to inspect its properties; expose Format, Data and Events in context. Complex configuration opens in focused dialogs.

Pages contain multiple forms and ordinary content. Forms contain controls. The first four form kinds are Grid, Record, Search and Login. Wizards create these objects, then normal editing continues on those same objects. A project-creation wizard is a bounded construction workflow rather than a persistent feature on every page.

Document modes are Design, HTML, Code, Preview and Live Page. Editing and rendering should preserve selection, draft state and stable object identities.

## Application flow map

This is a core feature remembered by the user, even though the supplied manual does not document an endpoint graph. Derive it from the canonical project model. Show pages/forms and their navigation, submission, login, Save and Cancel paths; inspect passed keys and parameters. Clicking a node or edge selects the corresponding object or rule. Keep a route/endpoint view available without making ordinary editing more complicated. Do not require a second manually maintained graph.

## Schema builder

Treat schema authoring as an explicit addition. The manual shows connections, query design and an Access driver Create button, but does not establish a full table/column/constraint designer.

Support a visual table/relationship canvas with a focused table editor: types, defaults, nullability, primary/composite keys, foreign keys, unique/check constraints and indexes. Preview proposed SQL and data impact before applying a migration. Handle SQLite rebuilds, backups, migration history and existing-data preservation deliberately. The schema is directly usable by the form wizards and generator.

## Initial target and agent access

Generate one TypeScript/Next.js application pattern on Node.js with SQLite. Keep database access and migrations server-side. Use React server/client boundaries intentionally and keep business logic in ordinary application modules. Do not add another language target initially.

MCP starts with inspect, structured project/schema/page/form/control changes, previews, generation and diagnostics. It shares validation, persistence, revisions and permissions with the UI. Expand its surface alongside implemented workflows.

## Proposed first end-to-end slice

Create a blank project and a small equipment-checkout schema (assets, borrowers, loans) using the schema designer. Build linked Grid/Record forms plus login using focused wizards. Inspect the resulting flow map, generate and run the application, then regenerate after a model change while preserving data and an authored extension. Exercise the same project operations through MCP. This is an acceptance scenario, not a preseeded application the generator knows about.

## Scope discipline

Preserve useful generation, security, transactional, identity and rendering lessons from the old experiment. Port code only after checking that it fits the new object model. Defer the broad specialized-builder catalog and additional output languages. A full second independent project walkthrough remains necessary; isolated fixtures alone do not prove the authoring experience.
