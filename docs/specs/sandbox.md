# Sandboxes (microVMs)

**Contract:** `contracts/sandbox.ts` (`SandboxProvider`, `Sandbox`, `SandboxSpec`).
**Prototype:** not implemented. Generated code runs only in the browser iframe, and builds run in-process (`server/bunBuild.ts`).

## Why

Generated apps will need server logic (scheduled jobs, webhooks, payments), and employees need to run code against data. Neither can run in the platform process. A container shares the host kernel; a microVM has its own kernel and boots fast enough to start per task.

## Design

- **Provider:** Firecracker on bare-metal hosts, with a jailer per VM. A host agent implements `SandboxProvider` and reports `SandboxEvent`s.
- **Kinds:**
  | Kind | Lifetime | Image | Egress |
  |---|---|---|---|
  | `build` | one build | Bun toolchain plus the `@bos/*` runtime, read-only | none; packages come from a local mirror baked into the image |
  | `app` | long-lived, scale to zero | warm Bun runtime snapshot plus the app's server bundle | the platform API with the app token |
  | `employee` | one run, with the filesystem snapshotted between runs | Bun, plus Python for data work | the platform API and granted connectors through the broker |
- **Startup:** restore from a snapshot. A warm runtime snapshot per kind keeps cold start within a request budget.
- **Limits:** vCPU, memory, disk and wall time come from the workspace plan (`SandboxSpec.limits`). Hitting a limit kills the VM and emits `killed{reason}`.
- **Network:** deny by default. The egress policy (`platform`, `connectors[]`, `hosts[]`) is enforced at the host tap device, not inside the guest.
- **Secrets:** none in the guest. The app token is short-lived and scoped to one app. Connector calls go through the broker (see [connectors](connectors.md)).
- **Files in and out:** `writeFiles` / `readFile` over vsock. Build output (`app.js`) is read back and stored as an immutable, content-addressed artifact.

## Migration from the prototype

1. `BuildRunner` gets a sandbox implementation: write `App.tsx` and `entry.tsx`, run `bun build`, read back `app.js` or stderr. The builder retry loop doesn't change, because `bundle()` already returns the error text.
2. The app server-logic spec format: a `### server:` block kind in the spec, built into a second bundle and run in an `app` VM behind `/api/apps/:slug/fn/:name`.
3. Employee runs move into `employee` VMs, and their tools call the platform API instead of in-process functions.

## Open questions

- Whether `app` VMs should be per app, or per workspace with one process per app inside, given density against the blast radius.
- How to cache snapshots across hosts.
