import type { CSSProperties } from "react";
import { motifSvg } from "./motifs";
import type { RecapScene } from "@/lib/php/recap-client";

const GOLD = "#e0a52e";
const CREAM = "#f2efe4";
const DIM = "#aeb6a4";

const wrap: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "54px 26px",
  textAlign: "center",
};

function Motif({ name, size = "62%", faint = false }: { name: string; size?: string; faint?: boolean }) {
  return (
    <div
      style={{ width: size, aspectRatio: "1 / 1", opacity: faint ? 0.12 : 1 }}
      dangerouslySetInnerHTML={{ __html: motifSvg(name) }}
    />
  );
}

function Initial({ name, size = 64 }: { name: string; size?: number }) {
  return (
    <span
      style={{
        width: size, height: size, borderRadius: "50%", flex: "none",
        display: "grid", placeItems: "center", background: "#1c2a1a",
        border: `2px solid ${GOLD}`, color: CREAM, fontSize: size * 0.4, fontWeight: 600,
      }}
    >
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

// Foto reale dell'attore (TMDB) quando disponibile, altrimenti iniziale.
function Avatar({ name, photo, size = 64 }: { name: string; photo?: string; size?: number }) {
  if (!photo) return <Initial name={name} size={size} />;
  return (
    <img
      src={photo}
      alt={name}
      loading="eager"
      style={{
        width: size, height: size, borderRadius: "50%", flex: "none",
        objectFit: "cover", background: "#1c2a1a", border: `2px solid ${GOLD}`,
      }}
    />
  );
}

const chip: CSSProperties = {
  display: "inline-block", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase",
  fontWeight: 600, color: "#0d0f0c", background: GOLD, padding: "5px 12px", borderRadius: 20,
};
const kicker: CSSProperties = {
  color: GOLD, fontSize: 11, letterSpacing: ".22em", textTransform: "uppercase", fontWeight: 600,
};

export function SceneView({
  scene,
  photoFor,
}: {
  scene: RecapScene;
  photoFor?: (name: string) => string | undefined;
}) {
  const photo = (name: string) => photoFor?.(name);
  const layout = scene.layout ?? "motif";
  const title = scene.title ?? scene.label ?? "";
  const subtitle = scene.subtitle ?? scene.caption ?? "";
  const chars = scene.characters ?? [];
  const pop = (delay = 0): CSSProperties => ({ animation: `rb-up .6s ease ${delay}s both` });

  if (layout === "hero") {
    return (
      <div style={wrap}>
        {scene.motif && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <Motif name={scene.motif} size="80%" faint />
          </div>
        )}
        <div style={{ position: "relative", ...pop() }}>
          <div style={kicker}>Nerdubbio · Recap</div>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 34, fontWeight: 600, color: CREAM, margin: "12px 0 0", lineHeight: 1.1 }}>
            {title}
          </h1>
          {subtitle && <p style={{ color: DIM, fontSize: 14, marginTop: 10 }}>{subtitle}</p>}
        </div>
      </div>
    );
  }

  if (layout === "character-card") {
    const name = chars[0]?.name || title;
    const note = chars[0]?.note || subtitle;
    return (
      <div style={wrap}>
        <div style={pop()}><Avatar name={name} photo={photo(name)} size={84} /></div>
        <h2 style={{ color: CREAM, fontSize: 22, fontWeight: 600, margin: "16px 0 0", ...pop(0.08) }}>{name}</h2>
        {note && <p style={{ color: DIM, fontSize: 14, marginTop: 8, maxWidth: 260, ...pop(0.16) }}>{note}</p>}
      </div>
    );
  }

  if (layout === "quote") {
    const text = scene.quote?.text || subtitle;
    const speaker = scene.quote?.speaker;
    return (
      <div style={wrap}>
        <div style={{ color: GOLD, fontFamily: "Georgia, serif", fontSize: 64, lineHeight: 0.6, height: 30, ...pop() }}>“</div>
        <blockquote style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 21, color: CREAM, lineHeight: 1.4, margin: "8px 0 0", ...pop(0.1) }}>
          {text}
        </blockquote>
        {speaker && <p style={{ color: GOLD, fontSize: 13, fontWeight: 600, marginTop: 14, ...pop(0.2) }}>— {speaker}</p>}
        {title && <p style={{ color: DIM, fontSize: 11, marginTop: 6 }}>{title}</p>}
      </div>
    );
  }

  if (layout === "timeline") {
    const items = scene.items ?? (subtitle ? [subtitle] : []);
    return (
      <div style={{ ...wrap, alignItems: "stretch", textAlign: "left" }}>
        <h2 style={{ color: CREAM, fontSize: 18, fontWeight: 600, marginBottom: 16, textAlign: "center" }}>{title}</h2>
        <div style={{ position: "relative", paddingLeft: 22 }}>
          <div style={{ position: "absolute", left: 5, top: 4, bottom: 4, width: 2, background: "#3a4a33" }} />
          {items.map((it, i) => (
            <div key={i} style={{ position: "relative", marginBottom: 14, ...pop(i * 0.1) }}>
              <span style={{ position: "absolute", left: -21, top: 4, width: 12, height: 12, borderRadius: "50%", background: GOLD, border: "2px solid #0c0e0b" }} />
              <p style={{ color: CREAM, fontSize: 14, lineHeight: 1.4 }}>{it}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (layout === "big-reveal") {
    return (
      <div style={wrap}>
        {scene.motif && <div style={pop()}><Motif name={scene.motif} size="52%" /></div>}
        <div style={{ ...chip, background: "#c0392b", color: CREAM, marginTop: 14, ...pop(0.1) }}>{title}</div>
        {subtitle && <p style={{ color: CREAM, fontSize: 17, fontWeight: 500, marginTop: 14, lineHeight: 1.4, ...pop(0.2) }}>{subtitle}</p>}
      </div>
    );
  }

  if (layout === "stat") {
    const stats = scene.stats ?? [];
    return (
      <div style={wrap}>
        <h2 style={{ color: CREAM, fontSize: 16, fontWeight: 600, marginBottom: 20 }}>{title}</h2>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center" }}>
          {stats.map((s, i) => (
            <div key={i} style={{ minWidth: 72, ...pop(i * 0.12) }}>
              <div style={{ color: GOLD, fontSize: 40, fontWeight: 700, lineHeight: 1 }}>{s.value}</div>
              <div style={{ color: DIM, fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (layout === "map") {
    return (
      <div style={wrap}>
        <div style={pop()}><Motif name={scene.motif || "map"} size="58%" /></div>
        <div style={{ ...chip, marginTop: 12, ...pop(0.1) }}>{title}</div>
        {subtitle && <p style={{ color: DIM, fontSize: 14, marginTop: 12, maxWidth: 260, ...pop(0.2) }}>{subtitle}</p>}
      </div>
    );
  }

  if (layout === "relationship-graph") {
    const a = chars[0]?.name || title;
    const b = chars[1]?.name || "";
    return (
      <div style={wrap}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, ...pop() }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <Avatar name={a} photo={photo(a)} size={60} />
            <span style={{ color: CREAM, fontSize: 13, fontWeight: 600, maxWidth: 80 }}>{a}</span>
          </div>
          <span style={{ flex: 1, height: 2, minWidth: 34, background: GOLD }} />
          {b && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <Avatar name={b} photo={photo(b)} size={60} />
              <span style={{ color: CREAM, fontSize: 13, fontWeight: 600, maxWidth: 80 }}>{b}</span>
            </div>
          )}
        </div>
        {subtitle && <p style={{ color: DIM, fontSize: 14, marginTop: 18, maxWidth: 260, ...pop(0.15) }}>{subtitle}</p>}
      </div>
    );
  }

  if (layout === "split-screen") {
    const a = chars[0];
    const b = chars[1];
    if (a && b) {
      return (
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          {[a, b].map((c, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "54px 14px", gap: 10, background: i === 0 ? "#151d13" : "#1d1513", ...pop(i * 0.12) }}>
              <Avatar name={c.name} photo={photo(c.name)} size={58} />
              <span style={{ color: CREAM, fontSize: 14, fontWeight: 600 }}>{c.name}</span>
              {c.note && <span style={{ color: DIM, fontSize: 12, lineHeight: 1.35 }}>{c.note}</span>}
            </div>
          ))}
        </div>
      );
    }
    return (
      <div style={wrap}>
        <h2 style={{ color: CREAM, fontSize: 20, fontWeight: 600, ...pop() }}>{title}</h2>
        {subtitle && <p style={{ color: DIM, fontSize: 14, marginTop: 10, ...pop(0.1) }}>{subtitle}</p>}
      </div>
    );
  }

  if (layout === "ending") {
    return (
      <div style={wrap}>
        <div style={{ ...kicker, ...pop() }}>Fine</div>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 600, color: CREAM, margin: "12px 0 0", lineHeight: 1.2, ...pop(0.1) }}>{title}</h1>
        {subtitle && <p style={{ color: DIM, fontSize: 14, marginTop: 10, maxWidth: 260, ...pop(0.2) }}>{subtitle}</p>}
      </div>
    );
  }

  // default: motif
  return (
    <div style={wrap}>
      <Motif name={scene.motif || "person"} size="72%" />
      <div style={{ position: "absolute", left: 22, right: 22, bottom: 44, textAlign: "center" }}>
        {title && <div style={{ ...chip, marginBottom: 12 }}>{title}</div>}
        {subtitle && (
          <p style={{ color: CREAM, fontSize: 16.5, lineHeight: 1.5, fontWeight: 500, textShadow: "0 2px 12px rgba(0,0,0,.85)" }}>{subtitle}</p>
        )}
      </div>
    </div>
  );
}
