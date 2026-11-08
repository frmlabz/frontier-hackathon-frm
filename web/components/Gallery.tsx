import { useState, type ReactNode } from "react";
import type { App, Person } from "../store";
import { AppCardView, ConnectorCardView, EventLine, HireCardView, ReportCardView } from "./cards";
import { ReportPageView } from "./ReportPage";
import { validateReport, type ReportRow, type Submission } from "../../server/report";
import fixtureReport from "../../fixtures/research/report.json";
import fixtureRequest from "../../fixtures/research/request.json";
import { CeoMessage, Composer } from "./HubPage";
import { Button, PageChrome, PageTitle } from "./common";
import { CONNECTORS, getConnector } from "../../server/connectors";
import { ProviderLogo } from "../logos";
import { GenericConsent, GoogleSignIn } from "./ConnectorSignIn";

const noop = () => {};
const fakeAllow = (ok: boolean) => () => new Promise<string | null>((r) => setTimeout(() => r(ok ? null : "Couldn't connect. Try again."), 900));
const frame = "flex justify-center py-6 bg-black/40 rounded-lg overflow-hidden";

const app = (over: Partial<App>): App => ({
  slug: "inventory", name: "Inventory", emoji: "🥫", description: "Track ingredient stock levels", spec: "",
  schema: null, status: "ready", version: 1, step: "Ready", error: null, createdAt: Date.now(), ...over,
});
const nina: Person = {
  id: "nina", kind: "ai", name: "Nina", role: "Bookkeeping assistant", emoji: "🧾", color: "#9065b0",
  instructions: "", connectors: ["gmail"], status: "idle", createdAt: Date.now(),
};

// Report states from the real fixture, run through the same validator the server uses.
const ready = validateReport(fixtureReport as Submission, fixtureRequest, null).report;
const reportRow = (over: Partial<ReportRow>): ReportRow => ({
  id: "gallery", status: "ready", input: fixtureRequest, report: ready, progress: { lines: [], sources: 3 }, error: null, createdAt: Date.now(), updatedAt: Date.now(), ...over,
});
const thinRow = reportRow({ status: "thin", report: { ...ready, findings: ready.findings.slice(0, 1), estimates: [], charts: [], opportunities: [], sources: ready.sources.slice(0, 1) } });
const researchingRow = reportRow({
  status: "researching", report: null,
  progress: { lines: ["Searching for restaurant food waste studies", "Reading Champions 12.3: The Business Case for Reducing Food Loss and Waste", "Searching for invoice processing time benchmarks", "Reading Stampli: How to Calculate the True Cost of AP Automation", "Checking quotes against the sources"], sources: 3 },
});
const failedRow = reportRow({ status: "failed", report: null, error: "The research didn't finish: no claim could be checked against a source." });

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
        <AppCardView app={app({ status: "building", step: "Writing the app", version: 1 })} change="Add a supplier column" specs={["list-ingredients", "supplier-filter"]} />
        <AppCardView app={app({ status: "ready", version: 2 })} change="Add a supplier column" specs={["list-ingredients", "supplier-filter"]} checks={{ version: 2, at: 0, items: [{ id: "a", label: "Feta flagged Low", row: "Feta", text: "Low" }, { id: "b", label: "Supplier column shown", row: null, text: "Supplier" }], results: null }} />
        <AppCardView app={app({ status: "ready", version: 2 })} change="Add a supplier column" specs={["list-ingredients", "supplier-filter"]} checks={{ version: 2, at: 0, items: [{ id: "a", label: "Feta flagged Low", row: "Feta", text: "Low" }, { id: "b", label: "Supplier column shown", row: null, text: "Supplier" }], results: { a: true, b: true } }} />
        <AppCardView app={app({ status: "ready", version: 3 })} change="Add a supplier column" specs={["supplier-filter"]} checks={{ version: 3, at: 0, items: [{ id: "a", label: "Feta flagged Low", row: "Feta", text: "Low" }, { id: "b", label: "Supplier column shown", row: null, text: "Supplier" }], results: { a: true, b: false } }} />
        <AppCardView app={app({ status: "fixing", step: "Designing your app", version: 1 })} />
        <AppCardView app={app({ status: "failed", step: "Packaging", version: 0, error: "I couldn’t get this app working. Try describing it a little differently." })} />
        <AppCardView app={app({ status: "ready", version: 2, error: "The last change didn’t work, so the previous version is still live." })} change="Add charts" />
      </Block>
      <Block title="Hire card">
        <HireCardView person={nina} connected={[]} />
        <HireCardView person={nina} connected={["gmail"]} />
      </Block>
      <Block title="Connector card">
        <ConnectorCardView reason="Nina needs Gmail to read supplier invoices." onConnect={() => {}} />
        <ConnectorCardView reason="Nina needs Gmail to read supplier invoices." account="marko@markosbistro.com" onConnect={() => {}} />
      </Block>
      <Block title="Provider logos (32 / 16 px)">
        <div className="grid grid-cols-2 sm:grid-cols-7 gap-3">
          {CONNECTORS.map((c) => (
            <div key={c.id} className="flex flex-col items-center gap-1.5 text-[11px] text-muted">
              <ProviderLogo id={c.id} size={32} />
              <ProviderLogo id={c.id} size={16} />
              {c.name}
            </div>
          ))}
        </div>
      </Block>
      <Block title="Google sign-in: choose an account / another account / consent / Allow fails">
        <div className="flex flex-col gap-4">
          <div className={frame}><GoogleSignIn connector={getConnector("gmail")!} onAllow={fakeAllow(true)} onCancel={noop} /></div>
          <div className={frame}><GoogleSignIn connector={getConnector("gmail")!} onAllow={fakeAllow(true)} onCancel={noop} initialOther /></div>
          <div className={frame}><GoogleSignIn connector={getConnector("gmail")!} onAllow={fakeAllow(true)} onCancel={noop} initialStep="consent" /></div>
          <div className={frame}><GoogleSignIn connector={getConnector("google-sheets")!} onAllow={fakeAllow(false)} onCancel={noop} initialStep="consent" /></div>
        </div>
      </Block>
      <Block title="Generic consent (Slack, Xero; Allow fails on Xero)">
        <div className="flex flex-col gap-4">
          <div className={frame}><GenericConsent connector={getConnector("slack")!} onAllow={fakeAllow(true)} onCancel={noop} /></div>
          <div className={frame}><GenericConsent connector={getConnector("xero")!} onAllow={fakeAllow(false)} onCancel={noop} /></div>
        </div>
      </Block>
      <Block title="Report card: researching / ready / thin / failed">
        <ReportCardView row={researchingRow} />
        <ReportCardView row={reportRow({})} />
        <ReportCardView row={thinRow} />
        <ReportCardView row={failedRow} />
      </Block>
      <Block title="Report page: thin">
        <div className="rounded-lg border border-hairline px-6 pb-6"><ReportPageView row={thinRow} /></div>
      </Block>
      <Block title="Report page: researching / failed">
        <div className="rounded-lg border border-hairline px-6 pb-6 mb-3"><ReportPageView row={researchingRow} /></div>
        <div className="rounded-lg border border-hairline px-6 pb-6"><ReportPageView row={failedRow} /></div>
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
