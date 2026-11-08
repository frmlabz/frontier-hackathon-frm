// `bun dev`: starts both demo servers side by side.
//   :3000  live    real model (Opus by default), empty DB every start   (`bun run live`)
//   :3001  seeded  mock AI, restored from fixtures/seed every start      (`bun run seeded`)
const procs = (["live", "seeded"] as const).map((name) => {
  const p = Bun.spawn(["bun", "run", name], { stdout: "pipe", stderr: "pipe", env: process.env });
  for (const stream of [p.stdout, p.stderr]) {
    (async () => {
      let buf = "";
      for await (const chunk of stream as ReadableStream<Uint8Array>) {
        buf += new TextDecoder().decode(chunk);
        const lines = buf.split("\n");
        buf = lines.pop()!;
        for (const l of lines) console.log(`[${name.padEnd(6)}] ${l}`);
      }
    })();
  }
  return p;
});

const stop = () => {
  for (const p of procs) p.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
// If either server dies, take the other down too so `bun dev` never half-runs.
await Promise.race(procs.map((p) => p.exited));
stop();
