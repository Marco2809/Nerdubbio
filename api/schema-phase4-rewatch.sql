-- ============================================================
-- Nerdubbio – contatore rivisioni episodi/film
--   mysql -u root -p nerdubbio < api/schema-phase4-rewatch.sql
-- ============================================================

USE nerdubbio;

ALTER TABLE user_episodes
  ADD COLUMN watch_count INT NOT NULL DEFAULT 1 AFTER watched_at;

ALTER TABLE user_media
  ADD COLUMN watch_count INT NOT NULL DEFAULT 0 AFTER last_watched_at;
