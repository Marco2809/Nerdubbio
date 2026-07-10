-- Commenti per episodio + discussioni: season/episode/parent_id esistono già
-- (phase5); aggiungiamo solo il voto opzionale per commento (recensione).
USE nerdubbio;

ALTER TABLE media_comments
  ADD COLUMN IF NOT EXISTS rating TINYINT NULL AFTER spoiler;

-- Indice per contare/leggere le reply di un commento.
CREATE INDEX IF NOT EXISTS idx_comments_parent ON media_comments (parent_id, created_at);
