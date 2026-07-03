/** Decorazioni sfondo landing — griglia retro + glow arcade. */
export function LandingBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.85 0.22 175 / 0.9) 1px, transparent 1px), linear-gradient(90deg, oklch(0.85 0.22 175 / 0.9) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-primary/20 blur-[100px]" />
      <div className="absolute -right-24 top-40 h-80 w-80 rounded-full bg-accent/15 blur-[110px]" />
      <div className="absolute bottom-0 left-1/2 h-64 w-[120%] -translate-x-1/2 bg-gradient-to-t from-background via-transparent to-transparent" />
      {/* scanlines leggere */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, #fff 2px, #fff 3px)",
        }}
      />
    </div>
  );
}

/** Barra stat stile HUD da RPG. */
export function NerdHudStrip({ labels }: { labels: { lvl: string; eps: string; streak: string } }) {
  return (
    <div className="mx-auto mt-8 flex max-w-md flex-wrap justify-center gap-2 font-mono text-[10px] uppercase tracking-widest">
      {[
        { k: "LVL", v: "??", hint: labels.lvl },
        { k: "EP", v: "∞", hint: labels.eps },
        { k: "STRK", v: "🔥", hint: labels.streak },
      ].map((s) => (
        <div
          key={s.k}
          className="flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-surface/80 px-3 py-1.5 shadow-[inset_0_0_12px_oklch(0.85_0.22_175_/_0.08)]"
          title={s.hint}
        >
          <span className="text-cyan-300/80">{s.k}</span>
          <span className="font-bold text-foreground">{s.v}</span>
        </div>
      ))}
    </div>
  );
}

/** Pill tag nerd sotto l'hero. */
export function NerdTags({ tags }: { tags: string[] }) {
  return (
    <div className="mt-6 flex flex-wrap justify-center gap-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary-foreground/90"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
