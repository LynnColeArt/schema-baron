import { existsSync, lstatSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  createId,
  parseProject,
  operationInputSchemas,
  reviewedPlanSchema,
  validatePlanApplication,
} from "@schema-baron/model";
import type { Job, Project, ReviewedPlan } from "@schema-baron/model";
import { hash, safePath, StorageError } from "@schema-baron/storage";
import type { MigrationJournal, ProjectStorage } from "@schema-baron/storage";
import {
  committed,
  MigrationError,
  MigrationWorker,
  observed,
} from "@schema-baron/sqlite";
import type { Inspection } from "@schema-baron/sqlite";
import type { CommandRegistry } from "../commands/index.js";
import { connectionPath } from "../connections/index.js";
import { planHash } from "../plans/index.js";
import type { PlanRepository } from "../plans/index.js";
interface Options {
  ownerId: string;
  metadataRoot: string;
  approvedRoots: Record<string, string>;
  migrationFault?: (point: string) => void;
  migrationWorkerFault?: string;
}
export class CommittedMigrationError extends StorageError {
  constructor(
    readonly result: {
      planId: string;
      committed: true;
      recoveryRequired: true;
      backupRef: string;
    },
  ) {
    super(
      "RECOVERY_REQUIRED",
      "Database committed. Restart to reconcile project metadata; do not restore or apply again.",
    );
  }
}
type DBPlan = Exclude<ReviewedPlan, { kind: "generation" }>;
/** One writer, one metadata journal, one marker in the actual SQLite transaction. */
export function registerSchemaApply(
  registry: CommandRegistry,
  options: Options,
  storage: ProjectStorage,
  plans: PlanRepository,
) {
  const running = new Map<
    string,
    {
      worker: MigrationWorker;
      journal: MigrationJournal;
      done: Promise<unknown>;
    }
  >();
  const previews = new Set<MigrationWorker>();
  let closed = false;
  const authority = storage.migrationAuthority();
  const connection = (project: Project, id: string) => {
    const c = project.connections.find((c) => c.id === id);
    if (!c) throw new StorageError("NOT_FOUND", "Unknown connection.");
    return c;
  };
  const pathFor = (project: Project, id: string) => {
    const c = connection(project, id);
    return connectionPath(
      options.approvedRoots,
      `${c.locator.approvedRootId}:${c.locator.relativePath}`,
      options.metadataRoot,
    ).path;
  };
  const backupPath = (j: MigrationJournal) => {
    const root = options.approvedRoots[j.backupLocator.approvedRootId];
    if (!root)
      throw new StorageError(
        "PATH_OUTSIDE_ROOT",
        "Reconnect the backup root before recovery.",
      );
    const path = safePath(root, j.backupLocator.relativePath);
    for (const suffix of ["", "-wal", "-shm", "-journal"]) {
      const file = safePath(root, j.backupLocator.relativePath + suffix);
      if (existsSync(file) && lstatSync(file).nlink > 1)
        throw new StorageError(
          "PATH_OUTSIDE_ROOT",
          "Backup files cannot alias another location.",
        );
    }
    return path;
  };
  const pending = (id: string) =>
    storage
      .migrations(id)
      .filter((j) =>
        ["applying", "recovery-pending"].includes(j.history.outcome),
      );
  function guard(projectId: string, operation: string) {
    if (running.has(projectId)) {
      if (
        ![
          "project.inspect",
          "schema.history",
          "job.inspect",
          "job.cancel",
        ].includes(operation)
      )
        throw new StorageError(
          "PROJECT_BUSY",
          "A migration owns this project. Wait or cancel its job.",
        );
    } else if (
      pending(projectId).length &&
      !["project.inspect", "schema.history", "job.inspect"].includes(operation)
    )
      throw new StorageError(
        "RECOVERY_REQUIRED",
        "Restart to reconcile the interrupted migration before new work.",
      );
  }
  function candidate(j: MigrationJournal, inspection: Inspection): Project {
    const plan = plans.inspect(
      options.ownerId,
      j.source.id,
      j.history.planId,
    ) as DBPlan;
    const schema =
      plan.kind === "restore" ? plan.restoredSchema : j.source.schema;
    const old = connection(j.source, j.history.connectionId);
    return parseProject({
      ...j.source,
      revision: j.source.revision + 1,
      schema,
      connections: j.source.connections.map((c) =>
        c.id !== old.id
          ? c
          : {
              ...c,
              inspectedForConnectionId: c.id,
              fingerprint: inspection.fingerprint,
              inspectedSchema: schema,
              capabilities: {
                ...c.capabilities,
                sqliteVersion: inspection.sqliteVersion,
                foreignKeys: true,
                unsupportedObjects: schema.opaqueObjects.map((o) => o.id),
              },
              physical: {
                encoding: inspection.encoding,
                objects: inspection.objects,
                tables: inspection.tables,
              },
            },
      ),
    });
  }
  function finalize(j: MigrationJournal, inspection: Inspection) {
    const result = {
      planId: j.history.planId,
      committed: true,
      recoveryRequired: false,
      backupRef: j.history.backupRef,
    };
    const after = candidate(j, inspection);
    const outcome = {
      ok: true as const,
      revision: after.revision,
      result,
      diagnostics: [],
    };
    options.migrationFault?.("before-reconcile");
    const already = storage.lookup(j.source.id, j.command.requestId);
    if (!already) {
      if (hash(storage.snapshot(j.source.id)) !== hash(j.source))
        throw new StorageError(
          "RECOVERY_REQUIRED",
          "Project changed across a committed migration. Preserve both states and reconcile.",
        );
      storage.save(
        after,
        undefined,
        {
          requestId: j.command.requestId,
          payloadHash: j.payloadHash,
          actor: j.actor,
          baseRevision: j.source.revision,
          newRevision: after.revision,
          outcome,
        },
        {
          kind: "revision",
          revision: after.revision,
          objectIds: [j.history.connectionId],
          diagnostics: [],
        },
      );
    } else if (already.payloadHash !== j.payloadHash)
      throw new StorageError(
        "RECOVERY_REQUIRED",
        "Migration request identity conflicts with its durable outcome.",
      );
    options.migrationFault?.("after-reconcile");
    j.after = after;
    j.history = {
      ...j.history,
      outcome: "committed",
      newRevision: after.revision,
      message: "Database and project metadata committed.",
    };
    storage.updateMigration(j);
    storage.putJob(j.source.id, j.history.id, {
      id: j.history.id,
      status: "succeeded",
      committed: true,
      diagnostics: [],
    });
    return result;
  }
  // Runs after ProjectStorage has reconciled its own file replacement journal.
  // No new worker can start until every interrupted entry has an observed outcome.
  for (const j of storage
    .migrations()
    .filter((j) =>
      ["applying", "recovery-pending"].includes(j.history.outcome),
    )) {
    try {
      const marker = committed(
        pathFor(j.source, j.history.connectionId),
        j.history.id,
        authority,
      );
      if (marker) {
        if (
          marker.plan_hash !==
          plans.inspect(options.ownerId, j.source.id, j.history.planId).hash
        )
          throw new StorageError(
            "RECOVERY_REQUIRED",
            "Database marker hash conflicts with its reviewed plan.",
          );
        const state = observed(pathFor(j.source, j.history.connectionId));
        if (marker.schema_hash !== state.schemaFingerprint)
          throw new StorageError(
            "RECOVERY_REQUIRED",
            "Database schema changed after migration commit; preserve both states for reconciliation.",
          );
        finalize(j, state.inspection);
      } else {
        j.history = {
          ...j.history,
          outcome: "rolled-back",
          message:
            "Restart confirmed no commit marker; SQLite rolled back interrupted work.",
        };
        storage.updateMigration(j);
        storage.putJob(j.source.id, j.history.id, {
          id: j.history.id,
          status: "failed",
          committed: false,
          diagnostics: [],
        });
      }
    } catch {
      j.history = {
        ...j.history,
        outcome: "recovery-pending",
        message:
          "Recovery cannot establish a safe outcome. Preserve the database, backup and definition; reconnect and restart.",
      };
      try {
        storage.updateMigration(j);
      } catch {
        /* Existing storage recovery journal stays authoritative. */
      }
    }
  }
  for (const operation of ["schema.apply", "schema.restoreApply"] as const)
    registry.registerAsync(operation, async (command, project) => {
      if (
        (command.operation !== "schema.apply" &&
          command.operation !== "schema.restoreApply") ||
        !project
      )
        throw new StorageError("INVALID_INPUT", "Open a project before apply.");
      guard(project.id, operation);
      const plan = plans.inspect(
        options.ownerId,
        project.id,
        command.input.planId,
      );
      if (
        plan.kind !== (operation === "schema.apply" ? "migration" : "restore")
      )
        throw new StorageError(
          "PLAN_HASH_MISMATCH",
          "Plan purpose does not match this apply operation.",
        );
      const typed = plan as DBPlan;
      const path = pathFor(project, typed.connectionId);
      try {
        committed(path, "@probe", authority);
      } catch {
        throw new StorageError(
          "UNSUPPORTED_SCHEMA_OBJECT",
          "Reserved migration marker namespace is occupied or belongs to another owner. No database changes were made.",
        );
      }
      const diagnostics = validatePlanApplication(
        typed,
        operationInputSchemas[operation].parse(command.input),
        {
          revision: project.revision,
          modelHash: hash(project),
          fingerprint: typed.schemaFingerprint,
          dataFingerprint: typed.dataFingerprint,
          now: new Date().toISOString(),
        },
      );
      if (diagnostics.length)
        throw new StorageError(diagnostics[0]!.code, diagnostics[0]!.message);
      const c = connection(project, typed.connectionId);
      if (!storage.hasInspectedConnection(project.id, c))
        throw new StorageError(
          "DATABASE_CHANGED",
          "Connection baseline has no matching durable inspection. Inspect and bind again.",
        );
      const prior = storage
        .migrations(project.id)
        .find(
          (j) =>
            j.history.planId === typed.id && j.history.outcome === "committed",
        );
      if (prior)
        throw new StorageError(
          "PLAN_HASH_MISMATCH",
          "This plan was already committed; inspect history.",
        );
      const id = createId(),
        backupRef = createId();
      const locator = {
        approvedRootId: c.locator.approvedRootId,
        relativePath: `.schema-baron-backups/${hash(project.id)}/${backupRef}.sqlite`,
      };
      const j: MigrationJournal = {
        history: {
          id,
          planId: typed.id,
          requestId: command.requestId,
          connectionId: c.id,
          backupRef,
          kind: typed.kind,
          createdAt: new Date().toISOString(),
          baseRevision: project.revision,
          outcome: "applying",
          backupValidated: false,
          message: "Backup and transaction in progress.",
        },
        source: project,
        command,
        actor: options.ownerId,
        payloadHash: hash(command),
        backupLocator: locator,
      };
      let restorePath: string | undefined;
      if (typed.kind === "restore") {
        const original = storage
          .migrations(project.id)
          .find(
            (v) =>
              v.history.backupRef === typed.backupRef &&
              v.history.backupValidated &&
              v.history.connectionId === c.id,
          );
        if (!original)
          throw new StorageError(
            "NOT_FOUND",
            "Validated backup is unavailable.",
          );
        restorePath = backupPath(original);
      }
      const destination = backupPath(j);
      mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
      storage.recordMigration(j);
      storage.putJob(project.id, id, {
        id,
        status: "running",
        phase: "migration",
        committed: false,
        diagnostics: [],
      });
      const worker = new MigrationWorker();
      let doneResolve: () => void = () => {};
      const done = new Promise<void>((resolve) => {
        doneResolve = resolve;
      });
      running.set(project.id, { worker, journal: j, done });
      let confirmedCommit = false;
      try {
        const state = await worker.run(
          {
            path,
            backupPath: destination,
            id,
            authority,
            plan: typed,
            ...(restorePath ? { restorePath } : {}),
            ...(options.migrationWorkerFault
              ? { fault: options.migrationWorkerFault }
              : {}),
          },
          () => {
            if (closed)
              throw new StorageError("RECOVERY_REQUIRED", "Owner closed.");
            const current = storage.snapshot(project.id);
            const errors = validatePlanApplication(
              typed,
              operationInputSchemas[operation].parse(command.input),
              {
                revision: current.revision,
                modelHash: hash(current),
                fingerprint: typed.schemaFingerprint,
                dataFingerprint: typed.dataFingerprint,
                now: new Date().toISOString(),
              },
            );
            if (errors.length)
              throw new StorageError(errors[0]!.code, errors[0]!.message);
            options.migrationFault?.("before-ddl");
          },
          () => {
            j.history.backupValidated = true;
            storage.updateMigration(j);
          },
        );
        confirmedCommit = true;
        const marker = committed(path, id, authority);
        if (
          !marker ||
          marker.plan_hash !== typed.hash ||
          marker.schema_hash !== state.schemaFingerprint
        )
          throw new StorageError(
            "RECOVERY_REQUIRED",
            "Committed database marker cannot be reconciled at the bound location.",
          );
        finalize(j, state.inspection);
        return {
          result: {
            planId: typed.id,
            committed: true,
            recoveryRequired: false,
            backupRef,
          },
        };
      } catch (error) {
        if (error instanceof MigrationError && error.committed === true)
          confirmedCommit = true;
        let hasCommit = false;
        try {
          // A normal worker failure confirms rollback before reporting and exit.
          // Do not inspect or adopt a foreign namespace that caused its refusal.
          // Hard exits/cancellation still require observing the actual DB marker.
          const m =
            error instanceof MigrationError && error.committed === false
              ? undefined
              : committed(path, id, authority);
          hasCommit = confirmedCommit || !!m;
          if (m && m.plan_hash !== typed.hash)
            throw new StorageError(
              "RECOVERY_REQUIRED",
              "Migration marker hash mismatch.",
            );
        } catch {
          j.history.outcome = "recovery-pending";
          try {
            storage.updateMigration(j);
          } catch {}
          if (confirmedCommit)
            throw new CommittedMigrationError({
              planId: typed.id,
              committed: true,
              recoveryRequired: true,
              backupRef,
            });
          throw new StorageError(
            "RECOVERY_REQUIRED",
            "Cannot read the durable database marker. Preserve database and backups; restart to establish its actual commit state.",
          );
        }
        if (hasCommit) {
          j.history = {
            ...j.history,
            outcome: "recovery-pending",
            message: "Database committed; project finalization needs restart.",
          };
          try {
            storage.updateMigration(j);
            storage.putJob(project.id, id, {
              id,
              status: "succeeded",
              phase: "recovery-pending",
              committed: true,
              diagnostics: [],
            });
          } catch {}
          throw new CommittedMigrationError({
            planId: typed.id,
            committed: true,
            recoveryRequired: true,
            backupRef,
          });
        }
        j.history = {
          ...j.history,
          outcome: "rolled-back",
          message:
            error instanceof MigrationError && error.code === "CANCELED"
              ? "Canceled after confirmed worker exit; no commit marker."
              : "No commit marker; SQLite transaction rolled back.",
        };
        storage.updateMigration(j);
        storage.putJob(project.id, id, {
          id,
          status:
            error instanceof MigrationError && error.code === "CANCELED"
              ? "canceled"
              : "failed",
          committed: false,
          diagnostics: [],
        });
        throw error instanceof MigrationError
          ? new StorageError(error.code, error.message)
          : error;
      } finally {
        running.delete(project.id);
        doneResolve();
      }
    });
  registry.register("schema.history", (command, project) => {
    if (command.operation !== "schema.history" || !project)
      throw new StorageError("INVALID_INPUT", "Open a project.");
    connection(project, command.input.connectionId);
    return {
      result: storage
        .migrations(project.id)
        .filter((j) => j.history.connectionId === command.input.connectionId)
        .map((j) => j.history),
    };
  });
  registry.registerAsync("schema.restorePreview", async (command, project) => {
    if (command.operation !== "schema.restorePreview" || !project)
      throw new StorageError("INVALID_INPUT", "Open a project.");
    guard(project.id, "schema.restorePreview");
    const original = storage
      .migrations(project.id)
      .find(
        (j) =>
          j.history.backupRef === command.input.backupRef &&
          j.history.connectionId === command.input.connectionId &&
          j.history.backupValidated,
      );
    if (!original)
      throw new StorageError("NOT_FOUND", "Validated backup is unavailable.");
    const source = backupPath(original),
      path = pathFor(project, command.input.connectionId);
    const worker = new MigrationWorker();
    previews.add(worker);
    let generated: Awaited<ReturnType<MigrationWorker["preview"]>>;
    try {
      generated = await worker.preview(path, source);
    } catch (error) {
      throw new StorageError(
        error instanceof MigrationError ? error.code : "RECOVERY_REQUIRED",
        "Restore preview failed. Inspect the backup and current database before retrying.",
      );
    } finally {
      previews.delete(worker);
    }
    const { backup, current } = generated;
    const originalPlan = plans.inspect(
      options.ownerId,
      project.id,
      original.history.planId,
    ) as DBPlan;
    if (
      backup.schemaFingerprint !== originalPlan.schemaFingerprint ||
      backup.dataFingerprint !== originalPlan.dataFingerprint
    )
      throw new StorageError(
        "DATABASE_CHANGED",
        "Validated backup changed after creation. Preserve it and choose an intact backup.",
      );
    const restoredSchema = connection(
      original.source,
      original.history.connectionId,
    ).inspectedSchema!;
    try {
      parseProject({ ...project, schema: restoredSchema });
    } catch {
      throw new StorageError(
        "VALIDATION_FAILED",
        "Restored schema would break current project references. Repair consumers before previewing restore.",
      );
    }
    const steps = generated.steps.map((sql) => ({
      id: createId(),
      sql,
      objectIds: [],
      transactional: true as const,
    }));
    if (hash(storage.snapshot(project.id)) !== hash(project))
      throw new StorageError(
        "REVISION_CONFLICT",
        "Project changed during restore preview.",
      );
    const impact = [
      {
        id: createId(),
        kind: "data-loss" as const,
        description: `Replace the current database (${current.rowCount} rows) with backup ${command.input.backupRef} (${backup.rowCount} rows). All changes and later data since this backup will be discarded. A new safety backup is required before restore.`,
        requiresAcknowledgement: true,
        affectedCount: current.rowCount,
      },
    ];
    const now = new Date().toISOString();
    const content = {
      id: createId(),
      kind: "restore" as const,
      connectionId: command.input.connectionId,
      backupRef: command.input.backupRef,
      sourceRevision: project.revision,
      modelHash: hash(project),
      createdAt: now,
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      schemaFingerprint: current.schemaFingerprint,
      dataFingerprint: current.dataFingerprint,
      backupFingerprint: backup.schemaFingerprint,
      backupDataFingerprint: backup.dataFingerprint,
      restoredSchema,
      steps,
      impact,
      requiredAcknowledgementIds: impact.map((i) => i.id),
    };
    return {
      result: plans.record(
        options.ownerId,
        project.id,
        reviewedPlanSchema.parse({ ...content, hash: planHash(content) }),
      ),
    };
  });
  return {
    guard,
    retry(projectId: string, requestId: string, payloadHash: string) {
      const entries = storage
        .migrations(projectId)
        .filter((j) => j.command.requestId === requestId);
      if (entries.some((j) => j.payloadHash !== payloadHash))
        throw new StorageError(
          "IDEMPOTENCY_CONFLICT",
          "Request ID already identifies a different migration payload.",
        );
      const j = entries.find((j) => j.history.outcome === "recovery-pending");
      if (!j) return;
      const marker = committed(
        pathFor(j.source, j.history.connectionId),
        j.history.id,
        authority,
      );
      if (
        marker &&
        marker.plan_hash ===
          plans.inspect(options.ownerId, projectId, j.history.planId).hash
      )
        return {
          ok: true as const,
          revision: j.source.revision,
          result: {
            planId: j.history.planId,
            committed: true as const,
            recoveryRequired: true as const,
            backupRef: j.history.backupRef,
          },
          diagnostics: [],
        };
    },
    get active() {
      return running.size > 0;
    },
    async cancel(projectId: string, jobId: string): Promise<Job | undefined> {
      const active = running.get(projectId);
      if (!active || active.journal.history.id !== jobId) return;
      await active.worker.cancel();
      await active.done;
      return storage.job(projectId, jobId) as Job;
    },
    async close() {
      closed = true;
      await Promise.all([...previews].map((worker) => worker.cancel()));
      await Promise.all(
        [...running.values()].map(async (r) => {
          await r.worker.cancel();
          await r.done;
        }),
      );
    },
  };
}
