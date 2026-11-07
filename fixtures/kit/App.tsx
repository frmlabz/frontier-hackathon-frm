// UI kit showcase: every @bos/ui component with local state. Served at /dev/kit/frame for QA.
import { useState } from "react";
import {
  Page, Header, Section, Card, Grid, Row, Stat, Table, Button, Input, Textarea, Select, Checkbox, FormRow,
  Badge, Tabs, Modal, Progress, Avatar, EmptyState, Kanban, FileDrop, Spinner, Divider, Muted, toast, formatMoney, formatDate,
  type Column,
} from "@bos/ui";

type Row = { id: string; name: string; qty: number; unit: string; ok: boolean; when: string };
type Task = { id: string; title: string; col: string };

export default function App() {
  const [rows, setRows] = useState<Row[]>([
    { id: "1", name: "Tomatoes", qty: 4, unit: "kg", ok: false, when: "2026-11-05" },
    { id: "2", name: "Olive oil", qty: 12, unit: "l", ok: true, when: "2026-11-02" },
    { id: "3", name: "Feta", qty: 2, unit: "kg", ok: false, when: "2026-11-06" },
  ]);
  const [tab, setTab] = useState("a");
  const [text, setText] = useState("");
  const [num, setNum] = useState("3");
  const [sel, setSel] = useState("");
  const [chk, setChk] = useState(true);
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([
    { id: "t1", title: "Order flour", col: "todo" },
    { id: "t2", title: "Clean walk-in", col: "doing" },
    { id: "t3", title: "Fix oven door", col: "done" },
  ]);
  const cols: Column<Row>[] = [
    { key: "name", label: "Item", editable: true },
    { key: "qty", label: "Qty", type: "number", unit: "kg", editable: true, width: 100 },
    { key: "unit", label: "Unit", editable: true, options: ["kg", "l", "pcs"], width: 90 },
    { key: "ok", label: "OK", type: "boolean", editable: true, width: 70 },
    { key: "when", label: "Delivered", type: "date", width: 130 },
  ];
  return (
    <Page>
      <Header emoji="🧩" title="UI kit" subtitle="Every component generated apps can use." actions={<Button variant="primary" icon="+" onClick={() => toast("Saved", "success")}>Primary</Button>} />
      <Grid cols={4}>
        <Stat label="Revenue" value={formatMoney(1234.5)} emoji="💶" hint="This week" />
        <Stat label="Low stock" value={2} tone="red" emoji="⚠️" />
        <Stat label="Orders" value={18} tone="green" />
        <Stat label="Updated" value={formatDate(Date.now())} />
      </Grid>
      <Section title="Table" subtitle="Sort, inline edit, delete, row tone" actions={<Button size="sm" onClick={() => setRows((r) => [...r, { id: String(Date.now()), name: "New item", qty: 1, unit: "pcs", ok: true, when: "2026-11-07" }])}>Add row</Button>}>
        <Table
          columns={cols}
          rows={rows}
          rowTone={(r) => (r.ok ? undefined : "red")}
          onEdit={(r, k, v) => setRows((all) => all.map((x) => (x.id === r.id ? { ...x, [k]: v } : x)))}
          onDelete={(r) => setRows((all) => all.filter((x) => x.id !== r.id))}
        />
      </Section>
      <Section title="Loading & empty">
        <Grid cols={2}>
          <Table columns={cols} rows={[]} loading />
          <EmptyState emoji="📭" title="Nothing here yet" description="Add the first item to get started." action={<Button>Add item</Button>} />
        </Grid>
      </Section>
      <Section title="Inputs">
        <FormRow onSubmit={() => toast("Submitted")}>
          <Input label="Name" value={text} onChange={setText} placeholder="Type…" />
          <Input label="Amount" type="number" value={num} onChange={setNum} unit="kg" width={140} />
          <Select label="Supplier" value={sel} onChange={setSel} options={["Adriatic Fresh", "Mlin", "Novak"]} placeholder="Pick one" />
        </FormRow>
        <Textarea label="Notes" value={text} onChange={setText} rows={2} />
        <Row>
          <Checkbox checked={chk} onChange={setChk} label="Notify me" />
          <Input type="search" value={text} onChange={setText} placeholder="Search" width={200} />
        </Row>
      </Section>
      <Section title="Buttons, badges, avatars">
        <Row wrap>
          <Button variant="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Delete</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm" icon="↻">Small</Button>
          <Spinner />
        </Row>
        <Row wrap>
          {(["gray", "blue", "green", "yellow", "orange", "red", "purple", "pink", "brown"] as const).map((t) => (
            <Badge key={t} tone={t} dot>{t}</Badge>
          ))}
        </Row>
        <Row>
          <Avatar name="Ana Petrović" />
          <Avatar name="Luka" emoji="👨‍🍳" color="#d9730d" />
          <Avatar name="Mila" size={40} />
          <Muted>Avatars with initials or emoji</Muted>
        </Row>
      </Section>
      <Section title="Tabs & progress">
        <Tabs tabs={[{ id: "a", label: "All", count: 12 }, { id: "b", label: "Low", count: 2, emoji: "⚠️" }, { id: "c", label: "Archived" }]} value={tab} onChange={setTab} />
        <Grid cols={2}>
          <Progress value={4} max={10} tone="red" label="Tomatoes" showValue />
          <Progress value={80} tone="green" label="Prep done" showValue />
        </Grid>
      </Section>
      <Section title="Cards">
        <Grid cols={3}>
          <Card title="Plain card" subtitle="With a subtitle">Body text inside a card.</Card>
          <Card title="Clickable" onClick={() => toast("Card clicked", "info")}>Click me</Card>
          <Card title="With actions" actions={<Button size="sm" variant="ghost">Edit</Button>}><Muted>Muted helper text</Muted></Card>
        </Grid>
      </Section>
      <Section title="Kanban">
        <Kanban
          columns={[{ id: "todo", title: "To do", tone: "gray" }, { id: "doing", title: "Doing", tone: "blue" }, { id: "done", title: "Done", tone: "green" }]}
          items={tasks}
          columnOf={(t) => t.col}
          renderCard={(t) => <div>{t.title}</div>}
          onMove={(t, col) => setTasks((all) => all.map((x) => (x.id === t.id ? { ...x, col } : x)))}
        />
      </Section>
      <Section title="Overlays & files">
        <Row>
          <Button onClick={() => setModal(true)}>Open modal</Button>
          <Button onClick={() => setDrawer(true)}>Open drawer</Button>
          <Button onClick={() => toast("Something failed", "error")}>Error toast</Button>
        </Row>
        <Divider />
        <FileDrop onFile={(f) => toast(`Got ${f.name}`)} label="Drop an invoice" hint="PDF or image" />
      </Section>
      <Modal open={modal} onClose={() => setModal(false)} title="Add ingredient" footer={<><Button onClick={() => setModal(false)}>Cancel</Button><Button variant="primary" onClick={() => setModal(false)}>Save</Button></>}>
        <Input label="Name" value={text} onChange={setText} autoFocus />
      </Modal>
      <Modal open={drawer} onClose={() => setDrawer(false)} title="Details" side>
        <Muted>A drawer slides in from the right.</Muted>
      </Modal>
    </Page>
  );
}
