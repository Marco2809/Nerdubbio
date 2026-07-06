-- Estende lingue utente: IT, EN, ES, FR, DE
USE nerdubbio;

ALTER TABLE user_stats
  MODIFY COLUMN language ENUM('it','en','es','fr','de') NOT NULL DEFAULT 'it';
