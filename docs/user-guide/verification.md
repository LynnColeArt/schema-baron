# Studio verification

Use Node 24.22.1 and npm 11.19.1. From a clean committed checkout:

```sh
export PATH=/home/lynn/.nvm/versions/node/v24.22.1/bin:$PATH
node scripts/acceptance/run.mjs all
```

The runner installs locked dependencies with lifecycle scripts denied, acquires native/output/browser prerequisites, builds before consumers, runs current automated checks and the explicit Node evidence/report tests, runs legacy studies in dependency order, then runs two fresh mission cycles. Each cycle serializes regeneration (both complete ordinary UI journeys, two promotions each), independent exports with Studio stopped, access, quoted existing-database variant, drafts, Library migration recovery, bounded parity, both measured application journeys and the shared interruption contract bridge. Every Playwright phase uses one worker and zero retries. A failed producer stops its consumer and the cycle. Failures remain in separate private directories; a code/harness change requires a new full pair.

Normal definitions and business records use Studio and generated forms. The quoted existing-database input and fault/parity fixtures are separately labeled. The interruption suite demonstrates a shared application-independent contract; it does not claim two schema-specific interrupted UI journeys. AC-017 is a bounded real MCP smoke, separate from the full MCP workflow.

Private captures and credential-bearing handoffs remain under fresh 0700 temporary roots. Only selected result fields and hashes enter `docs/evidence/verification/schema-baron-final-*`. Raw JSON reports, screenshots, databases, identity stores and owner configuration must remain private. The report records all 20 cases and 29 requirements. Pending, skipped, failed, stale or missing proof cannot qualify. AC-020 remains pending independent WP09 review; author execution produces at most `CANDIDATE_READY`.

`prepare`, `checks`, `legacy`, `cycles` and `browser` modes are diagnostic subsets. `browser` is the hosted post-verify entrypoint and runs legacy studies plus both cycles. Only `all` assembles complete local qualification. A subset is never a replacement for current automated checks. Hosted status is obtained from the actual linked CI run, independently of local status.

Each application records all 30 samples on its normal populated UI-authored fixture. Feedback includes visible Explorer text; valid Save includes visible acknowledgement and the exact durable value. Draft receipt, focus, selection, single-control ownership, ordered business tuples, model fields and authored bytes are checked. Intentional unrelated title edits are restored with ordinary controls. p95 is sorted index `ceil(.95*n)-1`; feedback must be at most 2 seconds, every valid Save at most 5 seconds. Dependency acquisition and builds are outside these timings. Machine, fixture sizes and per-sample load are retained.

An independent reviewer should inspect the immutable public proof and private original JUnit/JSON census, rerun `node --test scripts/acceptance/evidence.test.ts scripts/acceptance/report.test.ts`, and use the canonical ledger command after recording their review observations:

```sh
node scripts/acceptance/inventory.mjs check-ledger <private-ledger> <checkout> <qualified-code-sha>
```

The command deliberately fails while AC-020 is unverified. WP09 must record its independent passed review observations with defect ID `AC020-independent-review` and `retests_observation` set to `candidate-review/workshop` or `candidate-review/library`, then close that pending review record before final acceptance. The author never supplies those observations.

For a final report API judgment, independent review metadata alone is insufficient. Supply `review.work_package: "WP09"`, an `actor` distinct from report `author`, the exact qualified revision, and two hash references: `ledgerEvidence` points to the actual successful canonical `check-ledger` JSON; `observationsEvidence` points to `{schema:"independent-acceptance-review/v1", revision, work_package:"WP09", reviewer, author, records:[...both linked AC-020 observations...]}`. Every case/application and requirement must already be passed before `PASS` is possible. Candidate reports retain only the exact independent-review dependencies as pending.

After independent observations are appended, regenerate the case/requirement matrix with `dispositions` against the actual ledger before invoking `qualify`; a valid review artifact cannot override pending fields in its input.
