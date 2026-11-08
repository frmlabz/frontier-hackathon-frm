// The contract between a generated app and the platform. An app may import only react, @bos/ui and
// @bos/sdk; everything else it learns over these messages and the records REST API. Keeping this
// stable is what lets hosting, isolation and storage change without regenerating apps.

/** Shell → app iframe (postMessage, same origin in the prototype). */
export type ShellToApp =
  | { type: "bos:records"; collection: string }               // a collection changed; refetch it
  | { type: "bos:check"; checks: { id: string; row: string | null; text: string }[] };

/** App iframe → shell. Sent by runtime/entry.tsx, never by generated code. */
export type AppToShell =
  | { type: "bos:ready" }
  | { type: "bos:error"; message: string; stack: string }
  | { type: "bos:check-result"; results: Record<string, boolean> };

/**
 * Records API that @bos/sdk calls, scoped to the app in the iframe URL (/apps/:slug/).
 *   GET    /api/apps/:slug/:collection            → Rec[]
 *   POST   /api/apps/:slug/:collection            { data, id? } → Rec
 *   PATCH  /api/apps/:slug/:collection/:id        { patch } → Rec
 *   DELETE /api/apps/:slug/:collection/:id        → 204
 *   POST   /api/ai/extract                        multipart (file, instructions) → JSON
 * Product: the same paths on the app's own origin, authenticated with a short-lived app-scoped token.
 */
export const RECORDS_API = "/api/apps/:slug/:collection" as const;
