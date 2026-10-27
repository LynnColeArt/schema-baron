# Completed-mission lint follow-up

Audience: the mission reviewer and release operator. Root-authorized verifier-only repair after all 26 WPs were Done and strict acceptance passed. No WP status/verdict was reopened; no application/generator/runtime or historical proof file changed.

The retained lane fast-forwarded to approved feature source `f455d796bcd1c1d65e97f58f795474c875283838`. Root's final PR-baseline verification used `0690035de82e68e068e4f94690a51081413f1030` and exposed 15 historical `.log` captures with trailing whitespace or terminal blank lines. The exact diagnostics remain in `baseline-before.log`; `preserved-captures.json` compares every affected Git blob with the approved source and records byte hashes. All 15 remain identical.

The whitespace-only exemption reserves `.log` and `.trace` for verbatim console/process captures within four existing evidence-root patterns:

- `docs/evidence/**`
- `packages/*/tests/**/evidence/**`
- `tests/e2e/*/evidence/**`
- `scripts/release/evidence/**`

Git glob pathspec exclusions apply only to those two extensions and only to `git diff --check`; the baseline is unchanged. Markdown, TypeScript, JSON, text and other extensions remain subject to whitespace checks even inside evidence roots. Capture extensions outside the roots and similar-prefix directories such as `evidence-ish` are not exempt. JavaScript syntax and JSON parsing remain active. Changed-file discovery uses Git `-z` and NUL splitting so spaces/newlines are preserved rather than interpreted as line delimiters or quoted paths. No warning suppression or proof-byte normalization was used.

A new real temporary Git repository establishes a committed baseline, modifies eight raw captures with actual trailing whitespace/blank EOF, and independently confirms ordinary `git diff --check` fails. The original verifier fails the capture-tolerance assertion (`regression-red.log`). The repaired verifier accepts the captures without changing bytes but rejects the identical whitespace in authored `.ts`/`.md`/`.txt`, spaced/newline Markdown names, outside-root `.log`, and all four similar-prefix roots. Valid modified `.mjs`/`.json` files with spaces/newlines pass; invalid syntax/JSON still fails. Full workspace-harness tests pass **12/12**, maxWorkers2 (`regression-green.log`), including missing-baseline refusal and standalone-tool isolation.

The sparse retained lane has a pre-existing tracked skip-worktree planning `status.json` absent from its filesystem. Once whitespace passes, its full lint reaches that file and reports ENOENT (`sparse-lane-limit.log`). No runtime/planning file was restored or mutated to conceal that lane-layout limitation. A disposable complete local Git checkout of the same approved source plus only the verifier/test/evidence deltas runs the actual full baseline lint; `complete-checkout-lint.log` records its observed exit. This is a local Git verification fixture, not an application output or hosted CI claim. Root will separately fast-forward the fix and rerun primary verification.
