type Props = {
  /** Sezione completa (About/Crediti) o compatta per footer. */
  compact?: boolean;
  className?: string;
};

/** Attribuzione TMDB richiesta dai termini d'uso API. */
export function TmdbAttribution({ compact = false, className = "" }: Props) {
  const notice =
    "This product uses the TMDB API but is not endorsed or certified by TMDB.";

  if (compact) {
    return (
      <div className={`flex flex-col items-center gap-2 text-center ${className}`}>
        <img
          src="/tmdb-logo.svg"
          alt="TMDB"
          width={273}
          height={36}
          className="h-5 w-auto max-w-[140px] opacity-90"
          decoding="async"
        />
        <p className="max-w-md text-[10px] leading-relaxed text-muted-foreground">{notice}</p>
      </div>
    );
  }

  return (
    <section id="crediti" className={`glass rounded-2xl p-4 ${className}`}>
      <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Crediti</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <img
          src="/tmdb-logo.svg"
          alt="The Movie Database (TMDB)"
          width={273}
          height={36}
          className="h-6 w-auto max-w-[160px] shrink-0 opacity-95"
          decoding="async"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">{notice}</p>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground/80">
        Metadati, poster e immagini forniti da{" "}
        <a
          href="https://www.themoviedb.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline-offset-2 hover:underline"
        >
          The Movie Database
        </a>
        .
      </p>
    </section>
  );
}
