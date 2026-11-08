// Prototype implementations of the platform contracts (contracts/platform.ts), wired from the demo
// modules. Replacing one is a change here; callers only see the interfaces.
import type { Platform } from "../contracts/platform";
import { bunBuild } from "./bunBuild";
import {
  countRecords, deleteRecord, getKnowledge, getRecord, insertRecord, listKnowledge, listRecords, updateRecord, upsertKnowledge,
} from "./db";
import { gmailRead, gmailSearch } from "./mockGmail";
import { jsonlTelemetry } from "./telemetry";
import { workspace } from "./workspace";

export const platform: Platform = {
  records: {
    list: listRecords,
    get: getRecord,
    insert: insertRecord,
    update: updateRecord,
    remove: (app, coll, id) => void deleteRecord(app, coll, id),
    count: countRecords,
  },
  builds: bunBuild,
  mail: { search: gmailSearch, read: gmailRead },
  knowledge: { list: listKnowledge, get: getKnowledge, upsert: upsertKnowledge },
  identity: {
    workspace,
    principal: () => ({ kind: "owner", id: "owner", name: workspace().owner.name }),
  },
  telemetry: jsonlTelemetry,
};
