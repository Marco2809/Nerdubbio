-- ============================================================
-- Nerdubbio – Fase 18: i miei cinema (orari a confronto)
-- ============================================================
-- Ogni utente sceglie città e fino a 6 cinema; gli orari si leggono da
-- ComingSoon UNA volta per cinema (cache condivisa fra gli utenti), al
-- massimo 4 volte al giorno dal cron scripts/cinema-cron.php.

USE nerdubbio;

-- I cinema scelti da almeno un utente (anagrafica + ultima lettura).
CREATE TABLE IF NOT EXISTS cinemas (
  id         VARCHAR(12)  NOT NULL,
  city       VARCHAR(60)  NOT NULL,
  slug       VARCHAR(160) NOT NULL,
  name       VARCHAR(200) NOT NULL,
  read_at    DATETIME     DEFAULT NULL,
  -- tetto di 4 letture al giorno per cinema, cron e scelte degli utenti insieme
  reads_day  DATE         DEFAULT NULL,
  reads_n    TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_cinemas (
  user_id    CHAR(36)     NOT NULL,
  cinema_id  VARCHAR(12)  NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, cinema_id),
  KEY idx_uc_cinema (cinema_id),
  CONSTRAINT fk_uc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_uc_cinema FOREIGN KEY (cinema_id) REFERENCES cinemas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Una riga per cinema, film e giorno.
CREATE TABLE IF NOT EXISTS cinema_showtimes (
  id         INT          NOT NULL AUTO_INCREMENT,
  cinema_id  VARCHAR(12)  NOT NULL,
  title      VARCHAR(200) NOT NULL,
  title_norm VARCHAR(190) NOT NULL,
  day        DATE         NOT NULL,
  times      VARCHAR(190) NOT NULL,
  hall       VARCHAR(190) DEFAULT NULL,
  price      VARCHAR(40)  DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_cs_cinema (cinema_id),
  KEY idx_cs_day (day),
  CONSTRAINT fk_cs_cinema FOREIGN KEY (cinema_id) REFERENCES cinemas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Elenco città ed elenco cinema per città: cambiano di rado.
CREATE TABLE IF NOT EXISTS cinema_cache (
  cache_key  VARCHAR(80)  NOT NULL,
  payload    LONGTEXT     NOT NULL,
  fetched_at DATETIME     NOT NULL,
  PRIMARY KEY (cache_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
