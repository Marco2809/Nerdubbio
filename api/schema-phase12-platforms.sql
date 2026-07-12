-- ============================================================
-- Nerdubbio – Fase 12: piattaforme streaming dell'utente
--   mysql -u root -p nerdubbio < api/schema-phase12-platforms.sql
-- ============================================================

USE nerdubbio;

ALTER TABLE user_stats
  ADD COLUMN IF NOT EXISTS platforms JSON DEFAULT NULL AFTER mood_profile;
