-- ============================================================
-- Nerdubbio – Fase 17: Nerdacolo di gruppo con votazione
-- ============================================================
-- Chi lancia il Nerdacolo in modalità gruppo manda i migliori candidati al
-- gruppo; ogni membro vota 👍/👎 dal proprio telefono.

USE nerdubbio;

CREATE TABLE IF NOT EXISTS nerdacolo_vote_sessions (
  id          CHAR(36)    NOT NULL,
  group_id    CHAR(36)    NOT NULL,
  created_by  CHAR(36)    NOT NULL,
  candidates  MEDIUMTEXT  NOT NULL,
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME    NOT NULL,
  PRIMARY KEY (id),
  KEY idx_nvs_group (group_id, created_at),
  CONSTRAINT fk_nvs_group FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_nvs_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nerdacolo_votes (
  session_id  CHAR(36)    NOT NULL,
  user_id     CHAR(36)    NOT NULL,
  media_key   VARCHAR(64) NOT NULL,
  vote        TINYINT     NOT NULL,
  updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id, user_id, media_key),
  CONSTRAINT fk_nv_session FOREIGN KEY (session_id) REFERENCES nerdacolo_vote_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_nv_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
