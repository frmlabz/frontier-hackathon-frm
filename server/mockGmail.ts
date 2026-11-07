// Fake Gmail behind the tool shapes a real Gmail integration would expose. Swap this file for the real API later.
import { getEmail, isProcessed, listEmails } from "./db";

const STOP = new Set(["or", "and", "in", "from", "subject", "is", "unread", "the", "a"]);

export function gmailSearch(query: string, max = 10) {
  // Lenient: Gmail operators (subject:, from:, newer_than:) are reduced to their values; any term may match.
  const terms = String(query ?? "")
    .toLowerCase()
    .replace(/\b(newer_than|older_than|after|before|label|has|is|in):\S+/g, " ")
    .replace(/\b\w+:/g, " ")
    .split(/[^a-z0-9@.#\-]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP.has(t));
  const n = Math.max(1, Math.min(10, Number(max) || 10));
  return listEmails()
    .filter((e) => !isProcessed(e.id))
    .filter((e) => {
      if (!terms.length) return true;
      const hay = `${e.fromName} ${e.fromAddr} ${e.subject} ${e.body}`.toLowerCase();
      return terms.some((t) => hay.includes(t));
    })
    .slice(0, n)
    .map((e) => ({
      id: e.id,
      from: `${e.fromName} <${e.fromAddr}>`,
      subject: e.subject,
      date: new Date(e.receivedAt).toISOString(),
      snippet: e.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140),
    }));
}

export function gmailRead(id: string) {
  const e = getEmail(id);
  if (!e) return null;
  return { id: e.id, from: `${e.fromName} <${e.fromAddr}>`, subject: e.subject, date: new Date(e.receivedAt).toISOString(), body: e.body };
}
