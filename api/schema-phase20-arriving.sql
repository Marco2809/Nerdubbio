-- ============================================================
-- Nerdubbio – Fase 20: in arrivo
-- ============================================================
-- Cosa deve ancora uscire di un titolo in lista (stagione o serie nuova, film),
-- con data e dove: da TMDB, ogni notte (scripts/ita-cron.php). JSON in media_kind.

USE nerdubbio;

ALTER TABLE media_kind
  ADD COLUMN IF NOT EXISTS arriving TEXT DEFAULT NULL AFTER kind;
