-- Consigli tra amici: suggerisci un titolo a un amico che non l'ha ancora visto.
USE nerdubbio;

CREATE TABLE IF NOT EXISTS recommendations (
  id          VARCHAR(36)  NOT NULL,
  from_user   VARCHAR(64)  NOT NULL,
  to_user     VARCHAR(64)  NOT NULL,
  media_key   VARCHAR(64)  NOT NULL,
  media_type  ENUM('tv','movie') DEFAULT NULL,
  title       VARCHAR(255) NOT NULL DEFAULT '',
  poster_url  VARCHAR(512) NULL,
  year        INT          NULL,
  message     VARCHAR(500) NULL,
  status      ENUM('pending','added','dismissed') NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_reco (from_user, to_user, media_key),
  KEY idx_reco_to (to_user, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
