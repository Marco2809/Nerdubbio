import { useState } from "react";
import { Play } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Trailer YouTube con cambio trailer e link diretto (prima nella pagina del titolo). */
export function TrailerSection({ trailers }: { trailers: { key: string; name: string }[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  // Alcuni trailer YouTube sono bloccati per regione o non embeddabili e
  // l'iframe non ce lo può dire: diamo all'utente il cambio trailer e il
  // link diretto a YouTube (la pagina watch spesso funziona comunque).
  const [idx, setIdx] = useState(0);
  const current = trailers[idx % trailers.length]!;
  return (
    <section className="mt-4">
      {open ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-glow">
          <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
            <iframe
              key={current.key}
              src={`https://www.youtube-nocookie.com/embed/${current.key}?autoplay=1&rel=0`}
              title={t("media.trailer")}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              {t("media.hideTrailer")}
            </button>
            {trailers.length > 1 && (
              <button
                type="button"
                onClick={() => setIdx((i) => i + 1)}
                className="flex-1 border-l border-border py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                {t("media.otherTrailer")} ({(idx % trailers.length) + 1}/{trailers.length})
              </button>
            )}
            <a
              href={`https://www.youtube.com/watch?v=${current.key}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 border-l border-border py-2 text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              {t("media.openYoutube")}
            </a>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-hero py-3 text-sm font-bold text-primary-foreground shadow-glow-pink"
        >
          <Play className="h-4 w-4 fill-current" /> {t("media.watchTrailer")}
        </button>
      )}
    </section>
  );
}
