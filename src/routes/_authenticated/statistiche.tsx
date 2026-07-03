import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { useUserStore, computeStats } from "@/lib/user-store";
import { libraryApi, type WatchStats } from "@/lib/php/library-client";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Clock, Flame, Star, Tv, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/statistiche")({
  head: () => ({ meta: [{ title: "Statistiche — Nerdubbio" }] }),
  component: StatistichePage,
});

function StatistichePage() {
  const { state } = useUserStore();
  const stats = computeStats(state);

  const watchStats = useQuery({
    queryKey: ["library", "watch-stats"],
    queryFn: () => libraryApi.getWatchStats(),
    staleTime: 1000 * 60 * 5,
  });

  const ws = watchStats.data;
  const maxMonth = Math.max(1, ...(ws?.byMonth.map(m => m.episodes) ?? [1]));

  return (
    <AppShell subtitle="Il tuo binge in numeri" title="Statistiche">
      <div className="grid grid-cols-2 gap-2">
        <BigStat icon={<Tv className="h-5 w-5" />} label="Episodi visti" value={ws?.totalEpisodes ?? stats.episodes} />
        <BigStat icon={<Clock className="h-5 w-5" />} label="Ore stimate" value={ws?.hoursEstimate ?? stats.hours} />
        <BigStat icon={<Star className="h-5 w-5" />} label="Serie" value={stats.series} />
        <BigStat icon={<Flame className="h-5 w-5" />} label="Streak" value={`${state.streak}g`} />
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Episodi per mese</h2>
        </div>
        {watchStats.isLoading && (
          <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">Carico grafico…</div>
        )}
        {!watchStats.isLoading && (ws?.byMonth.length ?? 0) === 0 && (
          <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">
            Nessuna data di visione ancora. Reimporta da TV Time per sbloccare il grafico mensile e il wrapped.
          </div>
        )}
        {ws && ws.byMonth.length > 0 && (
          <div className="glass space-y-2 rounded-2xl p-4">
            {ws.byMonth.slice(-12).map(m => (
              <div key={m.month} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-[10px] font-semibold text-muted-foreground">{formatMonth(m.month)}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-hero"
                    style={{ width: `${(m.episodes / maxMonth) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-xs font-bold">{m.episodes}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Serie più binge-ate</h2>
        </div>
        {watchStats.isLoading && (
          <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">Carico classifica…</div>
        )}
        {ws && ws.topShows.length === 0 && !watchStats.isLoading && (
          <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">Segna qualche episodio per vedere la classifica.</div>
        )}
        {ws && ws.topShows.length > 0 && (
          <div className="space-y-2">
            {ws.topShows.map((s, i) => {
              const m = /^(tv|movie)-(\d+)$/.exec(s.mediaKey);
              const inner = (
                <div className="glass flex items-center gap-3 rounded-2xl p-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-surface-2 text-sm font-black text-accent">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{s.title}</p>
                    <p className="text-[11px] text-muted-foreground">{s.episodes} episodi</p>
                  </div>
                </div>
              );
              if (m) {
                return (
                  <Link key={s.mediaKey} to="/media/$type/$id" params={{ type: m[1] as "tv" | "movie", id: m[2] }}>
                    {inner}
                  </Link>
                );
              }
              return <div key={s.mediaKey}>{inner}</div>;
            })}
          </div>
        )}
      </section>

      <div className="mt-6 grid grid-cols-3 gap-2 text-center">
        <MiniStat label="Film" value={stats.movies} />
        <MiniStat label="Preferiti" value={stats.favorites} />
        <MiniStat label="In corso" value={stats.watching} />
      </div>
    </AppShell>
  );
}

function formatMonth(ym: string): string {
  const [y, mo] = ym.split("-");
  const names = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
  return `${names[Number(mo) - 1] ?? mo} '${y?.slice(2)}`;
}

function BigStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <span className="text-accent">{icon}</span>
      <p className="mt-2 text-2xl font-extrabold text-gradient">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-2xl px-2 py-3">
      <p className="text-lg font-extrabold">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
