"use client";
import { useEffect, useRef, useState } from "react";
import { createId } from "@schema-baron/model";
import type {
  MigrationHistory as History,
  OperationResult,
  Project,
  ReviewedPlan,
} from "@schema-baron/model";
import type { StudioClient } from "../project-ui/api.js";
export function MigrationHistory({
  project,
  client,
  onChanged,
  onClose,
}: {
  project: Project;
  client: StudioClient;
  onChanged: (project: Project) => void;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<History[]>([]),
    [plan, setPlan] = useState<Extract<
      ReviewedPlan,
      { kind: "restore" }
    > | null>(null),
    [ack, setAck] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const request = useRef(createId()),
    mounted = useRef(true),
    applying = useRef(false);
  const connection = project.connections[0];
  async function command<T>(
    operation: string,
    input: unknown,
    requestId = createId(),
  ): Promise<T> {
    return client.read(`projects/${encodeURIComponent(project.id)}/commands`, {
      requestId,
      operation,
      expectedRevision: project.revision,
      input,
    });
  }
  async function refresh() {
    if (!connection) return;
    const rows = await command<History[]>("schema.history", {
      connectionId: connection.id,
    });
    if (mounted.current) setHistory(rows);
    return rows;
  }
  useEffect(() => {
    mounted.current = true;
    void refresh().catch((e) => {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "History unavailable.");
    });
    return () => {
      mounted.current = false;
    };
  }, [project.id, project.revision]);
  async function preview(backupRef: string) {
    if (!connection) return;
    setBusy(true);
    setError("");
    setMessage("");
    setPlan(null);
    setAck([]);
    request.current = createId();
    try {
      const p = await command<ReviewedPlan>("schema.restorePreview", {
        connectionId: connection.id,
        backupRef,
      });
      if (p.kind !== "restore")
        throw Error("Service returned a different plan purpose.");
      setPlan(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore preview failed.");
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!plan) return;
    setBusy(true);
    setError("");
    applying.current = true;
    try {
      const result = await command<OperationResult<"schema.restoreApply">>(
        "schema.restoreApply",
        { planId: plan.id, hash: plan.hash, acknowledgedImpactIds: ack },
        request.current,
      );
      if (result.recoveryRequired) {
        setMessage(
          "Database committed. Restart the Studio service to reconcile project metadata before more work.",
        );
      } else {
        setMessage(
          "Restore committed. A new safety backup preserves the database as it was before restore.",
        );
        onChanged(await client.snapshot(project.id));
        setPlan(null);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Restore outcome unavailable. Refresh history before retrying.",
      );
    } finally {
      applying.current = false;
      setBusy(false);
    }
  }
  async function cancel() {
    if (!applying.current) {
      onClose();
      return;
    }
    try {
      const rows = await refresh();
      const active = rows?.find(
        (row) => row.planId === plan?.id && row.outcome === "applying",
      );
      if (!active) {
        setMessage(
          "Restore may have completed. Refresh history to inspect its actual outcome.",
        );
        return;
      }
      const job = await command<OperationResult<"job.cancel">>("job.cancel", {
        jobId: active.id,
      });
      setMessage(
        job.committed
          ? "Database committed; this restore can no longer be canceled."
          : "Restore stopped after its worker exited. Original data is preserved.",
      );
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Cancellation unavailable. Inspect history.",
      );
    }
  }
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "minmax(0,1fr) auto",
        maxHeight: "calc(100dvh - 140px)",
        overflowWrap: "anywhere",
      }}
    >
      <div style={{ minHeight: 0, overflow: "auto", paddingRight: 4 }}>
        <p>
          Inspect migration outcomes and validated backups. Restoring requires a
          fresh review of the current database and later data.
        </p>
        {!connection && (
          <p>Bind an inspected SQLite database to view its history.</p>
        )}
        <ol
          aria-label="Migration and backup history"
          style={{ paddingLeft: 22 }}
        >
          {[...history].reverse().map((row) => (
            <li key={row.id} style={{ marginBottom: 12 }}>
              <strong>
                {row.kind === "restore" ? "Restore" : "Schema migration"} ·{" "}
                {row.outcome}
              </strong>
              <p>
                {row.createdAt} · r{row.baseRevision}
                {row.newRevision ? ` → r${row.newRevision}` : ""}
              </p>
              <p>{row.message}</p>
              <p>
                Backup <code>{row.backupRef}</code> ·{" "}
                {row.backupValidated ? "validated" : "not validated"}
              </p>
              {row.backupValidated && (
                <button
                  disabled={busy}
                  onClick={() => void preview(row.backupRef)}
                >
                  Review restore…
                </button>
              )}
            </li>
          ))}
        </ol>
        {connection && !history.length && (
          <p>No migrations recorded for this connection.</p>
        )}
        {plan && (
          <section aria-label="Restore review">
            <h3>Review database restore</h3>
            <p>
              This replaces current schema and data with the selected backup.
              Later data will be discarded. A safety backup is created first.
            </p>
            <p>
              Project revision {plan.sourceRevision} · Expires {plan.expiresAt}
            </p>
            {plan.impact.map((impact) => (
              <label
                key={impact.id}
                style={{ display: "block", margin: "10px 0" }}
              >
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={ack.includes(impact.id)}
                  onChange={(e) =>
                    setAck(
                      e.target.checked
                        ? [...ack, impact.id]
                        : ack.filter((id) => id !== impact.id),
                    )
                  }
                />
                {impact.description}
              </label>
            ))}
            <details>
              <summary>Reviewed SQL ({plan.steps.length} steps)</summary>
              <pre style={{ whiteSpace: "pre-wrap" }}>
                {plan.steps.map((step) => step.sql + ";").join("\n")}
              </pre>
            </details>
            <p>
              Plan hash <code>{plan.hash}</code>
            </p>
          </section>
        )}
      </div>
      <div style={{ background: "white", paddingTop: 8 }}>
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        <div className="dialog-actions">
          <button onClick={() => void cancel()}>
            {applying.current ? "Cancel running restore" : "Cancel"}
          </button>
          <button
            disabled={busy || !connection}
            onClick={() =>
              void refresh().catch((e) =>
                setError(
                  e instanceof Error ? e.message : "History unavailable.",
                ),
              )
            }
          >
            Refresh history
          </button>
          {plan && (
            <button
              className="primary"
              disabled={
                busy ||
                plan.requiredAcknowledgementIds.some((id) => !ack.includes(id))
              }
              onClick={() => void apply()}
            >
              {busy ? "Restoring…" : "Apply reviewed restore"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
