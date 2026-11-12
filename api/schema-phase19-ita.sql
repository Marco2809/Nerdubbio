-- ============================================================
-- Nerdubbio – Fase 19: edizione italiana dei titoli
-- ============================================================
-- Per ogni titolo: è uscito in italiano? doppiato o solo sottotitoli?
-- Dati da TMDB + Wikipedia italiana (api/lib/ita.php), cache condivisa fra gli
-- utenti, aggiornata a rate dal cron scripts/ita-cron.php e quando si apre la
-- scheda. «Doppiato / Solo sub» scelto dall'utente vale solo per lui.

USE nerdubbio;

-- Che cos'è un titolo: film, serie o anime (TMDB, una lettura sola).
CREATE TABLE IF NOT EXISTS media_kind (
  media_key  VARCHAR(32) NOT NULL,
  kind       ENUM('film','serie','anime') NOT NULL,
  fetched_at DATETIME    NOT NULL,
  PRIMARY KEY (media_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lo stato in italiano, condiviso fra gli utenti.
CREATE TABLE IF NOT EXISTS media_ita (
  media_key  VARCHAR(32) NOT NULL,
  data       MEDIUMTEXT  NOT NULL,
  stato      VARCHAR(12) NOT NULL,
  airing     TINYINT     NOT NULL DEFAULT 0,
  fetched_at DATETIME    NOT NULL,
  PRIMARY KEY (media_key),
  KEY idx_mi_fetched (fetched_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Doppiato / Solo sub indicato dall'utente: vince sul dato automatico, solo per lui.
CREATE TABLE IF NOT EXISTS user_ita_lang (
  user_id    CHAR(36)    NOT NULL,
  media_key  VARCHAR(32) NOT NULL,
  lang       ENUM('dub','sub') NOT NULL,
  updated_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, media_key),
  CONSTRAINT fk_uil_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
