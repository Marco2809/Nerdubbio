SET @uid = 'a8c58c90-4d12-4b2f-8033-c22d45bda57d';

SELECT 'total_episode_rows' AS metric, COUNT(*) AS value
FROM user_episodes WHERE user_id = @uid;

SELECT 'duplicate_s_e_pairs' AS metric, COUNT(*) AS value
FROM (
  SELECT media_key, season, episode
  FROM user_episodes
  WHERE user_id = @uid
  GROUP BY media_key, season, episode
  HAVING COUNT(*) > 1
) d;

SELECT 'shows_with_episodes' AS metric, COUNT(DISTINCT media_key) AS value
FROM user_episodes WHERE user_id = @uid;

SELECT 'total_media_rows' AS metric, COUNT(*) AS value
FROM user_media WHERE user_id = @uid;

SELECT 'tv_media_rows' AS metric, COUNT(*) AS value
FROM user_media WHERE user_id = @uid AND media_key LIKE 'tv-%';

SELECT 'movie_media_rows' AS metric, COUNT(*) AS value
FROM user_media WHERE user_id = @uid AND media_key LIKE 'movie-%';

SELECT 'duplicate_media_keys' AS metric, COUNT(*) AS value
FROM (
  SELECT media_key FROM user_media WHERE user_id = @uid GROUP BY media_key HAVING COUNT(*) > 1
) d;

-- Top 15 show per conteggio episodi
SELECT um.title, ue.media_key, COUNT(*) AS ep_count
FROM user_episodes ue
LEFT JOIN user_media um ON um.user_id = ue.user_id AND um.media_key = ue.media_key
WHERE ue.user_id = @uid
GROUP BY ue.media_key, um.title
ORDER BY ep_count DESC
LIMIT 15;

-- Episodi in DB ma titolo con pattern sospetto (conteggio aggregato vs lista)
SELECT um.media_key, um.title,
  (SELECT COUNT(*) FROM user_episodes e WHERE e.user_id = @uid AND e.media_key = um.media_key) AS db_eps
FROM user_media um
WHERE um.user_id = @uid AND um.media_key LIKE 'tv-%'
ORDER BY db_eps DESC
LIMIT 5;
