# Spec-driven apps

**Prototype:** one `spec.md` per app with four sections: Definitions, Functional specs (`### id` blocks), Starter data and Acceptance (`server/spec.ts`). The spec is hashed per block. Editing the spec regenerates the app only when a block that drives the code changed. The model writes one `App.tsx` that can import only `react`, `@bos/ui` and `@bos/sdk`, and the collection schema is merged additively on each version.

## Design

- **Definitions are the schema.** `:Supply:` with fields and units compiles to a typed collection schema. The `RecordStore` enforces it and the SDK types come from it. A build whose code writes undefined fields is rejected.
- **Migrations from spec diffs.** A changed Definition (add a field, rename one, change a unit) produces a migration plan that runs on a data snapshot, is checked, and is then applied with the version promote.
- **Shared definitions.** Definitions live at the workspace level and apps reference them, so Inventory, Purchasing and a Dashboard share `:Supply:` instead of copying collections.
- **Multi-module apps.** Each functional block maps to the module that implements it. Only modules whose blocks changed are regenerated, and unchanged modules are reused by hash.
- **Server logic.** `### server:` blocks (schedules, webhooks) are generated into a server bundle that runs in an `app` sandbox ([sandbox](sandbox.md)).
- **Platform modules.** Payments, auth, notifications, PDF and OCR are referenced by name in the spec and provided by the platform. The model never generates them.
- **History.** Each spec version records who asked for the change, why, the diff and the checks it passed. The owner can read and edit the spec; the CEO edits it through `edit_app_spec`.

## Migration from the prototype

1. Parse Definitions into `Collection[]` and validate builder output and record writes against them.
2. Store spec versions with author and reason (today only `v<N>/spec.md` and `hashes.json` are kept).
