// @bos/sdk — data access for generated apps. The app is identified by its iframe URL: /apps/:slug/
import { useEffect, useRef, useState } from "react";

export type Rec = { id: string; createdAt: number; updatedAt: number };

const slug = () => location.pathname.split("/")[2] ?? "";
const base = (coll: string) => `/api/apps/${slug()}/${encodeURIComponent(coll)}`;

const listeners = new Set<(coll: string) => void>();
const notify = (coll: string) => listeners.forEach((l) => l(coll));

// The shell forwards records.changed into the iframe as {type:"bos:records", collection}.
if (typeof window !== "undefined") {
  window.addEventListener("message", (e) => {
    if (e.origin !== location.origin) return;
    if (e.data?.type === "bos:records") notify(e.data.collection);
  });
}

async function req(method: string, url: string, body?: any) {
  const r = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status}`);
  return r.status === 204 ? null : r.json();
}

export const db = {
  list: <T = any>(coll: string): Promise<(T & Rec)[]> => req("GET", base(coll)),
  insert: async <T = any>(coll: string, data: T, id?: string): Promise<T & Rec> => {
    const r = await req("POST", base(coll), { data, id });
    notify(coll);
    return r;
  },
  update: async <T = any>(coll: string, id: string, patch: Partial<T>): Promise<T & Rec> => {
    const r = await req("PATCH", `${base(coll)}/${encodeURIComponent(id)}`, { patch });
    notify(coll);
    return r;
  },
  remove: async (coll: string, id: string): Promise<void> => {
    await req("DELETE", `${base(coll)}/${encodeURIComponent(id)}`);
    notify(coll);
  },
};

/** Live list of records in a collection. Refetches whenever the collection changes (locally or from the server). */
export function useCollection<T = any>(name: string): { items: (T & Rec)[]; loading: boolean } {
  const [items, setItems] = useState<(T & Rec)[]>([]);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  useEffect(() => {
    let alive = true;
    const load = () => {
      const n = ++seq.current;
      db.list<T>(name)
        .then((rows) => alive && n === seq.current && setItems(rows))
        .catch(() => {})
        .finally(() => alive && setLoading(false));
    };
    load();
    const l = (c: string) => (c === name || c === "*") && load();
    listeners.add(l);
    return () => {
      alive = false;
      listeners.delete(l);
    };
  }, [name]);
  return { items, loading };
}

/** Reads a file with Claude vision and returns structured JSON following the instructions. */
export const ai = {
  extract: async (file: File, instructions: string): Promise<any> => {
    const data = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(",")[1] ?? "");
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
    return req("POST", "/api/ai/extract", { file: data, mediaType: file.type || "image/jpeg", instructions, app: slug() });
  },
};
