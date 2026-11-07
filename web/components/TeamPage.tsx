import { useMemo } from "react";
import { Activity as ActivityIcon, AtSign, Bot, Briefcase, Circle, FileText, Plug, User } from "lucide-react";
import { isFresh, navigate, useStore, type Person } from "../store";
import { Badge, GmailLogo, Link, Markdown, PageChrome, PageTitle, PersonAvatar, Prop, Spinner, clock, cx, timeAgo, useTick } from "./common";

function StatusPill({ status }: { status: string }) {
  return status === "working" ? (
    <Badge tone="blue"><Spinner size={10} /> Working</Badge>
  ) : (
    <Badge tone="gray">Idle</Badge>
  );
}

export function TeamPage() {
  const people = useStore((s) => s.people);
  useStore((s) => s.fresh);
  const aiCount = people.filter((p) => p.kind === "ai").length;
  const sorted = [...people].sort((a, b) => (a.kind === b.kind ? a.createdAt - b.createdAt : a.kind === "ai" ? -1 : 1));
  return (
    <PageChrome crumbs={["Team"]} wide>
      <div className="max-w-[900px]">
        <PageTitle emoji="👥" title="Team" sub={`${people.filter((p) => p.kind === "human").length} people · ${aiCount} AI employee${aiCount === 1 ? "" : "s"}`} />
      </div>
      <div className="border-t border-hairline text-[14px]">
        <div className="grid grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_110px_120px_minmax(140px,0.8fr)] h-[34px] items-center text-muted text-[13px] border-b border-hairline">
          <div className="px-2 flex items-center gap-1.5"><User size={13} /> Name</div>
          <div className="px-2 flex items-center gap-1.5 border-l border-hairline h-full"><Briefcase size={13} /> Role</div>
          <div className="px-2 flex items-center gap-1.5 border-l border-hairline h-full"><Bot size={13} /> Type</div>
          <div className="px-2 flex items-center gap-1.5 border-l border-hairline h-full"><Circle size={13} /> Status</div>
          <div className="px-2 flex items-center gap-1.5 border-l border-hairline h-full"><Plug size={13} /> Tools</div>
        </div>
        {sorted.map((p) => (
          <div
            key={p.id}
            onClick={() => navigate(`/people/${p.id}`)}
            className={cx("grid grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_110px_120px_minmax(140px,0.8fr)] min-h-[40px] items-center border-b border-hairline hover:bg-[#f9f9f8] cursor-pointer", isFresh(`p:${p.id}`, 6000) && "anim-row-in anim-highlight")}
          >
            <div className="px-2 flex items-center gap-2 min-w-0">
              <PersonAvatar person={p} size={24} />
              <span className="font-medium text-ink truncate">{p.name}</span>
            </div>
            <div className="px-2 text-ink border-l border-hairline h-full flex items-center min-w-0"><span className="truncate">{p.role}</span></div>
            <div className="px-2 border-l border-hairline h-full flex items-center">{p.kind === "ai" ? <Badge tone="purple">AI</Badge> : <Badge tone="gray">Human</Badge>}</div>
            <div className="px-2 border-l border-hairline h-full flex items-center">{p.kind === "ai" ? <StatusPill status={p.status} /> : <span className="text-faint">—</span>}</div>
            <div className="px-2 border-l border-hairline h-full flex items-center gap-1.5 text-muted">
              {p.connectors.map((c) => (
                <span key={c} className="inline-flex items-center gap-1">{c === "gmail" ? <GmailLogo size={14} /> : <Plug size={12} />} {c === "gmail" ? "Gmail" : c}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PageChrome>
  );
}

function ActivityFeed({ person }: { person: Person }) {
  const all = useStore((s) => s.activity);
  const items = useMemo(() => all.filter((a) => a.personId === person.id), [all, person.id]);
  useTick(10000);
  if (!items.length) {
    return (
      <div className="py-8 text-center text-[14px] text-faint border border-dashed border-hairline-strong rounded-lg">
        {person.status === "working" ? <span className="inline-flex items-center gap-2"><Spinner size={12} /> Starting…</span> : "No activity yet. Work shows up here live."}
      </div>
    );
  }
  return (
    <div className="relative">
      {person.status === "working" && (
        <div className="flex items-center gap-2 h-8 text-[14px] text-ink anim-fade-in">
          <Spinner size={12} /> <span className="text-shimmer font-medium">Working…</span>
        </div>
      )}
      {items.map((a, i) => (
        <div key={a.id} className={cx("flex gap-3 py-[5px] text-[14px] anim-row-in", i === 0 && person.status === "working" && "text-ink-strong")}>
          <span className="w-[64px] shrink-0 text-faint font-mono text-[12px] leading-[22px] tabular-nums" title={new Date(a.createdAt).toLocaleString()}>{clock(a.createdAt)}</span>
          <span className={cx("leading-[22px] min-w-0", a.text.startsWith("Done") ? "text-ink font-medium" : "text-ink")}>{a.text}</span>
        </div>
      ))}
    </div>
  );
}

export function PersonPage({ id }: { id: string }) {
  const person = useStore((s) => s.people.find((p) => p.id === id));
  const loaded = useStore((s) => s.loaded);
  const connected = useStore((s) => s.connectors);
  useTick();
  if (!person) {
    return (
      <PageChrome crumbs={["Team"]}>
        <div className="pt-24 text-center text-muted text-[14px]">{loaded ? "No one here by that name." : <Spinner />}</div>
      </PageChrome>
    );
  }
  const ai = person.kind === "ai";
  return (
    <PageChrome crumbs={[<Link to="/team">Team</Link>, person.name]}>
      <div className="pt-16 pb-4">
        <PersonAvatar person={person} size={76} />
        <h1 className="mt-4 text-[40px] font-bold leading-[1.2] tracking-[-0.02em] text-ink-strong flex items-center gap-3">
          {person.name}
          {ai && <span className="text-[14px] font-medium"><Badge tone="purple">AI employee</Badge></span>}
        </h1>
      </div>
      <div className="mb-6">
        <Prop icon={<Briefcase size={14} />} label="Role">{person.role}</Prop>
        {ai ? <Prop icon={<Circle size={14} />} label="Status"><StatusPill status={person.status} /></Prop> : <Prop icon={<Circle size={14} />} label="Type"><Badge tone="gray">Human</Badge></Prop>}
        {ai && (
          <Prop icon={<Plug size={14} />} label="Tools">
            {person.connectors.length ? person.connectors.map((c) => {
              const conn = connected.find((x) => x.provider === c);
              return (
                <span key={c} className={cx("inline-flex items-center gap-1.5 h-6 px-2 rounded border text-[13px]", conn ? "border-[#cfe6d4] bg-[#f1f8f3] text-[#2b593f]" : "border-hairline text-muted")}>
                  {c === "gmail" ? <GmailLogo size={13} /> : <Plug size={12} />}
                  {conn ? conn.account : "Gmail · not connected"}
                </span>
              );
            }) : <span className="text-faint">None</span>}
          </Prop>
        )}
        {!ai && <Prop icon={<AtSign size={14} />} label="Email">{`${person.id}@markosbistro.com`}</Prop>}
        <Prop icon={<FileText size={14} />} label="Joined">{timeAgo(person.createdAt)}</Prop>
      </div>
      {ai && (
        <>
          <h2 className="text-[24px] font-semibold tracking-[-0.01em] text-ink-strong mt-8 mb-2">Instructions</h2>
          <div className="rounded-lg bg-canvas-soft px-4 py-3 mb-8">
            <Markdown text={person.instructions || "_No instructions yet._"} className="md-page !text-[15px]" />
          </div>
          <h2 className="text-[24px] font-semibold tracking-[-0.01em] text-ink-strong mb-3 flex items-center gap-2">
            <ActivityIcon size={20} className="text-faint" /> Activity
          </h2>
          <ActivityFeed person={person} />
        </>
      )}
    </PageChrome>
  );
}
