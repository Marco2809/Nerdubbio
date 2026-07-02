import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { useUserStore, computeStats } from "@/lib/user-store";
import { Trophy, Flame, Star, Settings2, Crown, Users, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profilo — Nerdubbio" }] }),
  component: Profile,
});

const BADGES = [
  { code: "primo-dubbio", title: "Primo Dubbio Risolto", icon: "🧞" },
  { code: "serial-watcher", title: "Serial Watcher", icon: "📺" },
  { code: "binge-warrior", title: "Binge Warrior", icon: "⚔️" },
  { code: "plot-twist", title: "Plot Twist Survivor", icon: "🌀" },
  { code: "sci-fi", title: "Sci-Fi Addicted", icon: "🛸" },
  { code: "comfort", title: "Comfort Zone Breaker", icon: "💥" },
];

function Profile() {
  const { state } = useUserStore();
  const stats = computeStats(state);
  const xpToNext = 400;

  return (
    <AppShell subtitle="Il tuo nerd" title="Profilo"
      right={<Link to="/settings" className="grid h-9 w-9 place-items-center rounded-full glass"><Settings2 className="h-4 w-4"/></Link>}>
      <div className="glass rounded-3xl p-5">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-hero text-2xl font-black text-primary-foreground shadow-glow-pink">N</div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">Nerd Anonimo</p>
            <p className="text-xs text-muted-foreground">Livello {state.level} · {state.xp} XP</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-hero" style={{ width: `${(state.xp % xpToNext) / xpToNext * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        <Stat icon={<Star className="h-4 w-4"/>} label="Visti" value={stats.completed} />
        <Stat icon={<Flame className="h-4 w-4"/>} label="Streak" value={state.streak} />
        <Stat icon={<Trophy className="h-4 w-4"/>} label="Badge" value={state.achievements.length} />
        <Stat icon={<Star className="h-4 w-4"/>} label="Ore" value={Math.round(stats.completed*8)} />
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">Achievements</h2>
        <div className="grid grid-cols-3 gap-2">
          {BADGES.map(b => {
            const unlocked = state.achievements.includes(b.code);
            return (
              <div key={b.code} className={`glass rounded-2xl p-3 text-center ${unlocked ? "shadow-glow" : "opacity-40"}`}>
                <div className="text-2xl">{b.icon}</div>
                <p className="mt-1 text-[10px] font-semibold leading-tight">{b.title}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-6 space-y-2">
        <Link to="/premium" className="glass flex items-center gap-3 rounded-2xl p-4">
          <Crown className="h-5 w-5 text-accent" />
          <div className="flex-1"><p className="text-sm font-semibold">Passa a Premium</p><p className="text-xs text-muted-foreground">Dubbio illimitato, AI avanzata, temi</p></div>
        </Link>
        <Link to="/gruppo" className="glass flex items-center gap-3 rounded-2xl p-4">
          <Users className="h-5 w-5 text-accent" />
          <div className="flex-1"><p className="text-sm font-semibold">Dubbio di gruppo</p><p className="text-xs text-muted-foreground">Decidete insieme cosa vedere</p></div>
        </Link>
        <Link to="/import" className="glass flex items-center gap-3 rounded-2xl p-4">
          <Download className="h-5 w-5 text-accent" />
          <div className="flex-1"><p className="text-sm font-semibold">Arrivi da TV Time?</p><p className="text-xs text-muted-foreground">Importa la tua cronologia</p></div>
        </Link>
      </section>
    </AppShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="glass rounded-2xl px-1 py-3">
      <div className="flex justify-center text-accent">{icon}</div>
      <p className="mt-1 text-lg font-extrabold">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
