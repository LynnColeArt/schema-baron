# Recover changes and extend generated code

This guide is for an author who has already generated an application. Keep the definition, external business database, migration history, private identity/session store and secrets outside replaceable output. Review output differences before every promotion.

## Reviewed apply and recovery

A preview is tied to the project revision, plan hash and observed database/output state. If any changes, review again. Canceling before durable commit leaves the prior state. If cancellation arrives after commit, inspect the reported committed outcome; cancellation cannot reverse a transaction already committed.

Migration apply creates the disclosed online backup and records history. A failed rebuild leaves the old database intact; a failure after database commit can require owner reconciliation. Preserve the journal, active files and backup, reopen the same configured owner, then inspect the actual outcome before retrying. A retry is idempotent for its request; it does not imply another migration. Use the product's backup inspection/restore review and explicit apply to restore a compatible database. Do not rename a retained journal or delete an identity file to clear an error.

Generation stages a complete new tree and promotes it recoverably. An interruption can retain an old tree, new tree and promotion journal. Reopen and preview through Studio so the canonical recovery logic can establish the complete active tree. If external bytes or a retained backup changed, preserve them and resolve the diagnostic; the product refuses uncertain recovery. Do not copy individual generated files between incomplete trees.

Modified generated files and unknown source stop apply. Preserve your changes outside output, move supported custom logic into a declared authored contract, and restore the owned source to its last generated version before reviewing again. Source-less unknown files are not silently adopted. Rebuildable node_modules/.next content is disclosed and retained in the recoverable prior tree; install/build explicitly after promotion. Removing a page removes only owned output after review and does not authorize deletion of unrelated files.

## Authored extension interface v1

Declare a validator, action, service or event extension contract in the project, then select its authored module in Code. Read source before editing; save the authored source explicitly. Generated modules remain read-only. Modules must stay in their declared `authored/name.ts` path; ownership is part of the generation manifest.

Use the generated `server/extension-contracts.ts` types and the module's declared interface: `contractVersion = 1`, `validate` for validators, `execute` for actions, `beforeWrite` for services, or `afterWrite` for events. Bind custom actions with `extensionHookRef`. Validators/services run after built-in server validation and before Record writes; events run inside the same SQLite transaction after writes. Throwing rolls back the transaction and keeps validation input visible. All v1 hooks are synchronous. Avoid network calls and irreversible external side effects, which SQLite cannot roll back. Cancel invokes no hooks. These are Record-write extension points, not unrestricted arbitrary lifecycle events.

Test the actual generated behavior: reject one invalid input without rows changing, accept corrected input, and inspect success/Cancel destinations. Change the schema or form, regenerate twice and compare authored bytes, business rows and migration history. Both acceptance applications retain this proof in the [readiness reconciliation](readiness.md).

Never edit generated authorization/persistence to bypass a diagnostic. An unsupported event or layout option should remain an explicit boundary rather than being hidden by handwritten engine changes.
