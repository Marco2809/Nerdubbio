-- ============================================================
-- Nerdubbio – Fase 3: coda import TV Time non matchati
--   mysql -u root nerdubbio < api/schema-phase3-import-pending.sql
-- ============================================================

USE nerdubbio;

ALTER TABLE user_stats
  ADD COLUMN import_pending JSON DEFAULT NULL;
