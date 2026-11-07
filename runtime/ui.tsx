// @bos/ui — Notion-style component kit for generated apps. Visual styling lives in runtime/ui.css.
// The region between @api-start and @api-end is pasted verbatim into the builder prompt.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// @api-start
export type Tone = "gray" | "blue" | "green" | "yellow" | "orange" | "red" | "purple" | "pink" | "brown";

/** width defaults to "wide" (Notion full-page database width). */
export type PageProps = { children: ReactNode; width?: "normal" | "wide" | "full" };
export type HeaderProps = { emoji?: string; title: string; subtitle?: string; actions?: ReactNode };
export type SectionProps = { title?: string; subtitle?: string; actions?: ReactNode; children: ReactNode };
export type CardProps = { title?: string; subtitle?: string; actions?: ReactNode; children?: ReactNode; padded?: boolean; onClick?: () => void };
export type GridProps = { cols?: 1 | 2 | 3 | 4; children: ReactNode };
export type RowProps = { children: ReactNode; align?: "start" | "center" | "end"; justify?: "start" | "between" | "end"; wrap?: boolean };
export type StatProps = { label: string; value: ReactNode; hint?: string; tone?: Tone; emoji?: string };

export type Column<T> = {
  key: string;                 // field name in the row
  label: string;
  type?: "text" | "number" | "date" | "boolean";
  unit?: string;               // shown after numbers, e.g. "kg"
  editable?: boolean;          // inline edit (needs Table.onEdit)
  options?: string[];          // editable text column becomes a dropdown
  width?: number;              // px
  align?: "left" | "right" | "center";
  render?: (row: T) => ReactNode;   // custom cell content (not editable)
  sortable?: boolean;          // default true
};
export type TableProps<T extends { id: string }> = {
  columns: Column<T>[];
  rows: T[];
  onEdit?: (row: T, key: string, value: any) => void;   // value is number for number columns, boolean for boolean
  onDelete?: (row: T) => void;                            // shows a trash button on hover
  onRowClick?: (row: T) => void;
  rowTone?: (row: T) => Tone | undefined;                 // tints the row, e.g. "red" for low stock
  defaultSort?: { key: string; dir: "asc" | "desc" };
  loading?: boolean;
  emptyText?: string;
};

export type ButtonProps = {
  children?: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md"; icon?: string /* emoji or symbol */; disabled?: boolean; type?: "button" | "submit"; title?: string;
};
export type InputProps = {
  value: string | number; onChange: (value: string) => void; label?: string; type?: "text" | "number" | "date" | "search" | "email" | "time";
  placeholder?: string; unit?: string; autoFocus?: boolean; onEnter?: () => void; width?: number;
};
export type TextareaProps = { value: string; onChange: (value: string) => void; label?: string; placeholder?: string; rows?: number };
export type SelectProps = { value: string; onChange: (value: string) => void; options: (string | { value: string; label: string })[]; label?: string; placeholder?: string; width?: number };
export type CheckboxProps = { checked: boolean; onChange: (checked: boolean) => void; label?: string };
export type FormRowProps = { children: ReactNode; onSubmit?: () => void };  // inputs side by side, wraps on small screens

export type BadgeProps = { children: ReactNode; tone?: Tone; dot?: boolean };
export type TabsProps = { tabs: { id: string; label: string; count?: number; emoji?: string }[]; value: string; onChange: (id: string) => void };
export type ModalProps = { open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode; side?: boolean /* drawer from the right */ };
export type ProgressProps = { value: number; max?: number; tone?: Tone; label?: string; showValue?: boolean };
export type AvatarProps = { name: string; emoji?: string; color?: string; size?: number };
export type EmptyStateProps = { emoji?: string; title: string; description?: string; action?: ReactNode };
export type KanbanProps<T extends { id: string }> = {
  columns: { id: string; title: string; tone?: Tone }[];
  items: T[];
  columnOf: (item: T) => string;                 // which column id the item is in
  renderCard: (item: T) => ReactNode;
  onMove?: (item: T, columnId: string) => void;  // drag & drop between columns
};
export type FileDropProps = { onFile: (file: File) => void; accept?: string; label?: string; hint?: string; busy?: boolean };

