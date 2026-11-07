import { useMemo, useState } from "react";
import { Page, Header, Grid, Stat, Row, Input, Select, Button, Table, Badge, Modal, FormRow, EmptyState, toast, type Column } from "@bos/ui";
import { useCollection, db } from "@bos/sdk";

type Ingredient = { name: string; category: string; quantity: number; unit: string; minimum: number; supplier: string };

const CATEGORIES = ["Produce", "Dairy", "Meat", "Dry goods", "Oils & condiments", "Herbs & spices"];
const blank: Ingredient = { name: "", category: "Produce", quantity: 0, unit: "kg", minimum: 0, supplier: "" };

export default function App() {
  const { items, loading } = useCollection<Ingredient>("ingredients");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Ingredient>(blank);

  const low = (i: Ingredient) => (i.quantity ?? 0) < (i.minimum ?? 0);
  const rows = useMemo(
    () => items.filter((i) => (!cat || i.category === cat) && (!q || (i.name ?? "").toLowerCase().includes(q.toLowerCase()))),
    [items, q, cat],
  );
  const lowCount = items.filter(low).length;
  const suppliers = new Set(items.map((i) => i.supplier).filter(Boolean)).size;

  const columns: Column<Ingredient & { id: string }>[] = [
    { key: "name", label: "Ingredient", editable: true },
    { key: "category", label: "Category", editable: true, options: CATEGORIES, width: 150 },
    { key: "quantity", label: "In stock", type: "number", editable: true, width: 110 },
    { key: "unit", label: "Unit", editable: true, width: 80 },
    { key: "minimum", label: "Minimum", type: "number", editable: true, width: 100 },
    { key: "status", label: "Status", width: 110, render: (r) => (low(r) ? <Badge tone="red" dot>Low</Badge> : <Badge tone="green" dot>OK</Badge>) },
    { key: "supplier", label: "Supplier", editable: true },
  ];

  const add = async () => {
    if (!draft.name.trim()) return;
    await db.insert("ingredients", { ...draft, quantity: Number(draft.quantity), minimum: Number(draft.minimum) });
    toast(`Added ${draft.name}`);
    setDraft(blank);
    setOpen(false);
  };

  return (
    <Page width="wide">
      <Header emoji="🥫" title="Inventory" subtitle="What's in the kitchen right now." actions={<Button variant="primary" icon="+" onClick={() => setOpen(true)}>Add ingredient</Button>} />
      <Grid cols={3}>
        <Stat label="Ingredients" value={items.length} emoji="📦" />
        <Stat label="Running low" value={lowCount} tone={lowCount ? "red" : "green"} emoji="⚠️" hint={lowCount ? "Below minimum" : "All good"} />
        <Stat label="Suppliers" value={suppliers} emoji="🚚" />
      </Grid>
      <Row justify="between">
        <div className="flex gap-2 mb-3">
          <Input type="search" value={q} onChange={setQ} placeholder="Search ingredients" width={240} />
          <Select value={cat} onChange={setCat} options={CATEGORIES} placeholder="All categories" width={180} />
        </div>
      </Row>
      {!loading && items.length === 0 ? (
        <EmptyState emoji="🥫" title="No ingredients yet" description="Add your first ingredient to start tracking stock." action={<Button variant="primary" onClick={() => setOpen(true)}>Add ingredient</Button>} />
      ) : (
        <Table
          columns={columns}
          rows={rows}
          loading={loading}
          defaultSort={{ key: "name", dir: "asc" }}
          rowTone={(r) => (low(r) ? "red" : undefined)}
          onEdit={(r, key, value) => db.update("ingredients", r.id, { [key]: value })}
          onDelete={async (r) => { await db.remove("ingredients", r.id); toast(`Removed ${r.name}`); }}
          emptyText="No ingredients match your search"
        />
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add ingredient" footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={add}>Add</Button></>}>
        <Input label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} autoFocus onEnter={add} />
        <FormRow>
          <Input label="Quantity" type="number" value={draft.quantity} onChange={(v) => setDraft({ ...draft, quantity: Number(v) })} />
          <Input label="Unit" value={draft.unit} onChange={(v) => setDraft({ ...draft, unit: v })} />
          <Input label="Minimum" type="number" value={draft.minimum} onChange={(v) => setDraft({ ...draft, minimum: Number(v) })} />
        </FormRow>
        <Select label="Category" value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} options={CATEGORIES} />
        <Input label="Supplier" value={draft.supplier} onChange={(v) => setDraft({ ...draft, supplier: v })} />
      </Modal>
    </Page>
  );
}
