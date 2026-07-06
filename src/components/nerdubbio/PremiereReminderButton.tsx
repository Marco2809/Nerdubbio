import { useEffect, useState } from "react";
import { Bell, BellRing, CalendarPlus, Check } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  addReminder,
  downloadIcs,
  hasReminder,
  removeReminder,
  requestNotificationPermission,
  type Reminder,
} from "@/lib/reminders";
import { useI18n } from "@/lib/i18n";

type Props = {
  id: string;
  tmdbId: number;
  title: string;
  label: string;
  airDate: string;
  href: string;
};

export function PremiereReminderButton({ id, tmdbId, title, label, airDate, href }: Props) {
  const { t } = useI18n();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(hasReminder(id));
  }, [id]);

  const build = (): Reminder => ({
    id,
    tmdbId,
    title,
    label,
    airDate,
    href,
    createdAt: new Date().toISOString(),
  });

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (active) {
      removeReminder(id);
      setActive(false);
      toast.message(t("reminder.removed"), { description: `${title} — ${label}` });
      return;
    }
    const perm = await requestNotificationPermission();
    addReminder(build());
    setActive(true);
    const dateLabel = t("reminder.notifyOn", { date: airDate });
    if (perm === "granted") {
      toast.success(t("reminder.active"), {
        description: t("reminder.activeWithNotify", { date: airDate }),
      });
    } else if (perm === "denied") {
      toast.success(t("reminder.saved"), {
        description: t("reminder.savedNoNotify", { date: airDate }),
        action: { label: t("reminder.calendar"), onClick: () => downloadIcs(build()) },
      });
    } else {
      toast.success(t("reminder.saved"), { description: dateLabel });
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
        {active ? (
          <>
            <Check className="h-3.5 w-3.5" /> <BellRing className="h-3.5 w-3.5" /> {t("reminder.activeLabel")}
          </>
        ) : (
          <>
            <Bell className="h-3.5 w-3.5" /> {t("reminder.remindMe")}
          </>
        )}
      </button>
      <button
        type="button"
        onClick={ics}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-foreground/80 hover:bg-white/[0.08]"
        aria-label={t("reminder.calendarAria")}
      >
        <CalendarPlus className="h-3.5 w-3.5" /> {t("reminder.calendar")}
      </button>
    </div>
  );
}
