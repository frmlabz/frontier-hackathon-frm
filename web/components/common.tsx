import { useEffect, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { navigate, type Person } from "../store";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function timeAgo(ts: number) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
export const clock = (ts: number) => new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Re-render every `ms` so relative times stay fresh. */
export function useTick(ms = 20000) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

export function Link({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

export function Markdown({ text, className, components }: { text: string; className?: string; components?: Components }) {
  return (
    <div className={cx("md", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) =>
            href?.startsWith("/") ? <Link to={href}>{children}</Link> : <a href={href} target="_blank" rel="noreferrer">{children}</a>,
          ...components,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export const Spinner = ({ size = 14, className }: { size?: number; className?: string }) => (
  <span className={cx("spinner", className)} style={{ width: size, height: size }} />
);

export function PersonAvatar({ person, size = 28, ring }: { person: Pick<Person, "emoji" | "color" | "name" | "kind">; size?: number; ring?: boolean }) {
  const c = person.color || "#a39e98";
  const ai = person.kind === "ai";
  return (
    <span
      className={cx("inline-flex items-center justify-center rounded-full shrink-0 select-none", ring && "ring-2 ring-white")}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.52,
        background: ai ? `linear-gradient(135deg, ${shade(c, 0.78)}, ${shade(c, 0.5)})` : `${c}26`,
        boxShadow: ai ? `inset 0 0 0 1px ${c}33` : undefined,
      }}
      title={person.name}
    >
      {person.emoji}
    </span>
  );
}

/** Mix a hex color with white (amt 0..1). */
export function shade(hex: string, amt: number) {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m) return hex;
  const [r, g, b] = m.map((x) => parseInt(x, 16));
  const mix = (v: number) => Math.round(v + (255 - v) * amt).toString(16).padStart(2, "0");
  return `#${mix(r!)}${mix(g!)}${mix(b!)}`;
}

export function Badge({ children, tone = "gray", dot }: { children: ReactNode; tone?: "gray" | "blue" | "green" | "purple" | "orange" | "red" | "yellow"; dot?: boolean }) {
  const tones = {
    gray: "bg-[#e3e2e0] text-[#5a5955]",
    blue: "bg-[#d3e5ef] text-[#1f4f6e]",
    green: "bg-[#dbeddb] text-[#2b593f]",
    purple: "bg-[#e8deee] text-[#5a3a75]",
    orange: "bg-[#fadec9] text-[#8a4a10]",
    red: "bg-[#ffe2dd] text-[#8b2a26]",
    yellow: "bg-[#fdecc8] text-[#7a5a14]",
  };
  return (
    <span className={cx("inline-flex items-center gap-1.5 h-5 px-1.5 rounded text-[12px] font-medium whitespace-nowrap leading-none", tones[tone])}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Button({
  children, onClick, variant = "secondary", disabled, className, size = "md", type = "button",
}: { children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost"; disabled?: boolean; className?: string; size?: "sm" | "md"; type?: "button" | "submit" }) {
  const v = {
    primary: "bg-primary text-white hover:bg-primary-active shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)]",
    secondary: "bg-white border border-hairline-strong text-ink hover:bg-hover",
    ghost: "text-muted hover:bg-hover hover:text-ink",
  }[variant];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-[background,transform,opacity] duration-100 active:scale-[0.98] disabled:opacity-60 disabled:cursor-default disabled:active:scale-100 cursor-pointer select-none whitespace-nowrap",
        size === "sm" ? "h-7 px-2.5 text-[13px]" : "h-8 px-3 text-[14px]",
        v,
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Notion page chrome: sticky top bar with breadcrumb, then a centered 900px content column. */
export function PageChrome({ crumbs, right, children, wide }: { crumbs: ReactNode[]; right?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-full flex flex-col">
      <TopBar crumbs={crumbs} right={right} />
      <div className={cx("w-full mx-auto px-4 sm:px-12 pb-32 anim-fade-in", wide ? "max-w-[1200px]" : "max-w-[900px]")}>{children}</div>
    </div>
  );
}

export function TopBar({ crumbs, right }: { crumbs: ReactNode[]; right?: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 h-11 shrink-0 flex items-center justify-between gap-3 px-3 bg-white">
      <div className="flex items-center gap-0.5 min-w-0 text-[14px] text-ink">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-0.5 min-w-0">
            {i > 0 && <span className="text-faint px-0.5">/</span>}
            <span className="truncate px-1.5 py-0.5 rounded hover:bg-hover">{c}</span>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[13px] text-muted shrink-0">{right}</div>
    </div>
  );
}

export function PageTitle({ emoji, title, sub }: { emoji: string; title: string; sub?: ReactNode }) {
  return (
    <div className="pt-16 pb-4">
      <div className="text-[78px] leading-[1.1] mb-2 select-none">{emoji}</div>
      <h1 className="text-[28px] sm:text-[40px] font-bold leading-[1.2] tracking-[-0.02em] text-ink-strong [overflow-wrap:anywhere]">{title}</h1>
      {sub && <div className="mt-2 text-[14px] text-muted">{sub}</div>}
    </div>
  );
}

/** A Notion property row (label column + value). */
export function Prop({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start min-h-[34px] text-[14px]">
      <div className="w-40 shrink-0 flex items-center gap-2 h-[34px] text-muted px-1.5">
        <span className="opacity-70 flex">{icon}</span>
        {label}
      </div>
      <div className="flex-1 min-w-0 flex items-center flex-wrap gap-1.5 min-h-[34px] px-1.5 py-1">{children}</div>
    </div>
  );
}
