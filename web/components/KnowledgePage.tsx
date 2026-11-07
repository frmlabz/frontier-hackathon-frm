import { Sparkles } from "lucide-react";
import { isFresh, useStore } from "../store";
import { Markdown, PageChrome, PageTitle, Spinner, cx, timeAgo, useTick } from "./common";

export function KnowledgePage({ slug }: { slug: string }) {
  const page = useStore((s) => s.knowledge.find((k) => k.slug === slug));
  const loaded = useStore((s) => s.loaded);
  useStore((s) => s.fresh);
  useTick();
  if (!page) {
    return (
      <PageChrome crumbs={["Knowledge"]}>
        <div className="pt-24 text-center text-muted text-[14px]">{loaded ? "This page doesn’t exist yet." : <Spinner />}</div>
      </PageChrome>
    );
  }
  const changed = isFresh(`kc:${slug}`, 2500);
  return (
    <PageChrome crumbs={[<span className="text-muted">Knowledge</span>, <span className="flex items-center gap-1.5"><span>{page.emoji}</span>{page.title}</span>]} right={<span>Edited {timeAgo(page.updatedAt)}</span>}>
      <PageTitle
        emoji={page.emoji}
        title={page.title}
        sub={
          <span className="inline-flex items-center gap-1.5">
            <Sparkles size={13} className="text-faint" /> Updated by AI CEO · {timeAgo(page.updatedAt)}
          </span>
        }
      />
      <div key={page.updatedAt} className={cx("rounded-md -mx-2 px-2 transition-colors", changed && "anim-highlight")}>
        <Markdown text={page.markdown} className="md-page" />
      </div>
    </PageChrome>
  );
}
