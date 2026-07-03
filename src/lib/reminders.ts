/** Local premiere/episode reminders — client-side only.
 *  Uses Notification API when available and falls back to a toast.
 *  Reminders are persisted in localStorage; scheduleAll() re-arms setTimeout
 *  on app load so tabs kept open still fire at the right time.
 */
import { toast } from "@/lib/toast";

const KEY = "nerdubbio:reminders:v1";
const FIRED_KEY = "nerdubbio:reminders:fired:v1";

export interface Reminder {
  id: string;             // stable id: `${tmdbId}:S${s}E${e}`
  tmdbId: number;
  title: string;          // series title
  label: string;          // e.g. "S3 · E1 — Premiere di stagione"
  airDate: string;        // YYYY-MM-DD
  href: string;           // in-app link (e.g. /media/tv/12345)
  createdAt: string;
}

function read<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function write(k: string, v: unknown) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
}

export function getReminders(): Reminder[] { return read<Reminder[]>(KEY, []); }
export function hasReminder(id: string): boolean { return getReminders().some(r => r.id === id); }

export function addReminder(r: Reminder) {
  const list = getReminders().filter(x => x.id !== r.id);
  list.push(r);
  write(KEY, list);
  scheduleOne(r);
}
export function removeReminder(id: string) {
  write(KEY, getReminders().filter(r => r.id !== id));
}

/** Fires the notification/toast for a reminder if not already fired. */
function fire(r: Reminder) {
  const fired = read<string[]>(FIRED_KEY, []);
  if (fired.includes(r.id)) return;
  write(FIRED_KEY, [...fired, r.id]);

  const body = `${r.label} — oggi è il giorno!`;
  const open = () => { try { window.focus(); } catch { /* ignore */ } window.location.href = r.href; };
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      const n = new Notification(`📺 ${r.title}`, { body, tag: r.id });
      n.onclick = () => { open(); };
      return;
    } catch { /* fall through to toast */ }
  }
  toast.info(`📺 ${r.title}`, {
    description: body,
    action: { label: "Apri episodio", onClick: open },
  });
}

/** When to fire: at the airDate local 09:00. Past-due → fire immediately (once). */
function fireAtMs(r: Reminder): number {
  const [y, m, d] = r.airDate.split("-").map(Number);
  if (!y || !m || !d) return Date.now();
  return new Date(y, m - 1, d, 9, 0, 0, 0).getTime();
}

function scheduleOne(r: Reminder) {
  if (typeof window === "undefined") return;
  const fired = read<string[]>(FIRED_KEY, []);
  if (fired.includes(r.id)) return;
  const delay = fireAtMs(r) - Date.now();
  if (delay <= 0) { fire(r); return; }
  // setTimeout max is ~24.8 days; only arm reminders within that window.
  if (delay < 1000 * 60 * 60 * 24 * 20) {
    window.setTimeout(() => fire(r), delay);
  }
}

/** Called once on app mount. Purges old reminders and arms upcoming ones. */
export function scheduleAllReminders() {
  if (typeof window === "undefined") return;
  const list = getReminders();
  // Purge reminders older than 30 days past airDate
  const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 30;
  const kept = list.filter(r => fireAtMs(r) > cutoff);
  if (kept.length !== list.length) write(KEY, kept);
  kept.forEach(scheduleOne);
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  try { return await Notification.requestPermission(); } catch { return "denied"; }
}

/** .ics fallback so users on iOS Safari (no web push) can save the date. */
export function downloadIcs(r: Reminder) {
  const [y, m, d] = r.airDate.split("-").map(Number);
  const dt = `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
  const uid = `${r.id}@nerdubbio`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nerdubbio//Reminders//IT",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dt}T090000Z`,
    `DTSTART;VALUE=DATE:${dt}`,
    `SUMMARY:${escapeIcs(`${r.title} — ${r.label}`)}`,
    `DESCRIPTION:${escapeIcs(`Promemoria Nerdubbio: ${r.title} ${r.label}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${r.title.replace(/[^\w-]+/g, "_")}-${r.airDate}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
