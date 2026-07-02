-- ============================================================
-- Nerdubbio – schema MySQL (auth + profili + ruoli)
--   mysql -u root -p < api/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS nerdubbio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nerdubbio;

CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36)      NOT NULL,
  email         VARCHAR(255)  NOT NULL,
  password_hash VARCHAR(255)  DEFAULT NULL,
  google_id     VARCHAR(64)   DEFAULT NULL,
  avatar_url    VARCHAR(1000) DEFAULT NULL,
  display_name  VARCHAR(255)  DEFAULT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_users_email (email),
  UNIQUE KEY uniq_users_google (google_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS profiles (
  id           CHAR(36)     NOT NULL,
  handle       VARCHAR(24)  NOT NULL,
  display_name VARCHAR(255) DEFAULT NULL,
  avatar_url   VARCHAR(1000) DEFAULT NULL,
  bio          TEXT         DEFAULT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_profiles_handle (handle),
  CONSTRAINT fk_profiles_user FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_handle_format CHECK (handle REGEXP '^[a-z0-9_]{3,24}$')
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_roles (
  id      CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role    ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_role (user_id, role),
  KEY idx_roles_user (user_id),
  CONSTRAINT fk_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token      CHAR(64) NOT NULL,
  user_id    CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token),
  KEY idx_reset_user (user_id),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- CREATE USER IF NOT EXISTS 'nerdubbio_user'@'localhost' IDENTIFIED BY 'PASSWORD_SICURA';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON nerdubbio.* TO 'nerdubbio_user'@'localhost';
-- FLUSH PRIVILEGES;
