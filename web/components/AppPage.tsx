import { useEffect, useRef, useState } from "react";
import { AlertCircle, MessageCircle } from "lucide-react";
import { useStore } from "../store";
import { Badge, Button, Link, Spinner, TopBar, cx } from "./common";
import { STEPS } from "./cards";
import { SpecView } from "./SpecView";

function Skeleton({ step, emoji, name }: { step: string; emoji: string; name: string }) {
  const active = Math.max(0, STEPS.indexOf(step));
  return (
    <div className="max-w-[900px] mx-auto px-12 pt-16 anim-fade-in">
      <div className="text-[78px] leading-[1.1] mb-2 opacity-60">{emoji}</div>
      <div className="text-[40px] font-bold tracking-[-0.02em] text-ink-strong/40 leading-[1.2]">{name}</div>
      <div className="mt-5 flex items-center gap-2 text-[14px] text-muted">
        <Spinner size={13} />
        <span className="text-shimmer font-medium">{step || STEPS[0]}…</span>
        <span className="text-faint">· step {Math.min(active + 1, 3)} of 3</span>
      </div>
      <div className="mt-8 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[84px] rounded-lg border border-hairline p-4">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-6 w-14 rounded mt-3" />
          </div>
        ))}
      </div>
      <div className="mt-8 border-t border-hairline">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-[37px] border-b border-hairline flex items-center gap-6 px-2">
            <div className="skeleton h-3 rounded" style={{ width: 140 - (i % 3) * 20 }} />
            <div className="skeleton h-3 w-16 rounded" />
            <div className="skeleton h-3 w-10 rounded" />
            <div className="skeleton h-3 w-24 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** One iframe per version; the new one fades in over the old once it reports ready. */
function Frames({ slug, version }: { slug: string; version: number }) {
  const [frames, setFrames] = useState<{ v: number; ready: boolean }[]>([{ v: version, ready: false }]);
  useEffect(() => {
    setFrames((f) => (f.some((x) => x.v === version) ? f : [...f, { v: version, ready: false }]));
  }, [version]);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || !e.data?.type) return;
      const src = [...document.querySelectorAll<HTMLIFrameElement>(`iframe[data-app="${CSS.escape(slug)}"]`)].find((f) => f.contentWindow === e.source);
      if (!src) return;
      const v = Number(src.dataset.version);
      if (e.data.type === "bos:ready") {
        setFrames((f) => f.map((x) => (x.v === v ? { ...x, ready: true } : x)));
        // drop older frames after the crossfade
        setTimeout(() => setFrames((f) => f.filter((x) => x.v >= v)), 450);
      }
      if (e.data.type === "bos:error") {
        void fetch(`/api/apps/${slug}/error`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: String(e.data.message ?? ""), stack: String(e.data.stack ?? ""), version: v }),
        });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [slug]);
  const anyReady = frames.some((f) => f.ready);
  return (
    <div className="relative flex-1">
      {!anyReady && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner size={18} />
        </div>
      )}
      {frames.map((f) => (
        <iframe
          key={f.v}
          data-app={slug}
          data-version={f.v}
          src={`/apps/${slug}/?v=${f.v}`}
          title={slug}
          className={cx("absolute inset-0 w-full h-full border-0 bg-white transition-opacity duration-400", f.ready ? "opacity-100" : "opacity-0")}
          style={{ zIndex: f.v }}
        />
      ))}
    </div>
  );
}

function Tabs({ slug, tab }: { slug: string; tab: "app" | "spec" }) {
  const item = (id: "app" | "spec", label: string) => (
    <Link
      to={id === "app" ? `/app/${slug}` : `/app/${slug}/spec`}
      className={cx("h-7 px-2 rounded flex items-center text-[13px] hover:bg-hover", tab === id ? "text-ink-strong font-medium bg-hover" : "text-muted")}
    >
      {label}
    </Link>
  );
  return <div data-tabs className="flex items-center">{item("app", "App")}{item("spec", "Spec")}<span className="w-px h-4 bg-hairline-strong mx-1.5" /></div>;
}

export function AppPage({ slug, tab = "app" }: { slug: string; tab?: "app" | "spec" }) {
  const app = useStore((s) => s.apps.find((a) => a.slug === slug));
  const loaded = useStore((s) => s.loaded);
  const prevVersion = useRef(app?.version ?? 0);
  const [justUpdated, setJustUpdated] = useState(false);
  useEffect(() => {
    if (!app) return;
    if (app.version > prevVersion.current && prevVersion.current > 0) {
      setJustUpdated(true);
      const t = setTimeout(() => setJustUpdated(false), 2600);
      prevVersion.current = app.version;
      return () => clearTimeout(t);
    }
    prevVersion.current = app.version;
  }, [app?.version]);

  if (!app) {
    return (
      <div className="h-full flex flex-col">
        <TopBar crumbs={["Apps"]} />
        <div className="flex-1 flex items-center justify-center text-muted text-[14px]">{loaded ? "This app doesn’t exist." : <Spinner />}</div>
      </div>
    );
  }
  const working = ["generating", "building", "fixing"].includes(app.status);
  const status =
    app.status === "fixing" ? <Badge tone="orange" dot>Fixing a problem…</Badge> :
    working && app.version > 0 ? <Badge tone="blue" dot>Updating…</Badge> :
    justUpdated ? <span className="anim-pop"><Badge tone="green">Updated to v{app.version}</Badge></span> :
    app.version > 0 ? <span className="text-faint text-[12px]">v{app.version}</span> : null;

  return (
    <div className="h-full flex flex-col">
      <TopBar
        crumbs={[
          <span className="text-muted">Apps</span>,
          <span className="flex items-center gap-1.5"><span>{app.emoji}</span>{app.name}</span>,
        ]}
        right={
          <>
            <Tabs slug={app.slug} tab={tab} />
            {status}
            <Link to="/" className="flex items-center gap-1 h-7 px-2 rounded hover:bg-hover text-muted hover:text-ink">
              <MessageCircle size={14} /> Ask CEO
            </Link>
          </>
        }
      />
      {tab === "spec" && <SpecView app={app} />}
      {/* The app stays mounted under the Spec tab, so switching back is instant and live updates keep flowing. */}
      <div className={cx("flex-1 min-h-0 flex flex-col", tab === "spec" && "hidden")}>
      {app.version < 1 ? (
        app.status === "failed" ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-[360px] anim-fade-up">
              <div className="w-10 h-10 rounded-full bg-[#ffe2dd] text-[#c4554d] flex items-center justify-center mx-auto"><AlertCircle size={20} /></div>
              <div className="mt-3 font-semibold text-ink-strong">{app.name} couldn’t be set up</div>
              <div className="mt-1 text-[14px] text-muted">{app.error ?? "Something went wrong while building it."}</div>
              <div className="mt-4"><Button onClick={() => (location.href = "/")}>Back to Hub</Button></div>
            </div>
          </div>
        ) : (
          <div data-scroll-root className="flex-1 overflow-y-auto"><Skeleton step={app.step} emoji={app.emoji} name={app.name} /></div>
        )
      ) : (
        <Frames slug={app.slug} version={app.version} />
      )}
      </div>
    </div>
  );
}
