# Author an application

This guide is for an author starting with a blank project. Install and start Studio using the [supported setup](../development/release.md), then open the reported local URL. Studio connects automatically; no key or account is required. On first run, finish Workspace settings. New projects default to `~/projects/schema-baron/<project name>`; choose another absolute folder (or a `~/` path) if you prefer. Workspace settings can be changed later from the command bar. Changing this preference affects future projects; existing projects stay in their saved folders. Generated visitors have separate accounts and sessions.

## Find your way around

The five regions are Project Explorer on the left, document in the center, Toolbox and contextual Properties on the right, and Messages below. Resize the docks when needed. Select a Page, Form or Control to see its Format, Data and Events properties. A page can contain ordinary content and multiple forms; a form contains controls. Project settings and database setup are separate from normal page editing. Wizards are temporary dialogs, not permanent page components.

Use New Project to create a named blank definition in a configured approved root. Save commits staged model changes; closing a wizard with Cancel creates no partial object. Open / Switch reopens definitions without restarting Studio. Definitions, database files, generated output, backups and private identity must have distinct safe locations. Approved root IDs are configured by the operator; Studio does not grant itself new filesystem access.

Drafts, selected objects and layout survive ordinary rerenders and mode changes. Undo/Redo changes model drafts, never committed database rows. Invalid fields stay editable and block inconsistent generation. An incoming agent/service revision does not silently discard your draft: inspect the conflict and explicitly Keep my draft or choose the service version before saving. Unsaved-change prompts and Messages identify unresolved work.

## Create or connect the database

Open Schema and create a SQLite connection or introspect an existing file. Inspect tables in Diagram or Table list. Add columns with explicit physical names, types, nullability and defaults; set primary keys, unique/check constraints and indexes. Use Relationships to map single or composite foreign keys and choose restrict/cascade behavior. Save stores the desired schema; it does not apply DDL.

Choose Review migration and read SQL, affected data, dependency diagnostics, backfills, destructive acknowledgments and the backup location. Required new columns on populated tables need an explicit valid backfill. Apply only the reviewed current plan. Cancel changes no database rows. External schema/data changes or a stale project revision require a fresh review; never retry an old acknowledgment against new state.

Unsupported imported views, triggers or opaque constraints are identified and preserved. Some rebuilds involving opaque expressions are refused rather than rewritten. After apply, inspect migration history and binding diagnostics. Reconnect a moved database deliberately; a missing database is not replaced with an empty one. Review Restore from the chosen compatible backup before applying recovery. See [recovery and output ownership](recovery-and-extensions.md).

## Compose pages, forms and controls

Create a page with a unique static internal route, then use Grid, Record, Search, Login or linked Grid/Record construction. Choose a source, fields, keys, allowed actions, links and appearance. Cancel is atomic. Afterwards the results are ordinary objects: select a form/control and change it directly instead of rerunning the wizard.

Grid displays selected fields with allowlisted sorting, search, bounded paging and empty states. Search forms pass declared parameters. Record binds insert/update/delete and Cancel to explicit destinations, including parent-filter and composite-key context. Add labels, text/numeric/date fields, checkboxes, select/relationship lookup, links and buttons as appropriate. Read the effective Data binding and validation diagnostics before generating. A computed value is read-only; do not create a second competing editable field for it. Single-field relationship lookup is supported; a composite relationship is not an automatic composite lookup widget.

Control captions, ordering and supported numeric formats affect generated output. Arbitrary custom form/control CSS classes, widths and form-level format rules are not implemented rendering promises: unsupported combinations produce explicit diagnostics. Do not treat a successful property edit as proof of a generated renderer feature. Static routes and one SQLite connection per project are the current target boundary. Protected query Search/navigation and exact-decimal Table Sort have explicit unsupported diagnostics; use supported declared report parameters/order instead.

## Configure visitor login and access

Open Login and access. Choose managed identity or an explicit compatible mapped identity source, inspect the global public/authenticated default, page inheritance/overrides and per-action login requirements, and provision a visitor through the masked fields. Credentials are cleared after provisioning. Generated Login controls declare username/password roles; captions and positions do not define credential semantics. Add current identity and Login/Logout controls where visitors need them.

A public list can keep Record writes protected. The effective policy and its source are shown; server handlers enforce that policy even if someone submits directly. A protected link offers login and resumes only declared internal routes with typed allowed parameters. Cancel returns to the public context. Logout revokes the session and leaves public pages usable. External/undeclared return targets, anonymous protected writes and missing CSRF proof fail.

Portable exports contain no managed accounts or sessions. The deployment operator must follow [independent output and provisioning](portable-output.md) before expecting visitor login in the exported application.

## Build reusable queries and reports

Use Query Designer to select aliased sources, inner/left joins, fields, typed parameters, predicates, grouped aggregates, calculated expressions and ordering. Preview SQL, result shape and bounded sample rows. Aggregate predicates belong in HAVING; ordinary predicates belong in WHERE. Make zero-child totals explicit. Review fanout diagnostics before summing across multiple child relationships.

Save a named query and bind a report form to it. Declare parameter filters, formatting and row links with stable references. Quantity × price and monetary totals use explicit scale and exact-decimal rules; test fractional values and zero children. Child writes refresh dependent reports. Query preview and generated report results should agree with your independent expected calculation.

## Inspect behavior and use the five modes

The application map derives page/form/action nodes, login gates, success/Cancel paths and parameter mappings from the same project. Select a node or edge to edit its actual rule in Properties; no parallel graph needs maintenance. Route/endpoint projection is separate from the schema diagram. Messages select offending objects for broken links and bindings.

| Mode | What it shows and edits |
|---|---|
| Design | The current page's forms, controls and content; select objects and edit contextual properties. |
| HTML | Constrained static HTML with stable references to forms/controls; unsupported markup or missing/duplicate references receive diagnostics. This is not arbitrary script/CSS roundtrip. |
| Code | Generated modules are read-only. Only declared authored extension modules are editable and saved as source. |
| Preview | Sandboxed current draft, including unsaved content. It is separate from a generated application's data/runtime. |
| Live Page | The selected corresponding route in the generated visitor application after explicit install/build/start. It can lag behind your current draft until regeneration. |

Review generation before Apply. Choose an approved output destination distinct from database and definitions. Resolve diagnostics/conflicts; generation cannot guess stale schema bindings. Install dependencies explicitly, Build generated output, then Start / retry with a chosen loopback port. Opening a project or Code never installs dependencies automatically. Build/start failures remain visible with actionable diagnostics. Stop terminates only that managed application's owned process group.

For extensions, repeated regeneration, failed apply recovery and export, continue with [recovery and extensions](recovery-and-extensions.md) and [portable output](portable-output.md). For historical interaction references, use the [local reading-pack instructions](../references/README.md); do not copy the PDF or its derived pages into public artifacts.
