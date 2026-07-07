-- Preferito come flag indipendente dallo stato: una serie può essere "vista" E
-- "preferita" senza perdere lo stato. Migrazione idempotente (rigira a ogni deploy).

ALTER TABLE user_media
  ADD COLUMN IF NOT EXISTS is_favorite TINYINT(1) NOT NULL DEFAULT 0;

-- Le vecchie entry con status='favorite' diventano favorite + uno stato reale
-- dedotto dal progresso. Dopo il primo giro nessuna riga ha più status='favorite'.
UPDATE user_media SET is_favorite = 1 WHERE status = 'favorite';

UPDATE user_media um SET status = CASE
    WHEN (um.media_type = 'movie' OR um.media_key LIKE 'movie-%') AND um.watch_count > 0 THEN 'completed'
    WHEN (um.media_type = 'movie' OR um.media_key LIKE 'movie-%') THEN 'plan_to_watch'
    WHEN EXISTS (
      SELECT 1 FROM user_episodes e
      WHERE e.user_id = um.user_id AND e.media_key = um.media_key
    ) THEN 'watching'
    ELSE 'plan_to_watch'
  END
  WHERE um.status = 'favorite';
