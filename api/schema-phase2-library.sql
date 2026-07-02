-- ============================================================
-- Nerdubbio – Fase 2: libreria utente + social base
--   mysql -u root -p nerdubbio < api/schema-phase2-library.sql
-- ============================================================

USE nerdubbio;

CREATE TABLE IF NOT EXISTS user_stats (
  user_id            CHAR(36)     NOT NULL,
  xp                 INT          NOT NULL DEFAULT 0,
  level              INT          NOT NULL DEFAULT 1,
  streak_days        INT          NOT NULL DEFAULT 0,
  last_active_day    DATE         DEFAULT NULL,
  onboarding_done    TINYINT(1)   NOT NULL DEFAULT 0,
  language           ENUM('it','en') NOT NULL DEFAULT 'it',
  favorite_genres    JSON         DEFAULT NULL,
  mood_profile       JSON         DEFAULT NULL,
  upcoming_filters   JSON         DEFAULT NULL,
  dismissed          JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  achievements       JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  local_migrated     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_stats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_media (
  user_id           CHAR(36)      NOT NULL,
  media_key         VARCHAR(64)   NOT NULL,
  tmdb_id           INT           DEFAULT NULL,
  media_type        ENUM('tv','movie') DEFAULT NULL,
  status            VARCHAR(20)   NOT NULL DEFAULT 'plan_to_watch',
  rating            TINYINT       DEFAULT NULL,
  current_season    INT           DEFAULT NULL,
  current_episode   INT           DEFAULT NULL,
  reactions         JSON          DEFAULT NULL,
  notes             TEXT          DEFAULT NULL,
  title             VARCHAR(255)  DEFAULT NULL,
  poster_url        VARCHAR(1000) DEFAULT NULL,
  backdrop_url      VARCHAR(1000) DEFAULT NULL,
  year              SMALLINT      DEFAULT NULL,
  source            VARCHAR(20)   DEFAULT 'manual',
  added_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_watched_at   DATETIME      DEFAULT NULL,
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, media_key),
  KEY idx_media_user_status (user_id, status),
  CONSTRAINT fk_media_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_episodes (
  user_id     CHAR(36) NOT NULL,
  media_key   VARCHAR(64) NOT NULL,
  season      INT       NOT NULL,
  episode     INT       NOT NULL,
  watched_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, media_key, season, episode),
  KEY idx_episodes_media (user_id, media_key),
  CONSTRAINT fk_episodes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS friendships (
  user_id     CHAR(36) NOT NULL,
  friend_id   CHAR(36) NOT NULL,
  status      ENUM('pending','accepted','blocked') NOT NULL DEFAULT 'pending',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, friend_id),
  KEY idx_friendships_friend (friend_id, status),
  CONSTRAINT fk_friendships_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_friendships_friend FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS groups (
  id          CHAR(36)     NOT NULL,
  name        VARCHAR(120) NOT NULL,
  owner_id    CHAR(36)     NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_groups_owner (owner_id),
  CONSTRAINT fk_groups_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS group_members (
  group_id    CHAR(36) NOT NULL,
  user_id     CHAR(36) NOT NULL,
  role        ENUM('owner','member') NOT NULL DEFAULT 'member',
  joined_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id),
  KEY idx_group_members_user (user_id),
  CONSTRAINT fk_gm_group FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_gm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
