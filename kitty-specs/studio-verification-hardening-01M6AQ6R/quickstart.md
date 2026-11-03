# Verification Mission Quickstart

This is the planned procedure, not executed acceptance evidence. Start from this mission's final implementation revision when tasks have been authored and reviewed.

## Prepare

Use the repository's supported Linux toolchain and `.nvmrc`. Follow `docs/development/release.md`. Keep lifecycle scripts denied. Acquire browsers/output dependencies before independent/offline phases. Use a fresh private acceptance root, an explicit `SCHEMA_BARON_OWNER_CONFIG`, a loopback owner on an unused port, and a separate browser context. Configure a fresh project-parent folder through Workspace settings.

Allowed terminal phases (await each before the next dependent phase):

```sh
npm ci --ignore-scripts
node scripts/release/acquire-output.mjs
npm run native:verify
npm run typecheck
npm run build
```

The application owner is started with the documented Studio command and explicit private config, not the user's live config. Private project/business/identity/output folders must be separate according to the existing storage rules. The acceptance runner and fixture helpers are planned implementation outputs; do not claim they exist or that acceptance has run yet.

## Author and prove

1. Follow `data-model.md` to create Workshop Planner through New Project and Schema. Review pages/login/flow before Complete. Configure names, row links, page/action policies and reports through ordinary Studio editors; any needed hidden patch is a failing case.
2. Generate to the project's configured output. Install generated dependencies with `npm ci --ignore-scripts`, then type-check/test/build and run using supported runtime controls. Exercise AC-002,004..008 and the corresponding failure cases.
3. Independently create Library Catalog and its queries/reports; connect the stable existing-database variant and verify read-only inspect/Cancel. Exercise AC-003,005..010 and AC-019.
4. Exercise Code/customization, two regenerations, reviewed conflicts, runtime/recovery and export/independence as AC-010..017 specify. Compare exact rows/decimals and authored hashes; stop Studio only for the isolated independence phase and verify both owner and independent app states.
5. Capture 30 bounded interactions for responsiveness/draft stability. A timing failure is a real failed requirement to investigate, not a reason to add sleeps or rewrite expected timing.
6. Repeat the complete authoring/visitor/regeneration sequence in another fresh private root, then perform independent review and the requirement verdict. Never remove a failed run from the history.

## Final checks and evidence

Use run-specific ignored evidence paths for suites that write captures. For example, use three task-specific absolute paths for `SCHEMA_BARON_PARITY_EVIDENCE`, `SCHEMA_BARON_RECOVERY_EVIDENCE` and `SCHEMA_BARON_MIGRATION_EVIDENCE` before the full test command; do not overwrite historical reports. Run appropriate current `npm test`, `npm run typecheck`, `npm run build`, `npm run lint`, credential/dependency/native checks and the acceptance browser scenarios after the final implementation change. The browser runner/report commands will be supplied by the implementation concerns.

Apply `contracts/acceptance-run.md` and `checklists/acceptance.md`; every AC and requirement gets a disposition with code/run/evidence. Keep secrets and raw private studies out of Git. A reviewer must be able to reproduce both apps without bespoke configuration/source repairs. No pass is claimed until that evidence exists.
