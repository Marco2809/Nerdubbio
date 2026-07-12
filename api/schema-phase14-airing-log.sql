-- ============================================================
-- Nerdubbio – Fase 14: log anti-duplicato per le push "esce oggi"
-- ============================================================

USE nerdubbio;

CREATE TABLE IF NOT EXISTS push_airing_log (
  user_id    CHAR(36)     NOT NULL,
  media_key  VARCHAR(64)  NOT NULL,
  air_date   DATE         NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, media_key, air_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
