import { useState } from "react";
import { ArrowUpRight, Check, FileText, Plug, RotateCcw, Sparkles, Users, X } from "lucide-react";
import { connectGmail, navigate, useStore, type App, type Person } from "../store";
import { Badge, Button, GmailLogo, Link, PersonAvatar, Spinner, cx } from "./common";

export const STEPS = ["Designing your app", "Writing the app", "Packaging", "Ready"];

function CardShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("my-3 rounded-[10px] border border-hairline bg-white shadow-[0_1px_2px_rgba(15,15,15,0.04)] anim-fade-up overflow-hidden", className)}>{children}</div>;
}

// ---------- App card ----------
/** Acceptance checks from the spec for the live version: spinner while they run, then ✓ / ✗ each. */
export function ChecksRow({ checks }: { checks: NonNullable<App["checks"]> }) {
  const r = checks.results;
  return (
    <div data-checks className="px-4 pb-3 -mt-1 pl-[68px] flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
      <span className="text-faint">{r ? "Checks" : "Checking"}</span>
      {checks.items.map((c) => {
        const ok = r?.[c.id];
        return (
          <span key={c.id} data-check={r ? (ok ? "pass" : "fail") : "pending"} className={cx("inline-flex items-center gap-1", !r ? "text-muted" : ok ? "text-ink" : "text-[#c4554d]")} title={`Expects "${c.text}"${c.row ? ` in the ${c.row} row` : ""}`}>
            {!r ? <Spinner size={10} /> : ok ? <Check size={12} strokeWidth={3} className="text-green" /> : <X size={12} strokeWidth={3} />}
            <span className={cx(!r && "text-shimmer")}>{c.label}</span>
          </span>
        );
      })}
    </div>
  );
}

export function AppCardView({ app, change, specs, checks }: { app: Pick<App, "slug" | "name" | "emoji" | "status" | "step" | "version" | "error" | "description">; change?: string; specs?: string[]; checks?: App["checks"] }) {
  const ready = app.status === "ready";
  const failed = app.status === "failed";
  const fixing = app.status === "fixing";
  const active = ready ? STEPS.length : Math.max(0, STEPS.indexOf(app.step));
  const title = change ? (ready ? `${app.name} updated` : `Updating ${app.name}`) : fixing ? `Fixing ${app.name}` : ready ? app.name : failed ? app.name : `Setting up ${app.name}`;
  return (
    <CardShell>
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-3">
        <div className="w-10 h-10 rounded-lg bg-canvas-soft border border-hairline flex items-center justify-center text-[22px] shrink-0">{app.emoji}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[15px] text-ink-strong truncate">{title}</span>
            {ready && app.version > 1 && <Badge tone="blue">v{app.version}</Badge>}
          </div>
          <div className="text-[13px] text-muted truncate">{change || app.description}</div>
          {!!specs?.length && (
            <button
              data-spec-changes
              onClick={() => navigate(`/app/${app.slug}/spec`)}
              className="mt-1.5 flex flex-wrap items-center gap-1 text-[12px] text-muted cursor-pointer text-left"
              title="Open the spec"
            >
              <span>{specs.length} spec{specs.length > 1 ? "s" : ""} changed{["generating", "building", "fixing"].includes(app.status) ? " → regenerating" : ""}</span>
              {specs.slice(0, 4).map((id) => (
                <span key={id} className="font-mono text-[11px] px-1.5 h-[18px] leading-[18px] rounded bg-canvas-soft border border-hairline text-ink hover:bg-hover">{id}</span>
              ))}
            </button>
          )}
        </div>
        {ready && (
          <Button variant="primary" size="sm" onClick={() => navigate(`/app/${app.slug}`)} className="anim-pop">
            Open app <ArrowUpRight size={14} />
          </Button>
        )}
      </div>
      {!ready && (
        <div className="px-4 pb-3.5 pl-[68px] flex flex-col gap-1">
          {STEPS.map((s, i) => {
            const done = i < active;
            const now = i === active && !failed;
            return (
              <div key={s} className={cx("flex items-center gap-2 text-[13px] h-5 transition-colors duration-300", done ? "text-ink" : now ? "text-ink-strong font-medium" : "text-faint")}>
                <span className="w-4 h-4 flex items-center justify-center">
                  {done ? (
                    <span className="w-4 h-4 rounded-full bg-green text-white flex items-center justify-center anim-pop"><Check size={10} strokeWidth={3.5} /></span>
                  ) : now ? (
                    <Spinner size={13} />
                  ) : failed && i === active ? (
                    <span className="w-4 h-4 rounded-full bg-red text-white flex items-center justify-center"><X size={10} strokeWidth={3.5} /></span>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-hairline-strong" />
                  )}
                </span>
                <span className={cx(now && "text-shimmer")}>{fixing && i === 0 ? "Finding the problem" : s}</span>
              </div>
            );
          })}
          {failed && <div className="mt-1 text-[13px] text-[#c4554d]">{app.error ?? "Setup failed."}</div>}
        </div>
      )}
      {ready && checks && checks.version === app.version && <ChecksRow checks={checks} />}
      {ready && app.error && <div className="px-4 pb-3 -mt-1 text-[13px] text-muted">{app.error}</div>}
    </CardShell>
  );
}

