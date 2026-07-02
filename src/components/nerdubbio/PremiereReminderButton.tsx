import { useEffect, useState } from "react";
import { Bell, BellRing, CalendarPlus, Check } from "lucide-react";
import { toast } from "sonner";
import {
  addReminder,
  downloadIcs,
  hasReminder,
  removeReminder,
  requestNotificationPermission,
  type Reminder,
} from "@/lib/reminders";

type Props = {
  id: string;         // stable reminder id
  tmdbId: number;
  title: string;      // series title
  label: string;      // e.g. "S3 · E1 — Premiere di stagione"
  airDate: string;    // YYYY-MM-DD (must be today or future)
  href: string;
};

export function PremiereReminderButton({ id, tmdbId, title, label, airDate, href }: Props) {
  const [active, setActive] = useState(false);

  useEffect(() => { setActive(hasReminder(id)); }, [id]);

  const build = (): Reminder => ({
    id, tmdbId, title, label, airDate, href,
    createdAt: new Date().toISOString(),
  });

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (active) {
      removeReminder(id);
      setActive(false);
      toast.message("Promemoria rimosso", { description: `${title} — ${label}` });
      return;
    }
    const perm = await requestNotificationPermission();
    addReminder(build());
    setActive(true);
    const desc = `Ti avviso il ${airDate}`;
    if (perm === "granted") {
      toast.success("Promemoria attivo 🔔", { description: `${desc} con notifica.` });
    } else if (perm === "denied") {
      toast.success("Promemoria salvato", {
        description: `${desc}. Notifiche disattivate: aggiungilo al calendario per non dimenticarlo.`,
        action: { label: "Calendario", onClick: () => downloadIcs(build()) },
      });
    } else {
      toast.success("Promemoria salvato", { description: desc });
    }
  }

  function ics(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    downloadIcs(build());
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={active}
        className={
          active
            ? "inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-3 py-1 text-[11px] font-semibold text-fuchsia-200 shadow-[0_0_18px_rgba(236,72,153,0.35)]"
            : "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-foreground/90 hover:bg-white/[0.08]"
        }
      >
        {active ? <><Check className="h-3.5 w-3.5" /> <BellRing className="h-3.5 w-3.5" /> Ti ricordo</>
                : <><Bell className="h-3.5 w-3.5" /> Ricordamelo</>}
      </button>
      <button
        type="button"
        onClick={ics}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-foreground/80 hover:bg-white/[0.08]"
        aria-label="Aggiungi al calendario (.ics)"
      >
        <CalendarPlus className="h-3.5 w-3.5" /> Calendario
      </button>
    </div>
  );
}
