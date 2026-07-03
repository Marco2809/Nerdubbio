import { Link } from "@tanstack/react-router";

export type StatusTab = { id: string; label: string; count?: number };

export function StatusTabs({
  tabs,
  active,
  buildTo,
}: {
  tabs: StatusTab[];
  active: string;
  buildTo: (tabId: string) => { to: string; search?: Record<string, string> };
}) {
  return (
    <div className="-mx-4 overflow-x-auto scrollbar-none">
      <div className="flex gap-2 px-4 pb-1">
        {tabs.map(t => {
          const dest = buildTo(t.id);
          const isActive = t.id === active;
          return (
            <Link
              key={t.id}
              to={dest.to as never}
              search={dest.search as never}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? "bg-hero text-primary-foreground shadow-glow"
                  : "bg-surface-2 text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {t.count != null ? ` (${t.count})` : ""}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
