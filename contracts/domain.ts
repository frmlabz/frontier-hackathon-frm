// Domain types shared by the server, the shell and every implementation of the platform contracts.
// Pure types: nothing in contracts/ has runtime code or depends on server/.

/** Who the workspace belongs to. Prompts and the shell read it; nothing hardcodes a business. */
export type WorkspaceProfile = { id: string; name: string; owner: { name: string; email: string } };

export type Field = { name: string; type: "text" | "number" | "date" | "boolean"; unit?: string | null };
export type Collection = { name: string; fields: Field[] };

/** A generated app. `spec` is the source of truth; `version` points at the live bundle. */
export type App = {
  slug: string; name: string; emoji: string; description: string; spec: string;
  schema: Collection[] | null; status: string; version: number; step: string; error: string | null; createdAt: number;
  /** Spec blocks changed since the live version was built (added by /api/state). */
  specChanges?: string[];
  /** Acceptance checks for the live version (added by /api/state); results null until the shell has run them. */
  checks?: { version: number; at: number; items: { id: string; label: string; row: string | null; text: string }[]; results: Record<string, boolean> | null } | null;
};

/** One row in an app collection. Field values are free-form; the collection schema describes them. */
export type Rec = { id: string; createdAt: number; updatedAt: number; [k: string]: any };

export type Person = {
  id: string; kind: "human" | "ai"; name: string; role: string; emoji: string; color: string;
  instructions: string; connectors: string[]; status: string; createdAt: number;
};
export type KnowledgePage = { slug: string; emoji: string; title: string; markdown: string; position: number; updatedAt: number };
export type ChatItem = { id: number; kind: string; payload: any; createdAt: number };
export type Activity = { id: number; personId: string; text: string; createdAt: number };
export type Email = { id: string; fromName: string; fromAddr: string; subject: string; body: string; receivedAt: number };

/**
 * Whoever performs an action. The demo has one implicit owner; the product adds members and
 * gives every AI employee its own principal with scoped, revocable grants.
 */
export type Principal =
  | { kind: "owner"; id: string; name: string }
  | { kind: "member"; id: string; name: string; roles: string[] }
  | { kind: "ai"; id: string; name: string; personId: string };
