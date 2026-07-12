-- ============================================================
-- Nerdubbio – Fase 13: web push + reminder server-side
--   mysql -u root -p nerdubbio < api/schema-phase13-push.sql
-- ============================================================

USE nerdubbio;

-- Coppia di chiavi VAPID: generata una sola volta dal backend al primo uso.
CREATE TABLE IF NOT EXISTS push_vapid (
  id              TINYINT      NOT NULL PRIMARY KEY,
  public_key      TEXT         NOT NULL,
  private_key_pem TEXT         NOT NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id             INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id        CHAR(36)      NOT NULL,
  endpoint_hash  CHAR(64)      NOT NULL,
  endpoint       TEXT          NOT NULL,
  p256dh         VARCHAR(255)  NOT NULL,
  auth           VARCHAR(64)   NOT NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_endpoint (endpoint_hash),
  KEY idx_push_user (user_id),
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reminder premiere/episodi salvati anche lato server (il cron li notifica).
CREATE TABLE IF NOT EXISTS user_reminders (
  id           INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id      CHAR(36)      NOT NULL,
  item_id      VARCHAR(64)   NOT NULL,
  tmdb_id      INT           NOT NULL,
  title        VARCHAR(255)  NOT NULL,
  label        VARCHAR(120)  NOT NULL DEFAULT '',
  air_date     DATE          NOT NULL,
  href         VARCHAR(255)  NOT NULL DEFAULT '',
  notified_at  DATETIME      DEFAULT NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_item (user_id, item_id),
  KEY idx_rem_air (air_date),
  CONSTRAINT fk_rem_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
