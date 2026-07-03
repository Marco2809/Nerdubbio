export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <title>Ops — Nerdubbio</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0a0a0f" />
    <style>
      * { box-sizing: border-box; }
      body {
        font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif;
        background: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(168,85,247,0.25), transparent),
          #0a0a0f;
        color: #f4f4f5;
        display: grid;
        place-items: center;
        min-height: 100vh;
        margin: 0;
        padding: 1.5rem;
      }
      .card {
        max-width: 22rem;
        width: 100%;
        text-align: center;
        padding: 2rem 1.5rem;
        border-radius: 1.5rem;
        background: rgba(24,24,32,0.85);
        border: 1px solid rgba(255,255,255,0.08);
        box-shadow: 0 0 40px rgba(168,85,247,0.15);
      }
      .icon {
        width: 3.5rem;
        height: 3.5rem;
        margin: 0 auto 1rem;
        border-radius: 1rem;
        background: linear-gradient(135deg, #a855f7, #ec4899);
        display: grid;
        place-items: center;
        font-size: 1.75rem;
      }
      h1 { font-size: 1.25rem; font-weight: 800; margin: 0 0 0.5rem; }
      p { color: #a1a1aa; margin: 0 0 1.5rem; font-size: 0.9rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button {
        padding: 0.625rem 1.125rem;
        border-radius: 9999px;
        font: inherit;
        font-weight: 700;
        font-size: 0.8125rem;
        cursor: pointer;
        text-decoration: none;
        border: 1px solid transparent;
      }
      .primary {
        background: linear-gradient(135deg, #a855f7, #ec4899);
        color: #fff;
        box-shadow: 0 0 20px rgba(236,72,153,0.35);
      }
      .secondary {
        background: rgba(255,255,255,0.06);
        color: #e4e4e7;
        border-color: rgba(255,255,255,0.12);
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon" aria-hidden="true">🎲</div>
      <h1>Qualcosa non ha caricato</h1>
      <p>Il Nerdacolo ha inciampato su un dado critico. Riprova o torna alla home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Riprova</button>
        <a class="secondary" href="/app">Vai alla home</a>
      </div>
    </div>
  </body>
</html>`;
}
