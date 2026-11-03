# Spec Kitty review tests

The configured `review.test_command` invokes `scripts/workspace/review-gate.mjs`
from its own checkout, using Node 24.22.1 and npm 11.19.1. Spec Kitty supplies a
private absolute JUnit destination. The gate runs the real Vitest suite; the
acceptance foundation's Node-native tests remain a separate explicit command.

Spec Kitty captures a baseline in a fresh detached checkout. When local dependencies
are missing, the wrapper runs `npm ci --ignore-scripts --offline`, verifies locked
metadata and the reviewed native prebuild, then uses the existing full
`npm run build` if compiled libraries, Studio/MCP entries, generator templates or
Studio's Next production build are missing. No network fallback or lifecycle-script
exception is used. A missing cache is an actionable setup failure, not a test pass.
Acquire the current pinned lockfile and generated-output dependencies explicitly
under the supported setup procedure before retrying an offline baseline.

Complete lane-local dependency/artifact trees skip installation and building.
The caller remains responsible for rebuilding changed production source before a
head review: artifact existence does not prove freshness. The wrapper rejects a
borrowed `node_modules` root or workspace links into another checkout rather than
running against another branch's compiled code. Each invocation creates private,
separate parity/recovery/migration captures and reports stage wall times.
Stage completion timings are retained privately beside JUnit as
`<junit-path>.stages.json`; an interrupted current stage has no completion entry.

Baseline preparation and tests share Spec Kitty's existing 300-second budget.
That limit is unchanged: a cold run that exceeds it remains timed out/unverified.
JUnit test durations can sum parallel work and must not be presented as wall time.
The wrapper propagates child failure and termination; it never manufactures JUnit.

Earlier cached baseline failures are retained. A baseline captured with an absent
pytest census or missing dependency tool is infrastructure evidence, not an app
regression, and cannot establish a comparable clean baseline. Verify a new,
separately identified capture through Spec Kitty's supported capture API or a future
normal claim; never delete or overwrite the prior baseline to improve its result.
Keep source identity, actual JUnit outcomes and execution mode distinct from the
application acceptance checklist and final verdict.
