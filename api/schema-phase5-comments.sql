-- ============================================================
-- Nerdubbio – commenti community su titoli (film/serie)
--   mysql -u root -p nerdubbio < api/schema-phase5-comments.sql
-- ============================================================

USE nerdubbio;

CREATE TABLE IF NOT EXISTS media_comments (
  id          CHAR(36)     NOT NULL,
  user_id     CHAR(36)     NOT NULL,
  media_type  ENUM('tv','movie') NOT NULL,
  tmdb_id     INT          NOT NULL,
  season      INT          DEFAULT NULL,
  episode     INT          DEFAULT NULL,
  parent_id   CHAR(36)     DEFAULT NULL,
  body        TEXT         NOT NULL,
  spoiler     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at  DATETIME     DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_comments_media (media_type, tmdb_id, season, episode, created_at),
  KEY idx_comments_user (user_id, created_at),
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
