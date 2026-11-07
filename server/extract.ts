// Stretch B: ai.extract(file, instructions) for generated apps. One Claude vision call reads a photo or PDF and
// returns JSON shaped as the app's instructions describe. The app's current records go along, so a line like
// "San Marzano tomatoes" comes back as the existing "Tomatoes".
import { MODEL, client, logUsage, textOf } from "./claude";
import { getApp, listRecords } from "./db";

const MOCK = process.env.BOS_MOCK === "1";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/** Demo-only canned result: the paper invoice in fixtures/invoice-photo.png. */
const MOCK_RESULT = {
  supplier: "Adriatic Fresh Produce",
  invoiceNumber: "AFP-2291",
  date: "2026-11-08",
  lines: [
    { name: "Tomatoes", quantity: 8, unit: "kg" },
    { name: "Lemons", quantity: 4, unit: "kg" },
    { name: "Garlic", quantity: 2, unit: "kg" },
    { name: "Zucchini", quantity: 5, unit: "kg" },
  ],
};

function parseJson(text: string) {
  const t = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try {
    return JSON.parse(t);
  } catch {
    const start = t.search(/[[{]/);
    const end = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if (start < 0 || end <= start) throw new Error("The reply wasn't JSON");
    return JSON.parse(t.slice(start, end + 1));
  }
}

export async function extract(input: { file?: string; mediaType?: string; instructions?: string; app?: string }) {
  const { file = "", mediaType = "image/jpeg", instructions = "", app: slug = "" } = input;
  if (!file) throw new Error("No file");
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 2200));
    return MOCK_RESULT;
  }
  const app = getApp(slug);
  const records: Record<string, string[]> = {};
  for (const c of app?.schema ?? []) {
    records[c.name] = listRecords(slug, c.name)
      .slice(0, 80)
      .map((r: any) => String(r.name ?? r.title ?? ""))
      .filter(Boolean);
  }
  const doc =
    mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: file } }
      : { type: "image", source: { type: "base64", media_type: IMAGE_TYPES.includes(mediaType) ? mediaType : "image/jpeg", data: file } };
  const msg: any = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          doc,
          {
            type: "text",
            text: `Read this document for the "${app?.name ?? slug}" app.

<instructions>
${instructions}
</instructions>

<existing_records>
${JSON.stringify(records)}
</existing_records>

When a line clearly refers to an existing record (a different wording, brand or language for the same thing), use that record's exact name. Otherwise keep the document's wording, cleaned up. If the same item appears on several lines, return it once with the quantities added up. Quantities are plain numbers in the record's unit where the document makes that clear.

Reply with only the JSON the instructions describe. No prose, no code fences.`,
          },
        ],
      },
    ],
  } as any);
  logUsage("extract", msg);
  return parseJson(textOf(msg.content));
}
