import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { sendChat, useStore, type ChatItem } from "../store";
import { AppCard, ConnectorCard, EventLine, HireCard, ReportCard } from "./cards";
import { Markdown, cx } from "./common";

/** Reveals text at a steady pace that speeds up with the backlog, so bursts of tokens read smoothly. */
function useSmoothText(text: string, animate: boolean) {
  const [n, setN] = useState(animate ? 0 : text.length);
  const target = useRef(text);
  target.current = text;
  const behind = n < text.length;
  useEffect(() => {
    if (!behind) return;
    let raf = 0;
    const step = () => {
      let done = false;
      setN((cur) => {
        const len = target.current.length;
        if (cur >= len) {
          done = true;
          return len;
        }
        return Math.min(len, cur + Math.max(1, Math.ceil((len - cur) / 14)));
      });
      if (!done) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [behind]);
  return { visible: text.slice(0, n), catching: behind };
}

/** Close dangling markdown markers so partial text renders the same as the final text (no jump). */
function stabilize(md: string) {
  let s = md;
  if ((s.match(/\*\*/g)?.length ?? 0) % 2) s += "**";
  if ((s.match(/`/g)?.length ?? 0) % 2) s += "`";
  return s.replace(/\[[^\]]*$/, "");
}

export function CeoAvatar({ size = 24 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex items-center justify-center shrink-0 bg-[#fdecc8] leading-none"
      style={{ width: size, height: size, borderRadius: size * 0.2, fontSize: size * 0.65 }}
    >
      🍋
    </span>
  );
}

export function CeoMessage({ text, live, showAvatar = true }: { text: string; live?: boolean; showAvatar?: boolean }) {
  const { visible, catching } = useSmoothText(text, !!live);
  const streaming = live || catching;
  return (
    <div className="flex gap-3 my-2 anim-fade-in">
      <div className="w-6 shrink-0 pt-[1px]">{showAvatar && <CeoAvatar />}</div>
      <div className={cx("min-w-0 flex-1 text-[15px] leading-[1.65]", streaming && "md-live")}>
        {showAvatar && <div className="text-[13px] font-semibold text-ink-strong leading-6 -mt-[1px]">AI CEO</div>}
        <Markdown text={streaming ? stabilize(visible) : text} className="md-chat" />
      </div>
    </div>
  );
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end my-4 anim-fade-up">
      <div className="max-w-[80%] bg-[#f1f1ef] rounded-[18px] px-4 py-2 text-[15px] leading-[1.55] whitespace-pre-wrap break-words text-ink">{text}</div>
    </div>
  );
}

function Thinking({ showAvatar }: { showAvatar: boolean }) {
  return (
    <div className="flex gap-3 my-2 anim-fade-in">
      <div className="w-6 shrink-0">{showAvatar && <CeoAvatar />}</div>
      <div>
        {showAvatar && <div className="text-[13px] font-semibold text-ink-strong leading-6">AI CEO</div>}
        <div className="flex items-center gap-2 h-6 text-[14px]">
          <span className="dot-bounce flex gap-[3px]"><span /><span /><span /></span>
          <span className="text-shimmer font-medium">Thinking</span>
        </div>
      </div>
    </div>
  );
}

function Item({ item, showAvatar }: { item: ChatItem; showAvatar: boolean }) {
  switch (item.kind) {
    case "user":
      return <UserMessage text={item.payload.text} />;
    case "ceo":
      return <CeoMessage text={item.payload.text} showAvatar={showAvatar} />;
    case "app_card":
      return <div className="pl-9"><AppCard id={item.id} payload={item.payload} /></div>;
    case "hire_card":
      return <div className="pl-9"><HireCard payload={item.payload} /></div>;
    case "connector_card":
      return <div className="pl-9"><ConnectorCard payload={item.payload} /></div>;
    case "report_card":
      return <div className="pl-9"><ReportCard payload={item.payload} /></div>;
    case "event":
      return <div className="pl-9"><EventLine payload={item.payload} /></div>;
  }
  return null;
}

const CHIPS = [
  { label: "I run a restaurant…", text: "I run a small Mediterranean bistro. Ana is my head chef, Luka is sous-chef, Jovan and Mila are line cooks, Sara, Nikola and Tea wait tables, and Petar manages the place." },
  { label: "What could I automate?", text: "What could I automate in my business?" },
  { label: "Show me the numbers", text: "Show me the numbers: what would automating this be worth for us?" },
];

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function Composer({ onSent, autoFocus, draft, setDraft }: { onSent?: () => void; autoFocus?: boolean; draft: string; setDraft: (s: string) => void }) {
  const busy = useStore((s) => s.busy);
  const [sending, setSending] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(220, el.scrollHeight)}px`;
  }, [draft]);
  useEffect(() => {
    if (autoFocus) ta.current?.focus();
  }, [autoFocus]);
  const canSend = !!draft.trim() && !busy && !sending;
  const send = async () => {
    if (!canSend) return;
    setSending(true);
    const ok = await sendChat(draft).catch(() => false);
    setSending(false);
    if (ok) {
      setDraft("");
      onSent?.();
    }
    ta.current?.focus();
  };
  return (
    <div className="rounded-[14px] border border-hairline-strong bg-white shadow-[0_4px_16px_rgba(15,15,15,0.06),0_1px_2px_rgba(15,15,15,0.04)] focus-within:border-[#c9c8c4] focus-within:shadow-[0_6px_24px_rgba(15,15,15,0.09),0_1px_2px_rgba(15,15,15,0.05)] transition-shadow">
      <textarea
        ref={ta}
        data-composer
        rows={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void send();
          }
          if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur();
        }}
        placeholder={busy ? "AI CEO is replying…" : "Message your AI CEO…"}
        className="block w-full resize-none bg-transparent outline-none px-4 pt-3.5 pb-1 text-[15px] leading-[1.55] placeholder:text-faint max-h-[220px] scroll-thin"
      />
      <div className="flex items-center justify-end px-3 pb-2.5 pt-1">
        {busy ? <span className="text-[12px] text-faint pl-1 mr-auto text-shimmer">Working…</span> : null}
        <button
          onClick={send}
          disabled={!canSend}
          aria-label="Send"
          className={cx("w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150", canSend ? "bg-primary text-white hover:bg-primary-active active:scale-95 cursor-pointer" : "bg-[#ecebe9] text-faint")}
        >
          {sending ? <span className="spinner !border-white/40 !border-t-white" style={{ width: 14, height: 14 }} /> : <ArrowUp size={17} strokeWidth={2.4} />}
        </button>
      </div>
    </div>
  );
}

export function HubPage() {
  const { chat, live, liveKey, itemKeys, busy, loaded } = useStore();
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  // Scroll anchoring: stay pinned to the bottom while content grows, unless the user scrolled up.
  useEffect(() => {
    const el = scroller.current!;
    const onScroll = () => (pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140);
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    });
    if (inner.current) ro.observe(inner.current);
    el.scrollTop = el.scrollHeight;
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);
  // Belt and braces: also follow content changes synchronously (RO alone can lag a frame behind).
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [chat, live, busy]);

  const empty = loaded && chat.length === 0 && !busy;
  let ceoSinceUser = false;
  for (let j = chat.length - 1; j >= 0 && chat[j]!.kind !== "user"; j--) if (chat[j]!.kind === "ceo") ceoSinceUser = true;

  return (
    <div className="h-full flex flex-col">
      <div ref={scroller} data-scroll-root className="flex-1 overflow-y-auto scroll-thin">
        <div ref={inner} className="max-w-[720px] mx-auto px-6 pt-10 pb-8 min-h-full flex flex-col">
          {empty ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center pb-10 anim-fade-up">
              <CeoAvatar size={44} />
              <h1 className="mt-5 text-[30px] font-semibold tracking-[-0.02em] text-ink-strong leading-tight">
                {greeting()}, Marko.
                <br />
                <span className="text-faint">What are we working on?</span>
              </h1>
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {CHIPS.map((c) => (
                  <button
                    key={c.label}
                    onClick={() => {
                      setDraft(c.text);
                      (document.querySelector("[data-composer]") as HTMLTextAreaElement | null)?.focus();
                    }}
                    className="h-9 px-3.5 rounded-full border border-hairline-strong bg-white text-[14px] text-ink hover:bg-hover hover:border-[#cfceca] transition-colors cursor-pointer"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1">
              {chat.map((item, i) => {
                // The avatar marks the first CEO text since the user last spoke.
                let showAvatar = false;
                if (item.kind === "ceo") {
                  showAvatar = true;
                  for (let j = i - 1; j >= 0 && chat[j]!.kind !== "user"; j--) if (chat[j]!.kind === "ceo") showAvatar = false;
                }
                return <Item key={itemKeys[item.id] ?? item.id} item={item} showAvatar={showAvatar} />;
              })}
              {live && <CeoMessage key={`live-${liveKey}`} text={live} live showAvatar={!ceoSinceUser} />}
              {busy && !live && <Thinking showAvatar={!ceoSinceUser} />}
            </div>
          )}
        </div>
      </div>
      <div className="shrink-0 relative">
        <div className="absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        <div className="max-w-[720px] mx-auto px-6 pb-5">
          <Composer draft={draft} setDraft={setDraft} autoFocus onSent={() => (pinned.current = true)} />
        </div>
      </div>
    </div>
  );
}
