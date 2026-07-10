-- Media nei commenti: una gif (GIPHY) o un'immagine caricata per commento.
USE nerdubbio;

ALTER TABLE media_comments
  ADD COLUMN IF NOT EXISTS media_url VARCHAR(512) NULL AFTER body;
