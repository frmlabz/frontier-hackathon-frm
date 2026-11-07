import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();
const tools: Anthropic.Tool[] = [{
  name: "build_app", description: "Build an app", strict: true,
  input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"], additionalProperties: false },
}];
async function probe(model: string, opts: any) {
  const t0 = Date.now();
  try {
    const stream = client.beta.messages.stream({
      model, max_tokens: 4000, thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      tools,
      messages: [{ role: "user", content: "Say hi in 5 words, then call build_app with name Inventory." }],
      ...opts,
    } as any);
    let first = 0;
    stream.on("text", () => { if (!first) first = Date.now() - t0; });
    const m = await stream.finalMessage();
    console.log(model, JSON.stringify(opts.betas ?? []), opts.speed ?? "", "OK", m.stop_reason, `ttft=${first}ms total=${Date.now() - t0}ms`, m.content.map((b: any) => b.type).join(","));
  } catch (e: any) {
    console.log(model, JSON.stringify(opts.betas ?? []), opts.speed ?? "", "ERR", e.status, e.message?.slice(0, 200));
  }
}
const FB = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
await probe("claude-sonnet-5-5", {});
await probe("claude-sonnet-5-5", FB);
await probe("claude-opus-5-5", {});
await probe("claude-opus-5-5", FB);
await probe("claude-opus-5-5", { betas: ["fast-mode-2026-02-01"], speed: "fast" });
await probe("claude-opus-5-5", { betas: ["server-side-fallback-2026-07-01", "fast-mode-2026-02-01"], fallbacks: "default", speed: "fast" });
