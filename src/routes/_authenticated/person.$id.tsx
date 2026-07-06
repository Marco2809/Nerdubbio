import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { tmdbPerson } from "@/lib/tmdb/tmdb.functions";
import { Loader2, Calendar, MapPin } from "lucide-react";
import { useState } from "react";
import { OverlayBackButton } from "@/components/nerdubbio/OverlayBackButton";
import { useReturnPath, useSmartBack } from "@/lib/media-nav";
import { localeToBcp47, useI18n, pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/person/$id")({
  head: () => ({ meta: [{ title: pageTitle("person") }] }),
  component: PersonPage,
});

function PersonPage() {
  const { t, locale } = useI18n();
  const { id } = Route.useParams();
  const goBack = useSmartBack("/app");
  const returnPath = useReturnPath();
  const personId = Number(id);

  const q = useQuery({
    queryKey: ["tmdb", "person", personId],
    queryFn: () => tmdbPerson({ data: { personId } }),
    enabled: Number.isFinite(personId) && personId > 0,
    staleTime: 1000 * 60 * 60,
  });

  if (q.isLoading) {
    return <PersonPageSkeleton onBack={goBack} />;
  }
  if (q.error || !q.data) {
    return (
      <div className="min-h-screen px-safe pt-safe pb-32">
        <OverlayBackButton onClick={goBack} className="!relative !left-0 !top-0 mb-6" />
        <p className="text-center text-destructive">{t("person.loadError")}</p>
      </div>
    );
  }
  const p = q.data.person;
  const bcp47 = localeToBcp47(locale);

  return (
    <div className="min-h-screen pb-32">
      <header className="relative px-safe pb-2">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-primary/15 to-transparent"
        />
        <OverlayBackButton onClick={goBack} />
        <div className="relative z-10 flex gap-4 pt-14">
          <ProfilePhoto url={p.profileUrl} name={p.name} />
          <div className="min-w-0 flex flex-col justify-end pb-1">
            <h1 className="text-2xl font-extrabold leading-tight">{p.name}</h1>
            {p.knownFor && (
              <p className="mt-0.5 text-xs uppercase tracking-widest text-accent">{p.knownFor}</p>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-5 px-safe">
        <div className="space-y-1 text-xs text-muted-foreground">
          {p.birthday && (
            <p className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> {t("person.born", { date: formatDate(p.birthday, bcp47) })}
              {p.deathday && t("person.died", { date: formatDate(p.deathday, bcp47) })}
            </p>
          )}
          {p.placeOfBirth && (
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> {p.placeOfBirth}
            </p>
          )}
        </div>

        {p.biography && <Biography text={p.biography} />}

        {p.credits.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">{t("person.filmography")}</h2>
            <div className="grid grid-cols-3 gap-3">
              {p.credits.map((c) => (
                <Link
                  key={`${c.type}-${c.id}`}
                  to="/media/$type/$id"
                  params={{ type: c.type, id: `${c.type}-${c.id}` }}
                  state={{ from: returnPath }}
                  className="group"
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-surface-2">
                    {c.posterUrl ? (
                      <img
                        src={c.posterUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-tight">{c.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {c.year || "—"} · {c.type === "tv" ? t("person.typeTv") : t("person.typeMovie")}
                  </p>
                  {c.character && (
                    <p className="line-clamp-1 text-[10px] text-accent">{c.character}</p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ProfilePhoto({ url, name }: { url?: string | null; name: string }) {
  return (
    <div className="relative h-36 w-28 shrink-0 overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-xl ring-2 ring-background">
      {url ? (
        <img src={url} alt={name} className="h-full w-full object-cover object-top" decoding="async" />
      ) : (
        <div className="grid h-full w-full place-items-center text-3xl text-muted-foreground">
          {name.charAt(0)}
        </div>
      )}
    </div>
  );
}

function PersonPageSkeleton({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();

  return (
    <div className="min-h-screen pb-32">
      <header className="relative px-safe pb-2">
        <OverlayBackButton onClick={onBack} />
        <div className="relative z-10 flex gap-4 pt-14">
          <div className="h-36 w-28 shrink-0 animate-pulse rounded-2xl bg-surface-2 ring-2 ring-background" />
          <div className="flex min-w-0 flex-1 flex-col justify-end gap-2 pb-1">
            <div className="h-7 w-4/5 max-w-[220px] animate-pulse rounded-lg bg-surface-2" />
            <div className="h-3 w-1/2 max-w-[140px] animate-pulse rounded bg-surface-2" />
          </div>
        </div>
        <p className="relative z-10 mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
          {t("person.loading")}
        </p>
      </header>
      <div className="mx-auto mt-6 max-w-md space-y-4 px-safe">
        <div className="h-3 w-2/3 animate-pulse rounded bg-surface-2" />
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-surface-2" />
          <div className="h-3 w-full animate-pulse rounded bg-surface-2" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-surface-2" />
        </div>
      </div>
    </div>
  );
}

function Biography({ text }: { text: string }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 320;
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("person.biography")}</p>
      <p className={`mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/90 ${!expanded && long ? "line-clamp-6" : ""}`}>
        {text}
      </p>
      {long && (
        <button onClick={() => setExpanded((v) => !v)} className="mt-1 text-xs font-semibold text-accent">
          {expanded ? t("person.readLess") : t("person.readMore")}
        </button>
      )}
    </div>
  );
}

function formatDate(iso: string, bcp47: string): string {
  try {
    return new Date(iso).toLocaleDateString(bcp47, { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}
