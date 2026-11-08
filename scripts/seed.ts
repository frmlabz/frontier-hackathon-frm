// Committed snapshot of the mock mid-demo state (fixtures/seed/).
//   bun scripts/seed.ts save      data/mock → fixtures/seed   (also run at the end of `bun run seed:demo`)
//   bun scripts/seed.ts restore   fixtures/seed → data/mock   (run on every `bun run seeded` start)
import { Database } from "bun:sqlite";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";

const LIVE = "data/mock";
const SEED = "fixtures/seed";
const cmd = process.argv[2];

if (cmd === "save") {
  if (!existsSync(`${LIVE}/bos.sqlite`)) throw new Error(`${LIVE}/bos.sqlite missing; run \`bun run seed:demo\` first`);
  rmSync(SEED, { recursive: true, force: true });
  mkdirSync(SEED, { recursive: true });
  // VACUUM INTO gives one self-contained file (no -wal/-shm), safe even while a server has the DB open.
  new Database(`${LIVE}/bos.sqlite`).exec(`VACUUM INTO '${SEED}/bos.sqlite'`);
  cpSync(`${LIVE}/apps`, `${SEED}/apps`, { recursive: true });
  console.log(`Saved ${LIVE} → ${SEED}`);
} else if (cmd === "restore") {
  if (!existsSync(`${SEED}/bos.sqlite`)) throw new Error(`${SEED} missing; run \`bun run seed:save\``);
  rmSync(LIVE, { recursive: true, force: true });
  mkdirSync(LIVE, { recursive: true });
  cpSync(`${SEED}/bos.sqlite`, `${LIVE}/bos.sqlite`);
  cpSync(`${SEED}/apps`, `${LIVE}/apps`, { recursive: true });
  console.log(`Restored ${SEED} → ${LIVE}`);
} else {
  console.error("usage: bun scripts/seed.ts save|restore");
  process.exit(1);
}
