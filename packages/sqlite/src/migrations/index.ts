import { fork } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import type { ReviewedPlan } from "@schema-baron/model";
import type { fingerprints } from "./state.js";
export { observed, committed, markerTable } from "./state.js";
export class MigrationError extends Error {
  constructor(readonly code: string) {
    super(
      "Migration did not complete. Inspect migration history before retrying.",
    );
  }
}
export interface MigrationInput {
  path: string;
  backupPath: string;
  id: string;
  authority: string;
  plan: Exclude<ReviewedPlan, { kind: "generation" }>;
  restorePath?: string;
  fault?: string;
}
/** Native work is isolated in a process. Cancellation resolves only after its exit,
 * then the caller must read the DB marker to distinguish commit from rollback. */
export class MigrationWorker {
  private child?: ChildProcess;
  private exit?: Promise<void>;
  private stopped = false;
  private stopCode = "CANCELED";
  private onExit = () => this.child?.kill("SIGKILL");
  run(input: MigrationInput, validate: () => void, onBackup: () => void) {
    return this.execute<ReturnType<typeof fingerprints>>(
      input,
      "worker",
      validate,
      onBackup,
    );
  }
  preview(path: string, backupPath: string) {
    return this.execute<
      { current: ReturnType<typeof fingerprints> } & ReturnType<
        typeof import("./restore.js").restoreStatements
      >
    >(
      { path, backupPath },
      "preview-worker",
      () => {},
      () => {},
    );
  }
  private async execute<T>(
    input: object,
    script: string,
    validate: () => void,
    onBackup: () => void,
  ): Promise<T> {
    if (this.stopped) throw new MigrationError("CANCELED");
    const url = new URL(`./${script}.js`, import.meta.url);
    const child = (this.child = fork(
      existsSync(url) ? url : new URL(`./${script}.ts`, import.meta.url),
      [],
      {
        env: { SCHEMA_BARON_MIGRATION_WORKER: JSON.stringify(input) },
        stdio: ["ignore", "ignore", "ignore", "ipc"],
        execArgv: [],
        serialization: "advanced",
      },
    ));
    child.on("error", () => {
      code = "RECOVERY_REQUIRED";
      child.kill("SIGKILL");
    });
    process.once("exit", this.onExit);
    this.exit = new Promise((resolve) =>
      child.once("exit", () => {
        process.removeListener("exit", this.onExit);
        resolve();
      }),
    );
    let result: T | undefined;
    let code = "RECOVERY_REQUIRED";
    const timer = setTimeout(() => {
      code = "TIMEOUT";
      void this.cancel("TIMEOUT");
    }, 30000);
    child.on(
      "message",
      (message: { phase: string; code?: string; result?: T }) => {
        if (message.phase === "backup-validated") {
          try {
            onBackup();
          } catch {
            code = "RECOVERY_REQUIRED";
            void this.cancel("RECOVERY_REQUIRED");
          }
        } else if (message.phase === "validate-project") {
          try {
            validate();
            child.send({ proceed: true });
          } catch (error) {
            child.send({
              code: (error as { code?: string }).code ?? "REVISION_CONFLICT",
            });
          }
        } else if (message.phase === "committed") result = message.result;
        else if (message.phase === "failed")
          code = message.code ?? "VALIDATION_FAILED";
      },
    );
    try {
      await this.exit;
      if (!result)
        throw new MigrationError(this.stopped ? this.stopCode : code);
      return result;
    } finally {
      clearTimeout(timer);
    }
  }
  async cancel(code = "CANCELED") {
    this.stopCode = code;
    this.stopped = true;
    this.child?.kill("SIGKILL");
    await this.exit;
  }
}
export { restoreStatements } from "./restore.js";
