# OSS image upload qualification

Public source base: c3f33fc365b9fd19495c4faef600720f26413683.
Local branch: octavia/oss-image-upload. No packaging/publication/push performed.

Pinned Node24.22.1/npm11.19.1. Dependencies reused from installed official pinned
packages; generated application installed from its emitted lock with offline npm ci
and scripts disabled. sharp0.35.5 is explicit in generated package metadata.

Final exact implementation checks:
- `vitest run packages/generator/tests/images/runtime.test.ts`: 3/3 passed.
  Model/config rejection; emitted real application normalization/SQLite integration,
  install/typecheck/production build; actual ProjectCore save/reopen of image folder.
- Focused model, forms scalars, Record behavior and authentication: 71/71 passed
  across5files. Full workspace build passed (existing unused UI package reports
  NOT IMPLEMENTED; not claimed implemented).
- `browser-qualification.mjs <owned-runtime-root>`: actual built Next on loopback
  and sandboxed system Chrome; multipart action upload -> record-backed display;
  reopen, no-file preservation, CSRF403, JSON image-key forgery400, private page
  unauthenticated image read401. Browser and test server stopped afterward.
- Metadata-bearing PNG/JPEG fixtures generated in memory; orientation6 is applied,
  3000×1500 becomes2048×1024, source metadata absent in fresh decoded WebP. Source
  bytes differ and never appear in asset store. SVG, malformed/truncated/oversized,
  APNG-marker and image-bomb inputs rejected. Real stored-key replacement,
  invalid replacement preservation, missing record and symlink-root rejection.

Initial tests caught a non-image generated TypeScript narrowing failure and it
was fixed. Existing navigation runtime subsequently completed generation,
TypeScript and production build but could not run its browser stage because its
bundled Playwright Chromium is not installed. No browser download or alteration
of that existing test was performed. The dedicated image browser proof uses the
available system Chrome with its sandbox enabled. Full pre-existing E2E suite
was not run and should not be inferred from these focused results.

Current limits are explicit in ../../image-uploads.md: Linux/proc, single still
image per Record, no explicit remove, no image grids/query controls, no tenant
row policy, operator storage/quota responsibility, no automatic old/orphan cleanup.
DB errors do not prove rollback, so normalized assets remain after DB attempts.
No full crash/concurrent-save/garbage-collection qualification is claimed.
