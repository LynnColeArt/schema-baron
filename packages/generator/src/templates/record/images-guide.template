# Image uploads in generated applications (local review slice)

Add an **image** control in a table-backed Record form and bind it to an editable,
non-generated SQLite TEXT column that is not a key. Use a nullable column if the
image is optional. Set **Image folder** to an optional relative folder such as
`catalog/photos`; letters, digits, underscore and hyphen segments only. One image
control per Record form is supported. All controls sharing that stored field must
be image controls with the same folder; text editing of asset keys is rejected.
This prototype does not offer image controls on grids, queries or Login forms.

The generated Record form accepts PNG, JPEG or WebP up to 5 MiB, one still image
per save. Images are untrusted: format signatures and bounded decoding are checked,
animated/multipage input is rejected, source dimensions are capped at 8192 per
side and 16 million pixels. The server applies orientation, resizes within
2048×2048 without enlargement, converts to sRGB decoded pixels and encodes fresh
WebP (quality82). EXIF, XMP, IPTC and source profiles are not copied. Original
bytes and names are never written or served. Native `sharp`0.35.5 is an explicit
pinned dependency, not merely an assumed optional Next dependency. Run `npm ci`
from the emitted lock, and keep the decoder dependencies maintained.

Leave the file input empty on edit to preserve the existing image. Selecting a
new image replaces the row's opaque reference after normalization and storage.
Explicit remove is not provided in this first slice. A rejected image or invalid
record leaves the prior image/reference intact. The generated JSON Record API
cannot submit image keys; actual files go through the CSRF-protected form action.
Next Server Actions use a 6 MiB total request limit; normal form fields consume
part of that allowance. Unusually large forms can therefore reject a near-limit
file. Deploy matching or smaller ingress limits; never disable CSRF/origin checks.

## Operator configuration

Current storage implementation requires **Linux and mounted /proc**. It is not
yet a portable macOS/Windows upload implementation. Create a dedicated absolute
storage root outside the generated application/source/public tree, owned by the
application's service account, mode0700. Start the app from its generated project
directory and set `SCHEMA_BARON_IMAGE_ROOT=/absolute/private/image-storage`.
Do not share writable storage with other principals or serve it through nginx,
Next public assets or another static directory. No symlink path components are
accepted. Folders/files are accessed through retained directory descriptors and
nofollow opens. File names are random server-issued opaque `.webp` keys; the
SQLite field never stores paths or original filenames.

The process working directory is part of the deployment contract: launching from
a different directory weakens the check excluding the application's own tree.
The operator must keep this storage separate regardless. Treat the root/folder
mapping as deployment configuration: changing either does not move old assets.
Plan any relocation with a stopped service, backup and reference verification.

Generated reads use `/runtime/record-N/image` with the normal record parameters
and declared `_field`, not a caller-supplied key or path. The route authorizes the
owning page, loads that exact record and then reads its stored key. It serves
`image/webp`, `nosniff`, private/no-store. Existing public pages intentionally allow
public image reads; authenticated pages require their session. Existing policies
are page/action public-or-authenticated, not tenant or per-row ownership controls.

## Retention, failure and regeneration

Only successfully encoded WebP enters storage. Failures while creating a new
file clean up only a file created by that operation, never a pre-existing name.
Files and newly made directory entries are fsynced before database use. SQLite
and files are still **not one atomic transaction**. The current Record service
turns database exceptions into user-facing state, which does not independently
prove rollback. Therefore normalized files are retained after every database
attempt, even a rejected save, rather than risking deletion of a committed row's
image. Unexpected crashes can leave sanitized orphan files. Successful replacement
also retains the old asset. There is no automatic garbage collector or global
reference counting, and no deletion of valid old images on replace/delete.

Operators must budget storage, back up both database and asset tree, and reconcile
unreferenced keys offline with a verified backup before any deletion. This slice
is unsuitable for unattended unbounded uploads without a quota/retention plan.
It does not claim cross-store crash atomicity or a production concurrency quota.

Images are runtime business data outside generated code. Do not include the asset
root in source generation, project exports or Git. Regeneration changes source,
not uploaded image files; preserve the environment setting and storage mapping.
The additive image-control schema requires this version of the prototype: older
strict readers may reject it. Keep a project backup before returning to older builds.
