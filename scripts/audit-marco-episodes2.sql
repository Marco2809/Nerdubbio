SET @uid = 'a8c58c90-4d12-4b2f-8033-c22d45bda57d';

-- Distribuzione stagioni per show sospetti
SELECT 'incantesimo_seasons' AS q, season, COUNT(*) AS c
FROM user_episodes
WHERE user_id = @uid AND media_key = 'tv-34151'
GROUP BY season ORDER BY season LIMIT 20;

SELECT 'incantesimo_max_ep_s1' AS q, MAX(episode) AS max_ep
FROM user_episodes
WHERE user_id = @uid AND media_key = 'tv-34151' AND season = 1;

-- Stesso titolo, media_key diversi?
SELECT title, COUNT(*) AS keys, GROUP_CONCAT(media_key ORDER BY media_key SEPARATOR ', ') AS keys_list
FROM user_media
WHERE user_id = @uid AND title LIKE '%Incantesimo%'
GROUP BY title;

-- Episodi totali per show con >200 eps (probabile fake S1E1..N)
SELECT um.title, ue.media_key, COUNT(*) AS ep_count,
  SUM(CASE WHEN ue.season = 1 THEN 1 ELSE 0 END) AS s1_only,
  MAX(CASE WHEN ue.season = 1 THEN ue.episode ELSE 0 END) AS max_s1_ep
FROM user_episodes ue
JOIN user_media um ON um.user_id = ue.user_id AND um.media_key = ue.media_key
WHERE ue.user_id = @uid
GROUP BY ue.media_key, um.title
HAVING ep_count > 200
ORDER BY ep_count DESC;

-- Gap analysis: episodi consecutivi S1 senza buchi grandi = pattern fake
SELECT um.title, ue.media_key, COUNT(*) AS s1_eps, MIN(ue.episode) AS min_e, MAX(ue.episode) AS max_e
FROM user_episodes ue
JOIN user_media um ON um.user_id = ue.user_id AND um.media_key = ue.media_key
WHERE ue.user_id = @uid AND ue.season = 1
GROUP BY ue.media_key, um.title
HAVING s1_eps > 100 AND max_e >= s1_eps * 0.9
ORDER BY s1_eps DESC
LIMIT 20;