// Components (all named exports from "@bos/ui"):
// Page, Header, Section, Card, Grid, Row, Stat, Table, Button, Input, Textarea, Select, Checkbox, FormRow,
// Badge, Tabs, Modal, Progress, Avatar, EmptyState, Kanban, FileDrop, Spinner, Divider, Muted
// toast(message: string, tone?: "success" | "error" | "info"): void   — small notification bottom-right
// formatMoney(n: number, currency = "EUR"): string;  formatDate(ts: number | string): string;  timeAgo(ts: number): string
// @api-end

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ---------- formatting ----------
export function formatMoney(n: number, currency = "EUR") {
  if (n == null || isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(n));
}
export function formatDate(ts: number | string) {
  if (ts == null || ts === "") return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
export function timeAgo(ts: number) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
const fmtNum = (v: any) => {
  const n = Number(v);
  if (v === "" || v == null || isNaN(n)) return v ?? "";
  return Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

// ---------- layout ----------
export function Page({ children, width = "wide" }: PageProps) {
  return <div className={cx("bos-page", width === "wide" && "bos-page-wide", width === "full" && "bos-page-full")}>{children}</div>;
}
export function Header({ emoji, title, subtitle, actions }: HeaderProps) {
  return (
    <div className="bos-header">
      <div className="bos-header-main">
        {emoji && <div className="bos-header-emoji">{emoji}</div>}
        <div>
          <h1 className="bos-h1">{title}</h1>
          {subtitle && <p className="bos-header-sub">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="bos-header-actions">{actions}</div>}
    </div>
  );
}
export function Section({ title, subtitle, actions, children }: SectionProps) {
  return (
    <section className="bos-section">
      {(title || actions) && (
        <div className="bos-section-head">
          <div>
            {title && <h2 className="bos-h2">{title}</h2>}
            {subtitle && <p className="bos-muted">{subtitle}</p>}
          </div>
          {actions && <div className="bos-row">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
export function Card({ title, subtitle, actions, children, padded = true, onClick }: CardProps) {
  return (
    <div className={cx("bos-card", onClick && "bos-card-click")} onClick={onClick}>
      {(title || actions) && (
        <div className="bos-card-head">
          <div>
            {title && <div className="bos-card-title">{title}</div>}
            {subtitle && <div className="bos-muted bos-small">{subtitle}</div>}
          </div>
          {actions && <div className="bos-row">{actions}</div>}
        </div>
      )}
      {children != null && <div className={cx(padded && "bos-card-body")}>{children}</div>}
    </div>
  );
}
export function Grid({ cols = 3, children }: GridProps) {
  return <div className={`bos-grid bos-grid-${cols}`}>{children}</div>;
}
export function Row({ children, align = "center", justify = "start", wrap = true }: RowProps) {
  return (
    <div className="bos-row" style={{ alignItems: align === "start" ? "flex-start" : align === "end" ? "flex-end" : "center", justifyContent: justify === "between" ? "space-between" : justify === "end" ? "flex-end" : "flex-start", flexWrap: wrap ? "wrap" : "nowrap" }}>
      {children}
    </div>
  );
}
export const Divider = () => <hr className="bos-divider" />;
export const Muted = ({ children }: { children: ReactNode }) => <span className="bos-muted">{children}</span>;
export const Spinner = ({ size = 14 }: { size?: number }) => <span className="bos-spinner" style={{ width: size, height: size }} />;

export function Stat({ label, value, hint, tone, emoji }: StatProps) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1400);
      return () => clearTimeout(t);
    }
  }, [value]);
  return (
    <div className={cx("bos-stat", tone && `bos-tone-${tone}`)}>
      <div className="bos-stat-label">{emoji && <span>{emoji}</span>}{label}</div>
      <div className={cx("bos-stat-value", flash && "bos-flash-text")}>{value}</div>
      {hint && <div className="bos-stat-hint">{hint}</div>}
    </div>
  );
}

// ---------- table ----------
function CellEditor({ col, value, onDone }: { col: Column<any>; value: any; onDone: (v: any, commit: boolean) => void }) {
  const [v, setV] = useState(value ?? "");
  const ref = useRef<HTMLInputElement & HTMLSelectElement>(null);
  useEffect(() => {
    ref.current?.focus();
    if (ref.current && "select" in ref.current && col.type !== "date") (ref.current as HTMLInputElement).select?.();
  }, []);
  const commit = () => onDone(col.type === "number" ? (v === "" ? null : Number(v)) : v, true);
  if (col.options)
    return (
      <select ref={ref} className="bos-cell-input" value={v} onChange={(e) => onDone(e.target.value, true)} onBlur={() => onDone(v, false)}>
        {col.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  return (
    <input
      ref={ref}
      className={cx("bos-cell-input", col.type === "number" && "bos-num")}
      type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
      value={v}
      step="any"
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onDone(value, false);
      }}
    />
  );
}

export function Table<T extends { id: string }>({ columns, rows, onEdit, onDelete, onRowClick, rowTone, defaultSort, loading, emptyText }: TableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | undefined>(defaultSort);
  const [editing, setEditing] = useState<{ id: string; key: string } | null>(null);
  const prev = useRef(new Map<string, any>());
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const mounted = useRef(false);

  // Flash cells whose value changed (live updates from AI employees are visible this way).
  useEffect(() => {
    const changed: string[] = [];
    for (const r of rows as any[]) {
      for (const c of columns) {
        const k = `${r.id}:${c.key}`;
        const val = JSON.stringify(r[c.key]);
        if (mounted.current && prev.current.has(k) && prev.current.get(k) !== val) changed.push(k);
        if (mounted.current && !prev.current.has(`${r.id}:__row`)) changed.push(`${r.id}:__row`);
        prev.current.set(k, val);
      }
      prev.current.set(`${r.id}:__row`, 1);
    }
    mounted.current = rows.length > 0 || mounted.current;
    if (changed.length) {
      setFlash((s) => new Set([...s, ...changed]));
      const t = setTimeout(() => setFlash((s) => { const n = new Set(s); changed.forEach((c) => n.delete(c)); return n; }), 1800);
      return () => clearTimeout(t);
    }
  }, [rows]);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    const m = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a: any, b: any) => {
      const x = a[sort.key], y = b[sort.key];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      if (col?.type === "number" || (typeof x === "number" && typeof y === "number")) return (Number(x) - Number(y)) * m;
      return String(x).localeCompare(String(y)) * m;
    });
  }, [rows, sort, columns]);

  const clickHead = (c: Column<T>) => {
    if (c.sortable === false || c.render) return;
    setSort((s) => (s?.key !== c.key ? { key: c.key, dir: "asc" } : s.dir === "asc" ? { key: c.key, dir: "desc" } : undefined));
  };

  const renderValue = (c: Column<T>, r: any) => {
    if (c.render) return c.render(r);
    const v = r[c.key];
    if (c.type === "boolean") return <input type="checkbox" className="bos-check" checked={!!v} onChange={(e) => onEdit?.(r, c.key, e.target.checked)} disabled={!onEdit || c.editable === false} onClick={(e) => e.stopPropagation()} />;
    if (v === null || v === undefined || v === "") return <span className="bos-faint">{c.editable && onEdit ? "Empty" : "—"}</span>;
    if (c.type === "number") return <>{fmtNum(v)}{c.unit && <span className="bos-unit"> {c.unit}</span>}</>;
    if (c.type === "date") return formatDate(v);
    return String(v);
  };

  return (
    <div className="bos-table-wrap">
      <table className="bos-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width, textAlign: c.align ?? (c.type === "number" ? "right" : "left") }} onClick={() => clickHead(c)} className={cx(c.sortable !== false && !c.render && "bos-th-sort")}>
                {c.label}
                {sort?.key === c.key && <span className="bos-sort">{sort.dir === "asc" ? "↑" : "↓"}</span>}
              </th>
            ))}
            {onDelete && <th style={{ width: 36 }} />}
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 &&
            [0, 1, 2].map((i) => (
              <tr key={`sk${i}`}>
                {columns.map((c) => <td key={c.key}><div className="bos-skeleton" /></td>)}
                {onDelete && <td />}
              </tr>
            ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + (onDelete ? 1 : 0)} className="bos-table-empty">{emptyText ?? "No rows yet"}</td>
            </tr>
          )}
          {sorted.map((r: any) => {
            const tone = rowTone?.(r);
            return (
              <tr key={r.id} className={cx(tone && `bos-row-${tone}`, onRowClick && "bos-tr-click", flash.has(`${r.id}:__row`) && "bos-row-new")} onClick={() => onRowClick?.(r)}>
                {columns.map((c) => {
                  const isEdit = editing?.id === r.id && editing?.key === c.key;
                  const canEdit = !!onEdit && c.editable && !c.render && c.type !== "boolean";
                  return (
                    <td
                      key={c.key}
                      style={{ textAlign: c.align ?? (c.type === "number" ? "right" : "left") }}
                      className={cx(canEdit && "bos-td-edit", isEdit && "bos-td-editing", flash.has(`${r.id}:${c.key}`) && "bos-flash", c.type === "number" && "bos-num")}
                      onClick={(e) => {
                        if (canEdit && !isEdit) { e.stopPropagation(); setEditing({ id: r.id, key: c.key }); }
                      }}
                    >
                      {isEdit ? (
                        <CellEditor col={c} value={r[c.key]} onDone={(v, commit) => { setEditing(null); if (commit && v !== r[c.key]) onEdit!(r, c.key, v); }} />
                      ) : renderValue(c, r)}
                    </td>
                  );
                })}
                {onDelete && (
                  <td className="bos-td-actions">
                    <button className="bos-icon-btn" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(r); }}>🗑</button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------- controls ----------
export function Button({ children, onClick, variant = "secondary", size = "md", icon, disabled, type = "button", title }: ButtonProps) {
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick} className={cx("bos-btn", `bos-btn-${variant}`, size === "sm" && "bos-btn-sm", !children && "bos-btn-icon")}>
      {icon && <span className="bos-btn-ico">{icon}</span>}
      {children}
    </button>
  );
}
export function Input({ value, onChange, label, type = "text", placeholder, unit, autoFocus, onEnter, width }: InputProps) {
  const el = (
    <div className="bos-input-wrap" style={{ width }}>
      {type === "search" && <span className="bos-input-ico">⌕</span>}
      <input
        className={cx("bos-input", type === "search" && "bos-input-search", unit && "bos-input-unit")}
        type={type === "search" ? "text" : type}
        value={value ?? ""}
        placeholder={placeholder}
        autoFocus={autoFocus}
        step={type === "number" ? "any" : undefined}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
      />
      {unit && <span className="bos-input-suffix">{unit}</span>}
    </div>
  );
  return label ? <label className="bos-field"><span className="bos-label">{label}</span>{el}</label> : el;
}
export function Textarea({ value, onChange, label, placeholder, rows = 3 }: TextareaProps) {
  const el = <textarea className="bos-input bos-textarea" rows={rows} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
  return label ? <label className="bos-field"><span className="bos-label">{label}</span>{el}</label> : el;
}
export function Select({ value, onChange, options, label, placeholder, width }: SelectProps) {
  const el = (
    <select className="bos-input bos-select" style={{ width }} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
  return label ? <label className="bos-field"><span className="bos-label">{label}</span>{el}</label> : el;
}
export function Checkbox({ checked, onChange, label }: CheckboxProps) {
  return (
    <label className="bos-checkbox">
      <input type="checkbox" className="bos-check" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      {label && <span>{label}</span>}
    </label>
  );
}
export function FormRow({ children, onSubmit }: FormRowProps) {
  return (
    <form className="bos-formrow" onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }}>
      {children}
    </form>
  );
}

// ---------- display ----------
export function Badge({ children, tone = "gray", dot }: BadgeProps) {
  return <span className={cx("bos-badge", `bos-badge-${tone}`)}>{dot && <span className="bos-badge-dot" />}{children}</span>;
}
export function Tabs({ tabs, value, onChange }: TabsProps) {
  return (
    <div className="bos-tabs">
      {tabs.map((t) => (
        <button key={t.id} className={cx("bos-tab", value === t.id && "bos-tab-active")} onClick={() => onChange(t.id)}>
          {t.emoji && <span>{t.emoji}</span>}
          {t.label}
          {t.count != null && <span className="bos-tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function Modal({ open, onClose, title, children, footer, side }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className={cx("bos-overlay", side && "bos-overlay-side")} onMouseDown={onClose}>
      <div className={cx("bos-modal", side && "bos-drawer")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="bos-modal-head">
          <div className="bos-card-title">{title}</div>
          <button className="bos-icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="bos-modal-body">{children}</div>
        {footer && <div className="bos-modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
export function Progress({ value, max = 100, tone = "blue", label, showValue }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, (Number(value) / (max || 1)) * 100));
  return (
    <div className="bos-progress-wrap">
      {(label || showValue) && (
        <div className="bos-progress-label">
          <span>{label}</span>
          {showValue && <span className="bos-muted">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className="bos-progress"><div className={`bos-progress-bar bos-bg-${tone}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
const AV_COLORS = ["#dd5b00", "#2a9d99", "#1aae39", "#62aef0", "#ff64c8", "#9b6bd6", "#0075de", "#523410"];
export function Avatar({ name, emoji, color, size = 28 }: AvatarProps) {
  const c = color ?? AV_COLORS[[...(name || "?")].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AV_COLORS.length];
  const initials = (name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className="bos-avatar" title={name} style={{ width: size, height: size, fontSize: size * 0.42, background: emoji ? `${c}22` : c, color: emoji ? undefined : "#fff" }}>
      {emoji ?? initials}
    </span>
  );
}
export function EmptyState({ emoji = "📭", title, description, action }: EmptyStateProps) {
  return (
    <div className="bos-empty">
      <div className="bos-empty-emoji">{emoji}</div>
      <div className="bos-empty-title">{title}</div>
      {description && <div className="bos-muted">{description}</div>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}
export function Kanban<T extends { id: string }>({ columns, items, columnOf, renderCard, onMove }: KanbanProps<T>) {
  const [over, setOver] = useState<string | null>(null);
  const drag = useRef<T | null>(null);
  return (
    <div className="bos-kanban">
      {columns.map((col) => {
        const list = items.filter((i) => columnOf(i) === col.id);
        return (
          <div
            key={col.id}
            className={cx("bos-kanban-col", over === col.id && "bos-kanban-over")}
            onDragOver={(e) => { e.preventDefault(); setOver(col.id); }}
            onDragLeave={() => setOver(null)}
            onDrop={() => { setOver(null); if (drag.current && columnOf(drag.current) !== col.id) onMove?.(drag.current, col.id); drag.current = null; }}
          >
            <div className="bos-kanban-head">
              <Badge tone={col.tone ?? "gray"} dot>{col.title}</Badge>
              <span className="bos-faint">{list.length}</span>
            </div>
            {list.map((i) => (
              <div key={i.id} className="bos-kanban-card" draggable={!!onMove} onDragStart={() => (drag.current = i)}>
                {renderCard(i)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
export function FileDrop({ onFile, accept = "image/*,application/pdf", label = "Drop a file here", hint = "or click to choose", busy }: FileDropProps) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      className={cx("bos-filedrop", over && "bos-filedrop-over", busy && "bos-filedrop-busy")}
      onClick={() => !busy && input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f && !busy) onFile(f); }}
    >
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      {busy ? <><Spinner size={18} /><div className="bos-filedrop-label">Reading…</div></> : <><div className="bos-filedrop-ico">📄</div><div className="bos-filedrop-label">{label}</div><div className="bos-muted bos-small">{hint}</div></>}
    </div>
  );
}

// ---------- toast ----------
type ToastItem = { id: number; message: string; tone: "success" | "error" | "info" };
let pushToast: ((t: ToastItem) => void) | null = null;
let toastSeq = 0;
export function toast(message: string, tone: "success" | "error" | "info" = "success") {
  pushToast?.({ id: ++toastSeq, message, tone });
}
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    pushToast = (t) => {
      setItems((s) => [...s, t]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), 3200);
    };
    return () => { pushToast = null; };
  }, []);
  return (
    <div className="bos-toasts">
      {items.map((t) => (
        <div key={t.id} className={`bos-toast bos-toast-${t.tone}`}>
          <span>{t.tone === "success" ? "✓" : t.tone === "error" ? "!" : "i"}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
