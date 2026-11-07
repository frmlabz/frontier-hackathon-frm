// `bun run seed:demo`: writes a mid-demo state into data/mock for UI QA (knowledge pages, Inventory built,
// Purchasing Assistant hired and done, Inventory v2). It drives the real mock flow instead of hand-writing rows,
// so the state always matches what the code produces. Then run `bun run mock` to look at it.
import { rmSync } from "node:fs";

const PORT = 3199;
rmSync("data/mock", { recursive: true, force: true });
const server = Bun.spawn(["bun", "server/index.ts"], {
  env: { ...process.env, BOS_MOCK: "1", PORT: String(PORT) },
  stdout: "ignore",
  stderr: "inherit",
});
try {
  for (let i = 0; i < 100; i++) {
    if (await fetch(`http://localhost:${PORT}/api/state`).then((r) => r.ok, () => false)) break;
    await Bun.sleep(200);
  }
  const run = Bun.spawn(["bun", "scripts/rehearse.ts", `http://localhost:${PORT}`, "--step5"], { stdout: "inherit", stderr: "inherit" });
  const code = await run.exited;
  console.log(code === 0 ? "\nMid-demo state written to data/mock. Run `bun run mock`." : "\nSeeding failed.");
  process.exitCode = code;
} finally {
  server.kill();
}
