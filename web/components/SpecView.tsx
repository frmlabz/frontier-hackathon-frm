import { FileText } from "lucide-react";
import type { Components } from "react-markdown";
import type { App } from "../store";
import { Markdown, PageTitle, Spinner } from "./common";

const stripFrontmatter = (md: string) => md.replace(/^---\n[\s\S]*?\n---\n*/, "");
const humanize = (id: string) => id.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
/** `:Ingredient:` marks a defined record; render it as a chip (via inline code). */
const markConcepts = (md: string) => md.replace(/(?<![`\w]):([A-Z][\w ]{0,40}?):(?![`\w])/g, "`:$1:`");

const components: Components = {
  h3: ({ children }) => {
    const id = String(Array.isArray(children) ? children.join("") : children ?? "").trim();
    return (
      <h3 data-spec-block={id} className="spec-block">
        <span>{humanize(id)}</span>
        <code className="spec-id">{id}</code>
      </h3>
    );
  },
  code: ({ children }) => {
    const t = String(children ?? "");
    const concept = /^:(.+):$/.exec(t);
    return concept ? <span className="spec-concept">{concept[1]}</span> : <code>{children}</code>;
  },
};

/** Stretch A: the app's spec, the source of truth the code is generated from. */
export function SpecView({ app }: { app: App }) {
  const body = stripFrontmatter(app.spec ?? "").trim();
  const working = ["generating", "building", "fixing"].includes(app.status);
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
            <span className="inline-flex items-center gap-1.5">
              <FileText size={13} className="text-faint" /> {state ?? "The app is generated from this page."}
            </span>
          }
        />
        {body ? <Markdown text={markConcepts(body)} className="md-page md-spec" components={components} /> : <div className="text-muted text-[14px]">This app has no spec yet.</div>}
      </div>
    </div>
  );
}
