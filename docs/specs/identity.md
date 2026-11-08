# Identity, login and roles

**Contract:** `Identity` and `Principal` in `contracts/`.
**Prototype:** one implicit owner. The workspace profile comes from `fixtures/workspace.json` (or `BOS_WORKSPACE`, `BOS_OWNER`, `BOS_OWNER_EMAIL`). Human team members are rows in `people` without accounts.

## Design

- **Accounts:** the owner and staff sign in with a passkey or a magic link. Invites come from the Team page or the CEO ("add Ana as a waiter").
- **Principals:** `owner`, `member` (with roles) and `ai` (one per AI employee). Every record write, spec edit and connector call is stamped with the principal, and the store adds the audit fields `createdBy` and `updatedBy`.
- **Roles:** built-in roles are owner, manager and staff; a workspace can define its own. Specs reference roles ("only managers change minimums"). The records API enforces them using the app token's principal, and generated code never enforces access itself. `@bos/sdk` exposes `useUser()` for display only.
- **AI employees:** scoped, revocable grants (apps, collections, connectors) that the owner can see on the person page. A grant revoked mid-run stops the run, the same way disconnecting Gmail does today.
- **Public apps:** menus and booking pages get an anonymous principal that can only read or submit forms.

## Migration from the prototype

1. Add `members` and `sessions` tables, and make `Identity.principal(req)` read the session.
2. Pass the principal into `RecordStore` writes and stamp `createdBy` and `updatedBy`.
3. Mint app tokens in the shell and check them in the records routes.
