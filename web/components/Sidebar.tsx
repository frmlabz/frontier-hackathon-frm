import { ChevronsUpDown, MessageCircle, Users } from "lucide-react";
import type { ReactNode } from "react";
import omniMark from "../assets/omni-mark.svg" with { type: "file" };
import { isFresh, useStore } from "../store";
import { Link, Spinner, cx } from "./common";

function Row({ to, icon, label, active, right, fresh }: { to: string; icon: ReactNode; label: string; active: boolean; right?: ReactNode; fresh?: boolean }) {
  return (
    <Link
      to={to}
      className={cx(
        "group flex items-center gap-2 h-[28px] px-2 mx-1 rounded-[4px] text-[14px] transition-colors duration-100",
        active ? "bg-active text-ink-strong font-medium" : "text-[#5f5e5b] hover:bg-hover",
        fresh && "anim-row-in",
      )}
    >
      <span className="w-5 h-5 flex items-center justify-center shrink-0 text-[15px] leading-none">{icon}</span>
      <span className="truncate flex-1">{label}</span>
      {right}
    </Link>
  );
}

function Section({ title, children, empty }: { title: string; children: ReactNode; empty?: string }) {
  return (
    <div className="mt-5">
      <div className="px-3 mb-0.5 h-6 flex items-center text-[12px] font-medium text-faint select-none">{title}</div>
      {children}
      {empty && <div className="px-3 h-[28px] flex items-center text-[13px] text-faint">{empty}</div>}
    </div>
  );
}

export function Sidebar() {
  const { path, knowledge, apps, unread } = useStore();
  useStore((s) => s.fresh); // re-render when something new arrives
  return (
    <aside className="w-[240px] shrink-0 h-full bg-sidebar border-r border-hairline flex flex-col select-none">
      <div className="px-1 pt-1.5">
        <div className="flex items-center gap-2 h-[34px] px-2 mx-0 rounded-[4px] hover:bg-hover cursor-default">
          <span className="w-5 h-5 rounded-[4px] bg-[#fdecc8] flex items-center justify-center text-[13px]">🍋</span>
          <span className="text-[14px] font-semibold text-ink-strong truncate flex-1">Marko's Bistro</span>
          <ChevronsUpDown size={14} className="text-faint" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin pb-4 pt-1">
        <Row
          to="/"
          icon={<MessageCircle size={16} strokeWidth={2} className="text-[#5f5e5b]" />}
          label="Hub"
          active={path === "/"}
          right={unread && path !== "/" ? <span className="w-2 h-2 rounded-full bg-[#eb5757] anim-pop" title="New messages" /> : null}
        />
        <Row to="/team" icon={<Users size={16} strokeWidth={2} className="text-[#5f5e5b]" />} label="Team" active={path === "/team" || path.startsWith("/people/")} />

        <Section title="Knowledge" empty={knowledge.length ? undefined : "Pages appear as we talk"}>
          {knowledge.map((k) => (
            <Row key={k.slug} to={`/knowledge/${k.slug}`} icon={k.emoji} label={k.title} active={path === `/knowledge/${k.slug}`} fresh={isFresh(`k:${k.slug}`)} />
          ))}
        </Section>

        <Section title="Apps" empty={apps.length ? undefined : "No apps yet"}>
          {apps.map((a) => {
            const working = ["generating", "building", "fixing"].includes(a.status);
            return (
              <Row
                key={a.slug}
                to={`/app/${a.slug}`}
                icon={a.emoji}
                label={a.name}
                active={path === `/app/${a.slug}`}
                fresh={isFresh(`a:${a.slug}`)}
                right={
                  working ? <Spinner size={12} /> : a.status === "failed" ? <span className="w-2 h-2 rounded-full bg-red" title="Setup failed" /> : null
                }
              />
            );
          })}
        </Section>
      </div>
      <div className="shrink-0 border-t border-hairline px-3 py-3">
        <Link to="/" className="inline-flex items-center gap-1.5 rounded-[4px] text-muted hover:text-ink-strong transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
          <img src={omniMark} alt="" width={16} height={16} className="shrink-0 opacity-70" />
          <span className="text-[13px] font-semibold tracking-[-0.02em]">omni</span>
        </Link>
      </div>
    </aside>
  );
}
