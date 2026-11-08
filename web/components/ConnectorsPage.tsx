// 🔌 Connectors (04 A1, 05 §3.3): the catalog with search, category tabs and the fake sign-in.
import { useState } from "react";
import { MoreHorizontal, Search } from "lucide-react";
import { disconnect, openConnector, useStore } from "../store";
import { CONNECTORS, type Category, type Connector } from "../../server/connectors";
import { ProviderLogo } from "../logos";
import { Badge, Button, Link, PageChrome, PageTitle, cx } from "./common";

const TABS: ("All" | Category)[] = ["All", "Email & chat", "Sheets & docs", "Automation", "Sales & payments", "Accounting"];

export function ConnectorsPage() {
  const connectors = useStore((s) => s.connectors);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const account = (id: string) => connectors.find((c) => c.provider === id)?.account;
  const needle = q.trim().toLowerCase();
  const shown = CONNECTORS.filter(
    (c) => (tab === "All" || c.category === tab) && (!needle || c.name.toLowerCase().includes(needle) || c.description.toLowerCase().includes(needle)),
  ).sort((a, b) => Number(!!account(b.id)) - Number(!!account(a.id))); // stable: the rest keep catalog order

  return (
    <PageChrome crumbs={["🔌 Connectors"]} wide>
      <PageTitle emoji="🔌" title="Connectors" sub="Connect the tools your business already uses. Your AI employees work through these." />
      <div className="flex flex-col gap-3 mb-6">
        <label className="flex items-center gap-2 h-9 px-2.5 rounded-md border border-hairline-strong bg-white max-w-[360px] focus-within:border-primary">
          <Search size={15} className="text-faint shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools" aria-label="Search tools" className="flex-1 min-w-0 bg-transparent outline-none text-[14px]" />
        </label>
        <div role="tablist" className="flex gap-1 overflow-x-auto scroll-thin border-b border-hairline">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cx("h-9 px-2.5 -mb-px border-b-2 text-[14px] whitespace-nowrap cursor-pointer", tab === t ? "border-ink text-ink-strong font-medium" : "border-transparent text-muted hover:text-ink")}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="py-16 text-center text-[14px] text-muted">No tools match your search.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {shown.map((c) => <ConnectorTile key={c.id} connector={c} account={account(c.id)} />)}
        </div>
      )}
    </PageChrome>
  );
}

function ConnectorTile({ connector: c, account }: { connector: Connector; account?: string }) {
  const usedBy = useStore((s) => s.people).filter((p) => p.kind === "ai" && p.connectors.includes(c.id));
  return (
    <div data-connector={c.id} className="rounded-lg border border-hairline bg-white p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <span className="w-12 h-12 rounded-lg border border-hairline flex items-center justify-center shrink-0">
          <ProviderLogo id={c.id} size={32} />
        </span>
        {account && <TileMenu id={c.id} name={c.name} />}
      </div>
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-ink-strong">{c.name}</div>
        <div className="text-[13px] text-muted">{c.description}</div>
      </div>
      <div className="mt-auto min-w-0">
        {account ? (
          <>
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
              <span className="anim-pop"><Badge tone="green" dot>Connected</Badge></span>
              <span className="text-[12px] text-muted truncate min-w-0">as {account}</span>
            </div>
            {usedBy.length > 0 && (
              <div className="mt-1.5 text-[12px] text-muted">
                Used by{" "}
                {usedBy.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && ", "}
                    <Link to={`/people/${p.id}`} className="text-ink hover:underline">{p.emoji} {p.name}</Link>
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <Button size="sm" onClick={() => openConnector(c.id)}>Connect</Button>
        )}
      </div>
    </div>
  );
}

function TileMenu({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button aria-label={`${name} options`} onClick={() => setOpen((o) => !o)} className="w-7 h-7 rounded flex items-center justify-center text-muted hover:bg-hover hover:text-ink cursor-pointer">
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-36 py-1 rounded-md border border-hairline bg-white shadow-lg anim-fade-in">
            <button
              onClick={() => { setOpen(false); void disconnect(id); }}
              className="w-full h-8 px-3 text-left text-[14px] text-red hover:bg-hover cursor-pointer"
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}
