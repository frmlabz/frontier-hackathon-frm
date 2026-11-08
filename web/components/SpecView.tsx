import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FileText, Pencil } from "lucide-react";
import type { Components } from "react-markdown";
import { saveSpec, type App } from "../store";
import { Button, Markdown, PageTitle, Spinner, cx } from "./common";

const stripFrontmatter = (md: string) => md.replace(/^---\n[\s\S]*?\n---\n*/, "");
const humanize = (id: string) => id.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
/** `:Ingredient:` marks a defined record; render it as a chip (via inline code). */
const markConcepts = (md: string) => md.replace(/(?<![`\w]):([A-Z][\w ]{0,40}?):(?![`\w])/g, "`:$1:`");

const text = (children: unknown) => String(Array.isArray(children) ? children.join("") : children ?? "").trim();

const makeComponents = (changed: Set<string>, working: boolean): Components => {
  const mark = (id: string) =>
    changed.has(id) && <span className={cx("spec-changed", working && "text-shimmer")}>{working ? "Regenerating" : "Not built yet"}</span>;
  return {
    // Definitions and Acceptance are hashed as whole sections.
    h2: ({ children }) => (
      <h2 className="flex items-baseline gap-2.5">
        {children}
        {mark(text(children).toLowerCase())}
      </h2>
    ),
    h3: ({ children }) => {
      const id = text(children);
      return (
        <h3 data-spec-block={id} className="spec-block">
          <span>{humanize(id)}</span>
          <code className="spec-id">{id}</code>
          {mark(id)}
        </h3>
      );
    },
    code: ({ children }) => {
      const t = String(children ?? "");
      const concept = /^:(.+):$/.exec(t);
      return concept ? <span className="spec-concept">{concept[1]}</span> : <code>{children}</code>;
    },
  };
};

function SpecEditor({ slug, initial, onDone }: { slug: string; initial: string; onDone: () => void }) {
  const [draft, setDraft] = useState(initial);
  const [base] = useState(initial); // the spec this edit started from
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [draft]);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  const save = async () => {
    if (initial !== base) return setNote("The spec changed while you were editing. Cancel to see the latest.");
    setSaving(true);
    setNote(null);
    const r = await saveSpec(slug, draft);
    setSaving(false);
    if (r.ok) onDone();
    else setNote(r.message);
  };
  return (
    <div data-spec-editor className="anim-fade-in">
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onDone();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
        }}
        spellCheck={false}
        disabled={saving}
        className="w-full resize-none overflow-hidden rounded-md border border-hairline bg-canvas-soft px-4 py-3 font-mono text-[13px] leading-[1.65] text-ink outline-none focus:border-[#9fc3e7] focus:shadow-[0_0_0_3px_rgba(35,131,226,0.12)]"
      />
      <div className="sticky bottom-0 flex items-center gap-2 py-3 bg-white">
        <Button variant="primary" size="sm" onClick={save} disabled={saving || draft.trim() === base.trim()}>
          {saving ? <><Spinner size={12} /> Saving…</> : "Save & regenerate"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone} disabled={saving}>Cancel</Button>
        <span className="text-[12px] text-faint ml-1">⌘↵ to save · Esc to cancel</span>
        {note && <span className="text-[13px] text-[#c4554d] ml-auto">{note}</span>}
      </div>
    </div>
  );
}

/** The app's spec, the source of truth the code is generated from. */
export function SpecView({ app }: { app: App }) {
  const body = stripFrontmatter(app.spec ?? "").trim();
  const working = ["generating", "building", "fixing"].includes(app.status);
  const [editing, setEditing] = useState(false);
  const changedKey = (app.specChanges ?? []).join(",");
  const components = useMemo(() => makeComponents(new Set(changedKey.split(",").filter(Boolean)), working), [changedKey, working]);
  const state = working
    ? <span className="inline-flex items-center gap-1.5 text-shimmer"><Spinner size={11} /> Regenerating the app from this spec…</span>
    : app.error
      ? <span className="text-[#c4554d]">The last change couldn’t be applied; v{app.version} is still live.</span>
      : app.version > 0 ? <span>The app (v{app.version}) is generated from this page.</span> : null;
  return (
    <div data-scroll-root className="flex-1 overflow-y-auto scroll-thin">
      <div className="max-w-[900px] mx-auto px-12 pb-32 anim-fade-in">
        <PageTitle
          emoji={app.emoji}
          title={`${app.name} spec`}
          sub={
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <FileText size={13} className="text-faint shrink-0" /> {state ?? "The app is generated from this page."}
              </span>
              {!editing && body && (
                <span data-spec-edit className="ml-auto">
                  <Button size="sm" variant="ghost" disabled={working} onClick={() => setEditing(true)}>
                    <Pencil size={13} /> Edit
                  </Button>
                </span>
              )}
            </div>
          }
        />
        {editing ? (
          <SpecEditor slug={app.slug} initial={body} onDone={() => setEditing(false)} />
        ) : body ? (
          <Markdown text={markConcepts(body)} className="md-page md-spec" components={components} />
        ) : (
          <div className="text-muted text-[14px]">This app has no spec yet.</div>
        )}
      </div>
    </div>
  );
}
