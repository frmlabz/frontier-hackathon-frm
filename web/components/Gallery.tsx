import { useState, type ReactNode } from "react";
import type { App, Person } from "../store";
import { AppCardView, ConnectorCardView, EventLine, HireCardView } from "./cards";
import { CeoMessage, Composer } from "./HubPage";
import { Button, PageChrome, PageTitle } from "./common";

const app = (over: Partial<App>): App => ({
  slug: "inventory", name: "Inventory", emoji: "🥫", description: "Track ingredient stock levels", requirements: "",
  schema: null, status: "ready", version: 1, step: "Ready", error: null, createdAt: Date.now(), ...over,
});
const nina: Person = {
  id: "nina", kind: "ai", name: "Nina", role: "Bookkeeping assistant", emoji: "🧾", color: "#9065b0",
  instructions: "", connectors: ["gmail"], status: "idle", createdAt: Date.now(),
};

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-10">
      <div className="text-[12px] font-medium text-faint uppercase tracking-wide mb-2">{title}</div>
      {children}
    </div>
  );
}

function BuildTest() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  return (
    <Button
      disabled={state === "busy"}
      onClick={async () => {
        setState("busy");
        const r = await fetch("/api/dev/build", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => null);
        setState(r?.ok ? "done" : "error");
      }}
    >
      {state === "busy" ? "Starting…" : state === "done" ? "Started — see sidebar" : state === "error" ? "Failed — retry" : "Build test app (Inventory)"}
    </Button>
  );
}

export function Gallery() {
  const [draft, setDraft] = useState("Hello there");
  return (
    <PageChrome crumbs={["Dev", "Gallery"]}>
      <PageTitle emoji="🧪" title="Component gallery" sub="Every card in every state. Dev only." />
      <Block title="Dev actions"><BuildTest /></Block>
      <Block title="App card">
        <AppCardView app={app({ status: "generating", step: "Designing your app", version: 0 })} />
        <AppCardView app={app({ status: "generating", step: "Writing the app", version: 0 })} />
        <AppCardView app={app({ status: "building", step: "Packaging", version: 0 })} />
        <AppCardView app={app({ status: "ready", version: 1 })} />
        <AppCardView app={app({ status: "building", step: "Writing the app", version: 1 })} change="Add a supplier column" />
        <AppCardView app={app({ status: "ready", version: 2 })} change="Add a supplier column" />
        <AppCardView app={app({ status: "fixing", step: "Designing your app", version: 1 })} />
        <AppCardView app={app({ status: "failed", step: "Packaging", version: 0, error: "I couldn’t get this app working. Try describing it a little differently." })} />
        <AppCardView app={app({ status: "ready", version: 2, error: "The last change didn’t work, so the previous version is still live." })} change="Add charts" />
      </Block>
      <Block title="Hire card">
        <HireCardView person={nina} connected={[]} />
        <HireCardView person={nina} connected={["gmail"]} />
      </Block>
      <Block title="Connector card">
        <ConnectorCardView reason="Nina needs Gmail to read supplier invoices." onConnect={() => new Promise((r) => setTimeout(() => r(true), 1500))} />
        <ConnectorCardView reason="Retry state (connect fails)." onConnect={() => new Promise((r) => setTimeout(() => r(false), 800))} />
        <ConnectorCardView reason="Nina needs Gmail to read supplier invoices." account="marko@markosbistro.com" onConnect={async () => true} />
      </Block>
      <Block title="Event lines">
        <EventLine payload={{ icon: "page", text: "Created page", link: "/knowledge/company-profile", linkText: "Company profile" }} />
        <EventLine payload={{ icon: "plug", text: "Gmail connected as marko@markosbistro.com" }} />
        <EventLine payload={{ icon: "bot", text: "Processed 4 supplier invoices and updated 9 ingredients." }} />
      </Block>
      <Block title="CEO message">
        <CeoMessage text={"Got it. **Marko's Bistro** is a Mediterranean place with 8 people.\n\n- Stock lives in a notebook\n- Invoices arrive by email\n\nWant me to set up an **Inventory** app?"} />
      </Block>
      <Block title="Composer">
        <Composer draft={draft} setDraft={setDraft} />
      </Block>
      <Block title="UI kit (inside an app iframe)">
        <iframe src="/dev/kit/frame" title="kit" className="w-full h-[1400px] rounded-lg border border-hairline" />
      </Block>
    </PageChrome>
  );
}
