# Connectors

**Contract:** `MailConnector` in `contracts/platform.ts` (the first connector kind).
**Prototype:** a catalog of 14 providers with a fake sign-in (`server/connectors.ts`). Only Gmail works, and it is backed by a seeded inbox (`server/mockGmail.ts`) behind the tool shapes a real integration would expose.

## Design

- **Adapter per provider:** `connect` (OAuth), `scopes`, `tools` (typed, like `gmail_search` / `gmail_read`) and `events` (webhook or polling). Adding a provider means writing an adapter; the agents don't change.
- **Token broker:** OAuth tokens live in a vault per workspace. Employees call tools through the broker, which injects the credentials, checks the employee's grant and records the call. Tokens never reach the model or a sandbox.
- **Scopes per employee:** a hire requests the scopes it needs, and the owner approves them on the connect card.
- **Events:** new mail, a new order or a calendar change wakes the employee that subscribed to it, instead of being polled per run.
- **Dev and QA:** each adapter has a fixture-backed mock with the same tools (as `mockGmail.ts` is today), selected by the composition root.

## Migration from the prototype

1. Implement real Gmail (OAuth and the Gmail API) as a second `MailConnector` and choose between the two in `server/platform.ts`.
2. Move connector state from `connectors` rows to the vault, and add per-employee grants.
