---
status: active
owner: migration-maintainer
updated: 2026-10-27
---

# WP09 cycle 1 correction

Audience: independent reviewer of canonical rejection event `01M5XXSNP3G66AEVV6VZ28493Z`, reviewed source `0340a599fbbe191817a577bd0a4c6efe45812be5`. This supersedes the earlier completion claim for the rejected namespace race; the original evidence remains retained.

The unchanged reviewer reproducer was copied from `/tmp/wp09-review-renata/reviewer-namespace.test.ts` to the test directory. Both copies have SHA-256 `5f4ad9b5adee9367604f5ebb287ccf0fee1696765ffefd2c3aaf5bce65e1ff13`. The original reviewer feedback and detailed log in `/tmp/wp09-review-renata/` were not edited.

## Red, correction, green

- `npx vitest run packages/sqlite/tests/migrations/reviewer-namespace.test.ts` failed before correction: the external matching-DDL marker table was adopted, `title` became `caption`, and apply reported committed/recovery-pending. Retained output: `evidence/cycle1/original-red.log`.
- The desired public-interface regression (`namespace-race.test.ts`) separately creates that table during migration backup and replaces a previously legitimate owner marker table during restore safety backup, using another real SQLite connection after observing a new online-backup file. Both refused-state assertions failed before correction; legitimate owner migration/restore control passed. Retained output: `evidence/cycle1/desired-red.log`.
- The common apply/restore worker now validates the marker table's exact owner authority immediately after `BEGIN IMMEDIATE`, before any reviewed DDL or marker write. Fingerprint exclusion of internal metadata cannot substitute for this authority check. The transaction lock excludes a later external ownership change.
- The worker reports `committed:false` only after closing its successfully rolled-back connection and only when COMMIT has not been attempted. A COMMIT attempt with an uncertain response omits this status; cancellation and hard exits likewise retain marker-based reconciliation. The parent waits for actual process exit. It can record the confirmed precommit refusal as rolled-back without trying to authenticate or adopt the foreign table that caused it.
- A real COMMIT followed by an injected ambiguous response error has an explicit regression: actual changed rows produce `committed:true,recoveryRequired:true`, and restart finalizes one marker/revision rather than claiming rollback.

After correction, migration and restore race cases return `UNSUPPORTED_SCHEMA_OBJECT` at the original project revision. Independent row hashes, rowid-bearing reads, table metadata and business SQL remain unchanged; the foreign empty table or sentinel row is unchanged. History records a validated backup and rolled-back attempt, matching retries replay the durable failed outcome, conflicting payloads reject, and restart leaves preview available without inventing a pending commit. The legitimate owner table/authority and previous migration marker remain intact across an ordinary successful restore.

## Latest verification

All commands ran in lane-i with pinned Node 24.22.1 and existing dependencies; no dependency/script policy or transport contract changed.

| Command | Observed result |
| --- | --- |
| `npx vitest run packages/sqlite/tests/migrations` | 32 passed / 8 files; 19.68 s. Includes unchanged original probe, new race/control cases, and all previous 27 migration tests. |
| `npm run build` | Passed implemented packages, production Next build and MCP executable. |
| `npm run typecheck` | Passed implemented packages. Empty generator/UI notices remain inherited. |
| `node scripts/workspace/verify.mjs module packages/sqlite/tests/migrations` | Strict checking passed for all migration sources/tests, including the unchanged reviewer test. |
| `npm test` | 229 passed / 27 files; 25.91 s. |
| `npx playwright test tests/e2e/migrations/workflow.spec.ts` | 1 passed; 3.9 s test execution. Existing visible review/Cancel/restore workflow still works. |
| `npm run lint` | Diff-scoped syntax/JSON/whitespace passed. |
| `npm run check:credentials` | Heuristic scan passed. |

Outputs are retained under `evidence/cycle1/`. Earlier crash matrix JSON, browser screenshots and logs were not overwritten. No authenticated manual browser or final mission acceptance claim is made. The isolated browser owner process and disposable roots were cleaned up. No persistent server remains to hand off.
