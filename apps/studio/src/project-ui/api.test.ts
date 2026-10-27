import { afterEach, expect, test, vi } from "vitest";
import { StudioClient } from "./api.js";
afterEach(() => vi.unstubAllGlobals());
const diagnostic = {
  code: "VALIDATION_FAILED",
  severity: "error",
  message: "Route is duplicated.",
};
test("a later committed revision supersedes replayed validation errors", async () => {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        `id: 2\nevent: diagnostic\ndata: ${JSON.stringify({ sequence: 2, revision: 1, diagnostics: [diagnostic] })}\n\nid: 3\nevent: revision\ndata: {"sequence":3,"revision":2,"diagnostics":[]}\n\nevent: replay-complete\ndata: {"lastSequence":3}\n\n`,
      ),
  );
  expect(await new StudioClient().events("project", 1)).toEqual({
    lastSequence: 3,
    refetch: false,
    diagnostics: [],
  });
});
test("event gaps discard tentative diagnostics and require authoritative snapshot refetch", async () => {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        `id: 4\nevent: diagnostic\ndata: ${JSON.stringify({ sequence: 4, revision: 2, diagnostics: [diagnostic] })}\n\n`,
      ),
  );
  expect(await new StudioClient().events("project", 1)).toEqual({
    lastSequence: 4,
    refetch: true,
    diagnostics: [],
  });
});
