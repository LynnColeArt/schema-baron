# Breadcrumbs and navigation menus

In Studio, select a page and open **Properties → Format → Breadcrumb parent**.
Choose a declared ancestor or **None**, then use the ordinary Save/Undo/Redo flow.
Parents are explicit; URL nesting does not infer ancestry. Cycles and missing
parents are rejected. Generated breadcrumbs omit protected or parameter-dependent
ancestors, link safe public ancestors, and show the current title as plain text.
Existing pages without a parent retain their heading without a breadcrumb bar.

Open **Project settings → Edit application navigation…** to author an ordered menu.
Add existing pages or labeled HTTPS links. Rename or edit links, reorder with the
keyboard buttons or drag handle, and choose external-link visibility. External
links require sign-in by default; choosing Public changes their visibility only.
Only **Save navigation** writes the revision-checked canonical configuration.
Close/Escape guards an unsaved draft; Keep editing retains it. Failed saves retain
the draft and require explicit reload after conflict or uncertain completion.
Menu editing is disabled while ordinary model drafts are dirty.

The generated menu renders on the server. A configured entry grants no access:
page permissions and the actual visitor session filter links before HTML/RSC
serialization. Pages requiring row keys or other unresolved parameters are omitted.
Unsafe URLs, credentials in URLs, duplicate menu IDs and missing page destinations
are rejected. Empty/absent menus preserve the unwrapped content. The menu is
responsive, keyboard-accessible and marks the active page.

These optional fields retain the public format-1 model and runtime defaults.
Older strict readers may reject newly configured fields; preserve a project backup
before opening a configured project in an older build. Studio and generated output
use Next.js 16.4.6 so the existing security build blocker is patched.

## Verification — November 17, 2026

Pinned Node 24.22.1/npm 11.19.1: typecheck, Studio/MCP/package builds, native
SQLite/hash verification, dependency verification, lint and credential checks pass.
The complete regression suite passes **558 tests in 89 files**. The focused
feature suite passes **42 tests**, including generated production SSR/RSC checks
for anonymous, valid, expired and revoked visitor sessions. A real Studio browser
flow verifies menu save/reopen, draft retention, saving while dismissal is pending,
and breadcrumb parent persistence. Runtime dependency audit reports zero findings.
Only feature source/tests were exported; no other distribution's history or runtime
configuration is included.
