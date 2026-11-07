import { useMemo, useState } from "react";
import { Page, Header, Grid, Stat, Row, Input, Select, Button, Table, Badge, Modal, FormRow, EmptyState, FileDrop, Muted, toast, type Column } from "@bos/ui";
import { useCollection, db, ai } from "@bos/sdk";

type Ingredient = { name: string; category: string; quantity: number; unit: string; minimum: number; supplier: string };

const CATEGORIES = ["Produce", "Dairy", "Meat", "Dry goods", "Oils & condiments", "Herbs & spices"];
type Line = { id: string; name: string; quantity: number; unit: string };
const INSTRUCTIONS = 'A supplier invoice or delivery note. Return {"supplier": string, "invoiceNumber": string, "lines": [{"name": string, "quantity": number, "unit": string}]} with one line per delivered item.';
const blank: Ingredient = { name: "", category: "Produce", quantity: 0, unit: "kg", minimum: 0, supplier: "" };

export default function App() {
  const { items, loading } = useCollection<Ingredient>("ingredients");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Ingredient>(blank);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [invoice, setInvoice] = useState<{ supplier: string; invoiceNumber: string; lines: Line[]; photo: string } | null>(null);
  const match = (name: string) => items.find((i) => (i.name ?? "").toLowerCase() === (name ?? "").toLowerCase());

  const read = async (file: File) => {
    setReading(true);
    try {
      const r = await ai.extract(file, INSTRUCTIONS);
      const lines = (r?.lines ?? []).map((l: any, i: number) => ({ id: String(i), name: String(l.name ?? ""), quantity: Number(l.quantity) || 0, unit: String(l.unit ?? "") }));
      setInvoice({ supplier: r?.supplier ?? "", invoiceNumber: r?.invoiceNumber ?? "", lines, photo: URL.createObjectURL(file) });
    } catch {
      toast("Couldn't read that photo", "error");
    } finally {
      setReading(false);
    }
  };
  const apply = async () => {
    if (!invoice) return;
    setApplying(true);
    // Same item twice on one invoice: add both quantities.
    const totals = new Map<string, Line>();
    for (const l of invoice.lines) {
      const k = l.name.trim().toLowerCase();
      const t = totals.get(k);
      totals.set(k, t ? { ...t, quantity: t.quantity + l.quantity } : l);
    }
    try {
      for (const l of totals.values()) {
        const m = match(l.name);
        if (m) await db.update("ingredients", m.id, { quantity: (m.quantity ?? 0) + l.quantity });
        else await db.insert("ingredients", { ...blank, name: l.name, quantity: l.quantity, unit: l.unit, supplier: invoice.supplier });
      }
      toast(`Stock updated from ${invoice.invoiceNumber || "the invoice"}`, "success");
      setInvoice(null);
      setPhotoOpen(false);
    } catch {
      toast("Couldn't update all the stock. Check the table and try again.", "error");
    } finally {
      setApplying(false);
    }
  };
  const closePhoto = () => { if (applying || reading) return; setPhotoOpen(false); setInvoice(null); };

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
      <Header emoji="🥫" title="Inventory" subtitle="What's in the kitchen right now." actions={<><Button icon="📷" onClick={() => setPhotoOpen(true)}>Import invoice photo</Button><Button variant="primary" icon="+" onClick={() => setOpen(true)}>Add ingredient</Button></>} />
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
      <Modal open={photoOpen} onClose={closePhoto} side title="Import invoice photo" footer={invoice && <><Button onClick={() => setInvoice(null)} disabled={applying}>Back</Button><Button variant="primary" onClick={apply} disabled={applying || !invoice.lines.length}>{applying ? "Updating…" : "Update stock"}</Button></>}>
        {!invoice ? (
          <FileDrop onFile={read} busy={reading} accept="image/*,application/pdf" label="Drop a photo of a paper invoice" hint="or click to choose · JPG, PNG or PDF" />
        ) : (
          <>
            <img src={invoice.photo} alt="Invoice photo" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 6, marginBottom: 12, display: "block" }} />
            <Muted>{invoice.supplier}{invoice.invoiceNumber ? ` · ${invoice.invoiceNumber}` : ""} · check the lines, then update stock.</Muted>
            <Table
              columns={[
                { key: "name", label: "Item", editable: true },
                { key: "quantity", label: "Qty", type: "number", editable: true, width: 80 },
                { key: "unit", label: "Unit", width: 70 },
                { key: "match", label: "", width: 120, render: (l: any) => { const m = match(l.name); return m ? <Badge tone="blue">{`${m.quantity ?? 0} → ${(m.quantity ?? 0) + l.quantity}`}</Badge> : <Badge tone="gray">New item</Badge>; } },
              ]}
              rows={invoice.lines}
              onEdit={(r, key, value) => setInvoice({ ...invoice, lines: invoice.lines.map((l) => (l.id === r.id ? { ...l, [key]: key === "quantity" ? Number(value) : value } : l)) })}
              onDelete={(r) => setInvoice({ ...invoice, lines: invoice.lines.filter((l) => l.id !== r.id) })}
            />
          </>
        )}
      </Modal>
    </Page>
  );
}
