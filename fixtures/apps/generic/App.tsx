// Generic fixture for mock mode: any app name the CEO script doesn't know gets this list app.
import { useState } from "react";
import { Page, Header, Grid, Stat, Button, Table, Badge, Modal, Input, Select, Tabs, EmptyState, toast } from "@bos/ui";
import { useCollection, db } from "@bos/sdk";

type Item = { name: string; status: string; owner: string; notes: string };
const STATUSES = ["Todo", "In progress", "Done"];

export default function App() {
  const { items, loading } = useCollection<Item>("items");
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Item>({ name: "", status: "Todo", owner: "", notes: "" });
  const rows = items.filter((i) => tab === "all" || i.status === tab);
  const add = async () => {
    if (!draft.name.trim()) return;
    await db.insert("items", draft);
    toast("Added");
    setOpen(false);
    setDraft({ name: "", status: "Todo", owner: "", notes: "" });
  };
  return (
    <Page>
      <Header emoji="📋" title="Tracker" subtitle="A simple list to keep things moving." actions={<Button variant="primary" icon="+" onClick={() => setOpen(true)}>New</Button>} />
      <Grid cols={3}>
        {STATUSES.map((s) => <Stat key={s} label={s} value={items.filter((i) => i.status === s).length} />)}
      </Grid>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "all", label: "All", count: items.length }, ...STATUSES.map((s) => ({ id: s, label: s, count: items.filter((i) => i.status === s).length }))]} />
      {!loading && items.length === 0 ? (
        <EmptyState title="Nothing here yet" action={<Button variant="primary" onClick={() => setOpen(true)}>Add the first one</Button>} />
      ) : (
        <Table
          rows={rows}
          loading={loading}
          columns={[
            { key: "name", label: "Name", editable: true },
            { key: "status", label: "Status", width: 130, render: (r) => <Badge tone={r.status === "Done" ? "green" : r.status === "In progress" ? "blue" : "gray"} dot>{r.status}</Badge> },
            { key: "owner", label: "Owner", editable: true, width: 160 },
            { key: "notes", label: "Notes", editable: true },
          ]}
          onEdit={(r, k, v) => db.update("items", r.id, { [k]: v })}
          onDelete={(r) => db.remove("items", r.id)}
        />
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New item" footer={<Button variant="primary" onClick={add}>Add</Button>}>
        <Input label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} autoFocus onEnter={add} />
        <Select label="Status" value={draft.status} onChange={(v) => setDraft({ ...draft, status: v })} options={STATUSES} />
        <Input label="Owner" value={draft.owner} onChange={(v) => setDraft({ ...draft, owner: v })} />
      </Modal>
    </Page>
  );
}
