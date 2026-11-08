// The workspace profile. Demo default comes from fixtures/workspace.json; BOS_WORKSPACE, BOS_OWNER and
// BOS_OWNER_EMAIL override it. The product reads it from the control plane (docs/specs/identity.md).
import type { WorkspaceProfile } from "../contracts/domain";
import demo from "../fixtures/workspace.json";

const profile: WorkspaceProfile = {
  id: process.env.BOS_WORKSPACE_ID ?? demo.id,
  name: process.env.BOS_WORKSPACE ?? demo.name,
  owner: { name: process.env.BOS_OWNER ?? demo.owner.name, email: process.env.BOS_OWNER_EMAIL ?? demo.owner.email },
};

export const workspace = () => profile;