export function AppCard({ id, payload }: { id?: number; payload: { slug: string; change?: string; specs?: string[]; fromVersion?: number } }) {
  const app = useStore((s) => s.apps.find((a) => a.slug === payload.slug));
  // Only the newest card for an app shows the live version's checks.
  const latest = useStore((s) => s.chat.findLast((c) => c.kind === "app_card" && c.payload?.slug === payload.slug)?.id === id);
  if (!app) return null;
  // Older cards are history: they show as done at the version they produced, never tied to later builds.
  // The newest card follows the live app (including an auto-fix of its build) and shows its checks.
  // An older card whose build is still running (a change queued behind it) keeps following until its version lands.
  const pending = ["generating", "building", "fixing"].includes(app.status) && app.version <= (payload.fromVersion ?? 0);
  const done = id != null && !latest && !pending;
  const shown = done ? { ...app, status: "ready" as const, version: (payload.fromVersion ?? 0) + 1, error: null } : app;
  return <AppCardView app={shown} change={payload.change} specs={payload.specs} checks={latest && !done ? app.checks : null} />;
}

// ---------- Hire card ----------
export function HireCardView({ person, connected }: { person: Person; connected: string[] }) {
  return (
    <CardShell>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <PersonAvatar person={person} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[15px] text-ink-strong truncate">{person.name}</span>
            <Badge tone="purple">AI</Badge>
            <span className="text-[12px] text-faint">joined the team</span>
          </div>
          <div className="text-[13px] text-muted truncate">{person.role}</div>
          {person.connectors.length > 0 && (
            <div className="flex gap-1.5 mt-1.5">
              {person.connectors.map((c) => (
                <span key={c} className={cx("inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full border text-[12px]", connected.includes(c) ? "border-[#cfe6d4] bg-[#f1f8f3] text-[#2b593f]" : "border-hairline text-muted")}>
                  {c === "gmail" ? <GmailLogo size={13} /> : <Plug size={12} />}
                  {c === "gmail" ? "Gmail" : c}
                  {connected.includes(c) ? <Check size={11} strokeWidth={3} /> : <span className="text-faint">· not connected</span>}
                </span>
              ))}
            </div>
          )}
        </div>
        <Link to={`/people/${person.id}`} className="text-[13px] text-muted hover:text-ink hover:bg-hover rounded px-2 h-7 flex items-center gap-1 shrink-0">
          Profile <ArrowUpRight size={13} />
        </Link>
      </div>
    </CardShell>
  );
}

export function HireCard({ payload }: { payload: { personId: string } }) {
  const person = useStore((s) => s.people.find((p) => p.id === payload.personId));
  const connected = useStore((s) => s.connectors).map((c) => c.provider);
  if (!person) return null;
  return <HireCardView person={person} connected={connected} />;
}

// ---------- Connector card ----------
export function ConnectorCardView({ reason, account, onConnect }: { reason: string; account?: string; onConnect: () => Promise<boolean> }) {
  const [state, setState] = useState<"idle" | "connecting" | "error">("idle");
  return (
    <CardShell>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="w-10 h-10 rounded-lg border border-hairline bg-white flex items-center justify-center shrink-0">
          <GmailLogo size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[15px] text-ink-strong">Gmail</div>
          <div className="text-[13px] text-muted truncate">{account ? <>Connected as <span className="text-ink">{account}</span></> : reason}</div>
        </div>
        {account ? (
          <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-[#edf6ef] text-[13px] text-[#2b593f] font-medium anim-pop shrink-0">
            <span className="w-4 h-4 rounded-full bg-green text-white flex items-center justify-center"><Check size={10} strokeWidth={3.5} /></span>
            Connected
          </span>
        ) : (
          <Button
            variant="primary"
            disabled={state === "connecting"}
            onClick={async () => {
              setState("connecting");
              const ok = await onConnect().catch(() => false);
              setState(ok ? "idle" : "error");
            }}
            className="shrink-0 min-w-[132px]"
          >
            {state === "connecting" ? <><Spinner size={13} className="!border-white/40 !border-t-white" /> Connecting…</> : state === "error" ? <><RotateCcw size={13} /> Try again</> : "Connect Gmail"}
          </Button>
        )}
      </div>
    </CardShell>
  );
}

export function ConnectorCard({ payload }: { payload: { provider: string; reason: string } }) {
  const conn = useStore((s) => s.connectors.find((c) => c.provider === payload.provider));
  return <ConnectorCardView reason={payload.reason} account={conn?.account} onConnect={connectGmail} />;
}

// ---------- Event line ----------
export function EventLine({ payload }: { payload: { icon?: string; text: string; link?: string; linkText?: string; personId?: string } }) {
  const person = useStore((s) => (payload.personId ? s.people.find((p) => p.id === payload.personId) : undefined));
  const [open, setOpen] = useState(false);
  const long = !!person && payload.text.length > 240;
  const icon =
    payload.icon === "bot" && person ? <PersonAvatar person={person} size={18} /> :
    payload.icon === "page" ? <FileText size={14} /> :
    payload.icon === "team" ? <Users size={14} /> :
    payload.icon === "plug" ? <Plug size={14} /> : <Sparkles size={14} />;
  return (
    <div className={cx("flex items-start gap-2 my-1.5 text-[13px] text-muted anim-fade-up", person && "my-3 py-2 px-3 rounded-lg bg-canvas-soft")}>
      <span className="h-[19px] flex items-center shrink-0 text-faint">{icon}</span>
      <span className={cx("leading-[19px] min-w-0", long && !open && "line-clamp-3 cursor-pointer")} onClick={long && !open ? () => setOpen(true) : undefined} title={long && !open ? "Show all" : undefined}>
        {person && <Link to={`/people/${person.id}`} className="font-medium text-ink hover:underline">{person.name}</Link>}
        {person && " · "}
        {payload.text}
        {payload.link && (
          <>
            {" "}
            <Link to={payload.link} className="text-ink font-medium hover:bg-hover rounded px-1 -mx-0.5 underline decoration-[rgba(55,53,47,0.3)] underline-offset-2">{payload.linkText}</Link>
          </>
        )}
      </span>
    </div>
  );
}
