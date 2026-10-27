import type {
  Diagnostic,
  EntityBatchOperation,
  Project,
} from "@schema-baron/model";
export interface Capabilities {
  operations: { operation: string }[];
  approvedRootIds: string[];
  workspace?: { projectsFolder: string; configured: boolean };
}
export interface Replay {
  lastSequence: number;
  refetch: boolean;
  diagnostics: Diagnostic[];
}
export interface Summary {
  id: string;
  name: string;
  revision: number;
}
export class OwnerError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly diagnostics: Diagnostic[] = [],
  ) {
    super(message);
  }
}
/** The reusable owner key never enters this client. Only short-lived session CSRF proof lives here. */
export class StudioClient {
  csrf = "";
  async read<T>(
    path: string,
    body?: unknown,
    method = body === undefined ? "GET" : "POST",
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`/api/v1/${path}`, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(path === "session" && method === "POST" ? { "x-schema-baron-local": "1" } : {}),
          ...(this.csrf ? { "x-csrf-token": this.csrf } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new OwnerError(
        "SERVICE_UNAVAILABLE",
        "Studio service is unavailable. Check the owner process, then retry. Your drafts are retained.",
      );
    }
    const outcome = await response.json();
    if (!outcome.ok)
      throw new OwnerError(
        outcome.error?.code ?? "SERVICE_UNAVAILABLE",
        outcome.error?.message ??
          "Studio service returned an unreadable response.",
        outcome.diagnostics ?? [],
      );
    return outcome.result as T;
  }
  async resume() {
    let session: { csrfToken: string };
    try { session = await this.read<{ csrfToken: string }>("session"); }
    catch (error) {
      if (!(error instanceof OwnerError) || error.code !== "AUTH_REQUIRED") throw error;
      session = await this.read<{ csrfToken: string }>("session", {});
    }
    this.csrf = session.csrfToken;
  }
  async disconnect() {
    await this.read("session", undefined, "DELETE");
    this.csrf = "";
  }
  saveWorkspace(projectsFolder: string) {
    return this.read<NonNullable<Capabilities["workspace"]>>("workspace", { projectsFolder }, "PUT");
  }
  capabilities() {
    return this.read<Capabilities>("capabilities");
  }
  list(root: string) {
    return this.read<Summary[]>(
      `projects?approvedRoot=${encodeURIComponent(root)}`,
    );
  }
  snapshot(id: string) {
    return this.read<Project>(`projects/${encodeURIComponent(id)}`);
  }
  create(name: string, approvedRoot: string, requestId: string) {
    return this.read<Project>("projects", {
      requestId,
      name,
      approvedRoot,
      target: "next-typescript-sqlite",
    });
  }
  batch(
    project: Project,
    operations: EntityBatchOperation[],
    requestId: string,
  ) {
    return this.read(`projects/${encodeURIComponent(project.id)}/commands`, {
      requestId,
      operation: "project.batch",
      expectedRevision: project.revision,
      input: { operations },
    });
  }
  async events(id: string, after: number): Promise<Replay> {
    let response: Response;
    try {
      response = await fetch(
        `/api/v1/projects/${encodeURIComponent(id)}/events?afterSequence=${after}&limit=100`,
        {
          credentials: "same-origin",
          cache: "no-store",
          headers: { "x-csrf-token": this.csrf },
        },
      );
    } catch {
      throw new OwnerError(
        "SERVICE_UNAVAILABLE",
        "Studio service is unavailable. Your drafts are retained.",
      );
    }
    if (!response.ok) {
      const outcome = await response.json();
      throw new OwnerError(
        outcome.error.code,
        outcome.error.message,
        outcome.diagnostics,
      );
    }
    const result: Replay = {
      lastSequence: after,
      refetch: false,
      diagnostics: [],
    };
    for (const frame of (await response.text()).split("\n\n")) {
      const lines = frame.split("\n"),
        event = lines.find((line) => line.startsWith("event: "))?.slice(7),
        data = lines.find((line) => line.startsWith("data: "))?.slice(6);
      if (!data) continue;
      const value = JSON.parse(data);
      if (event === "refetch") result.refetch = true;
      if (event === "revision") result.diagnostics = [];
      if (typeof value.sequence === "number") {
        if (value.sequence !== result.lastSequence + 1) result.refetch = true;
        result.lastSequence = value.sequence;
        if (event === "diagnostic" && Array.isArray(value.diagnostics))
          result.diagnostics.push(...value.diagnostics);
      }
    }
    // A gap invalidates tentative replay. The caller always refetches the authoritative snapshot.
    if (result.refetch) result.diagnostics = [];
    return result;
  }
  diagnostics(id: string) {
    return this.read<{ valid: boolean; diagnostics: Diagnostic[] }>(
      `projects/${encodeURIComponent(id)}/diagnostics`,
    );
  }
}
