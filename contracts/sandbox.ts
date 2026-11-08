// Contract for executing generated or agent-driven code on the server. Not implemented in the demo:
// nothing generated runs server-side yet (apps run in the browser, builds run in-process).
// The product implementation is a Firecracker microVM per sandbox; see docs/specs/sandbox.md.

export type SandboxKind = "build" | "app" | "employee";

export type SandboxSpec = {
  kind: SandboxKind;
  workspace: string;
  /** Image per kind, e.g. a warm Bun runtime snapshot. */
  image: string;
  limits: { vcpu: number; memoryMb: number; diskMb: number; timeoutMs: number };
  /** Default deny. `platform` is the records/SDK API; connectors are granted per employee. */
  egress: { platform: boolean; connectors: string[]; hosts: string[] };
  env?: Record<string, string>;
};

export type ExecResult = { exitCode: number; stdout: string; stderr: string; durationMs: number };

export type SandboxEvent =
  | { type: "started"; id: string; bootMs: number }
  | { type: "exited"; id: string; exitCode: number }
  | { type: "killed"; id: string; reason: "timeout" | "oom" | "policy" | "stopped" };

export interface Sandbox {
  readonly id: string;
  writeFiles(files: Record<string, string | Uint8Array>): Promise<void>;
  readFile(path: string): Promise<Uint8Array | null>;
  exec(cmd: string[], opts?: { cwd?: string; timeoutMs?: number }): Promise<ExecResult>;
  /** Snapshot for fast restore (warm runtimes, employee workspaces between runs). */
  snapshot?(): Promise<string>;
  stop(): Promise<void>;
}

export interface SandboxProvider {
  start(spec: SandboxSpec, fromSnapshot?: string): Promise<Sandbox>;
  onEvent(fn: (e: SandboxEvent) => void): () => void;
}
