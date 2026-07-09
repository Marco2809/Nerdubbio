-- Video-recap generati da AI: storyboard in cache, condiviso tra tutti gli utenti.
-- Una serie+stagione+lingua si genera una volta sola e resta a disposizione di tutti.
USE nerdubbio;

CREATE TABLE IF NOT EXISTS recap_storyboard (
  cache_key   VARCHAR(96)  NOT NULL,
  media_type  ENUM('movie','tv') NOT NULL,
  tmdb_id     INT          NOT NULL,
  season      VARCHAR(16)  NOT NULL DEFAULT 'full',
  lang        ENUM('it','en','es','fr','de') NOT NULL DEFAULT 'it',
  title       VARCHAR(255) NOT NULL DEFAULT '',
  storyboard  MEDIUMTEXT   NOT NULL,
  model       VARCHAR(48)  NOT NULL DEFAULT '',
  created_by  VARCHAR(64)  NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (cache_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
