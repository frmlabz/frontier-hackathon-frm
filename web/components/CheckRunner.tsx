import { useEffect, useRef } from "react";
import { useStore, type App } from "../store";

/**
 * Stretch A: runs each app version's acceptance checks once, in an offscreen iframe, wherever Marko is in the shell.
 * Results go to the server, which records them and starts one auto-fix if any failed.
 */
export function CheckRunner() {
  const apps = useStore((s) => s.apps);
  const pending = apps.filter((a) => a.status === "ready" && a.checks && a.checks.version === a.version && !a.checks.results);
  return (
    <>
      {pending.map((a) => (
        <CheckFrame key={`${a.slug}@${a.version}@${a.checks!.at}`} app={a} />
      ))}
    </>
  );
}

function CheckFrame({ app }: { app: App }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const { slug, version } = app;
  const items = app.checks!.items;
  useEffect(() => {
    let done = false;
    const post = (path: string, body: any) =>
      fetch(`/api/apps/${slug}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.ok, () => false);
    // Results must reach the server, or the card would show "Checking" forever.
    const report = async (results: Record<string, boolean>) => {
      for (let i = 0; i < 5; i++) {
        if (await post("checks", { version, results })) return;
        await new Promise((r) => setTimeout(r, 1500));
      }
    };
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== ref.current?.contentWindow || done) return;
      if (e.data?.type === "bos:ready") ref.current!.contentWindow!.postMessage({ type: "bos:check", checks: items }, location.origin);
      if (e.data?.type === "bos:check-result") {
        done = true;
        void report(e.data.results ?? {});
      }
      if (e.data?.type === "bos:error") {
        // A crash fails every check; the crash report starts the regular auto-fix (the check fix then stands down).
        done = true;
        void post("error", { message: String(e.data.message ?? ""), stack: String(e.data.stack ?? ""), version }).then(() => report({}));
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [slug, version]);
  return (
    <iframe
      ref={ref}
      data-check-frame={slug}
      src={`/apps/${slug}/?v=${version}&check=1`}
      title={`${slug} checks`}
      aria-hidden
      tabIndex={-1}
      className="fixed top-0 border-0 pointer-events-none opacity-0"
      style={{ left: -20000, width: 1280, height: 900 }}
    />
  );
}
