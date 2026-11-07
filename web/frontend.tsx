import { createRoot } from "react-dom/client";
import { refresh, useStore } from "./store";
import { connectWs } from "./ws";
import { Sidebar } from "./components/Sidebar";
import { HubPage } from "./components/HubPage";
import { AppPage } from "./components/AppPage";
import { KnowledgePage } from "./components/KnowledgePage";
import { PersonPage, TeamPage } from "./components/TeamPage";
import { Gallery } from "./components/Gallery";
import { PageChrome } from "./components/common";

function Route() {
  const path = useStore((s) => s.path);
  const seg = path.split("/").filter(Boolean).map(decodeURIComponent);
  if (seg.length === 0) return <HubPage />;
  const wrap = (el: React.ReactNode, key: string) => (
    <div key={key} data-scroll-root className="h-full overflow-y-auto scroll-thin">{el}</div>
  );
  if (seg[0] === "app" && seg[1]) return <AppPage key={seg[1]} slug={seg[1]} />;
  if (seg[0] === "knowledge" && seg[1]) return wrap(<KnowledgePage slug={seg[1]} />, path);
  if (seg[0] === "team") return wrap(<TeamPage />, path);
  if (seg[0] === "people" && seg[1]) return wrap(<PersonPage id={seg[1]} />, path);
  if (seg[0] === "dev" && seg[1] === "gallery") return wrap(<Gallery />, path);
  return wrap(<PageChrome crumbs={["Not found"]}><div className="pt-24 text-center text-muted">Nothing here.</div></PageChrome>, path);
}

function Root() {
  return (
    <div className="h-screen flex bg-white text-ink overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 h-full">
        <Route />
      </main>
    </div>
  );
}

const elem = document.getElementById("root")!;
if (import.meta.hot) {
  if (!import.meta.hot.data.started) {
    import.meta.hot.data.started = true;
    connectWs();
    void refresh();
  }
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(<Root />);
} else {
  connectWs();
  void refresh();
  createRoot(elem).render(<Root />);
}
