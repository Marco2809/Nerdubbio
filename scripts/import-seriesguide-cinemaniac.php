<?php
// Import ad-hoc: serie da SeriesGuide (JSON) + film/voti da Cinemaniac (.bak JSON).
// Entrambi usano id TMDB diretti: nessun matching, import di precisione.
//
//   php scripts/import-seriesguide-cinemaniac.php <handle> <seriesguide.json> <cinemaniac.json> [--apply]
//
// Dry-run default. In apply: upsert user_media + user_episodes, poster da TMDB
// per i film (SeriesGuide porta già il poster). Voti Cinemaniac su film e serie.

if (PHP_SAPI !== 'cli') { http_response_code(403); exit('cli only'); }

require_once __DIR__ . '/../api/lib/helpers.php';
require_once __DIR__ . '/../api/lib/db.php';

$apply = in_array('--apply', $argv, true);
$a = array_values(array_filter(array_slice($argv, 1), fn($x) => $x !== '--apply'));
[$handle, $sgPath, $cmPath] = [$a[0] ?? '', $a[1] ?? '', $a[2] ?? ''];
if ($handle === '' || !is_file($sgPath) || !is_file($cmPath)) exit("Uso: <handle> <seriesguide.json> <cinemaniac.json> [--apply]\n");

$tmdbKey = app_config('tmdb_api_key');
$userId = (function () use ($pdo, $handle) {
    $s = $pdo->prepare('SELECT id FROM profiles WHERE handle = ?');
    $s->execute([$handle]);
    return $s->fetchColumn();
})();
if (!$userId) exit("Utente @$handle non trovato\n");

function ms_to_dt($ms): ?string {
    $ms = (int) $ms;
    if ($ms <= 0) return null;
    $t = (int) ($ms / 1000);
    if ($t > time()) $t = time();
    return date('Y-m-d H:i:s', $t);
}
function tmdb_get(string $path): ?array {
    global $tmdbKey;
    for ($i = 0; $i < 3; $i++) {
        $ch = curl_init("https://api.themoviedb.org/3$path?api_key=" . urlencode($tmdbKey));
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
        $raw = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code === 200 && $raw) return json_decode($raw, true);
        if ($code === 429) { sleep(2); continue; }
        return null;
    }
    return null;
}

$sg = json_decode(file_get_contents($sgPath), true);
$cm = json_decode(file_get_contents($cmPath), true);
$ratings = [];
foreach ($cm['ratings'] ?? [] as $r) $ratings[(int) $r['id']] = (float) $r['r'];
$NEUTRAL = '2019-06-15 12:00:00';

echo ($apply ? "== APPLY ==" : "== DRY-RUN ==") . " @$handle\n\n";

// --- Prepared (apply) ---
$upMedia = $pdo->prepare(
    'INSERT INTO user_media (user_id, media_key, tmdb_id, media_type, status, rating, title, poster_url, year, source, is_favorite, last_watched_at, watch_count)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE status=VALUES(status), rating=COALESCE(VALUES(rating),rating), title=VALUES(title),
       poster_url=COALESCE(VALUES(poster_url),poster_url), year=VALUES(year), is_favorite=VALUES(is_favorite),
       last_watched_at=VALUES(last_watched_at), watch_count=VALUES(watch_count)');
$delEps = $pdo->prepare('DELETE FROM user_episodes WHERE user_id=? AND media_key=?');
$insEp  = $pdo->prepare('INSERT IGNORE INTO user_episodes (user_id, media_key, season, episode, watched_at, watch_count) VALUES (?,?,?,?,?,1)');

// ---------------- SERIE TV (SeriesGuide) ----------------
$tvShows = 0; $tvEps = 0; $tvCompleted = 0; $tvWatching = 0; $tvFav = 0; $tvRated = 0;
foreach ($sg as $sh) {
    $tmdbId = (int) ($sh['tmdb_id'] ?? 0);
    if ($tmdbId <= 0) continue;
    $keys = [];
    $total = 0;
    foreach ($sh['seasons'] ?? [] as $se) {
        $sn = (int) ($se['season'] ?? 0);
        if ($sn < 1) continue;
        foreach ($se['episodes'] ?? [] as $e) {
            $en = (int) ($e['episode'] ?? 0);
            if ($en < 1) continue;
            $total++;
            if (!empty($e['watched'])) $keys[] = "S{$sn}E{$en}";
        }
    }
    if (!$keys) continue;
    $tvShows++; $tvEps += count($keys);

    $st = (string) ($sh['status'] ?? '');
    $ended = in_array($st, ['ended', 'canceled', 'cancelled'], true);
    $status = ($ended && count($keys) >= $total) ? 'completed' : 'watching';
    $status === 'completed' ? $tvCompleted++ : $tvWatching++;
    $fav = !empty($sh['favorite']); if ($fav) $tvFav++;
    $rating = isset($ratings[$tmdbId]) ? max(1, (int) round($ratings[$tmdbId])) : null;
    if ($rating) $tvRated++;
    $poster = !empty($sh['poster']) ? 'https://image.tmdb.org/t/p/w342' . $sh['poster'] : null;
    $year = !empty($sh['first_aired']) ? (int) substr($sh['first_aired'], 0, 4) : null;
    $lw = ms_to_dt($sh['last_watched_ms'] ?? 0) ?? $NEUTRAL;

    if ($apply) {
        $upMedia->execute([$userId, "tv-$tmdbId", $tmdbId, 'tv', $status, $rating, mb_substr((string) ($sh['title'] ?? ''), 0, 255), $poster, $year, 'seriesguide', $fav ? 1 : 0, $lw, count($keys)]);
        $delEps->execute([$userId, "tv-$tmdbId"]);
        foreach ($keys as $k) {
            preg_match('/^S(\d+)E(\d+)$/', $k, $m);
            $insEp->execute([$userId, "tv-$tmdbId", (int) $m[1], (int) $m[2], $lw]);
        }
    }
}

// ---------------- FILM (Cinemaniac) ----------------
$mvSeen = 0; $mvPlan = 0; $mvRated = 0; $mvNoMap = 0;
foreach ($cm['movies'] ?? [] as $mv) {
    $tmdbId = (int) ($mv['id_movie'] ?? 0);
    if ($tmdbId <= 0) { $mvNoMap++; continue; }
    $seen = ((int) ($mv['seen'] ?? 0)) === 1;
    $seen ? $mvSeen++ : $mvPlan++;
    $rating = isset($ratings[$tmdbId]) ? max(1, (int) round($ratings[$tmdbId])) : null;
    if ($rating) $mvRated++;
    $year = !empty($mv['year']) ? (int) date('Y', (int) ($mv['year'] / 1000)) : null;
    $added = ms_to_dt($mv['date'] ?? 0);

    if ($apply) {
        $poster = null;
        $det = tmdb_get("/movie/$tmdbId");
        usleep(60000);
        if ($det && !empty($det['poster_path'])) $poster = 'https://image.tmdb.org/t/p/w342' . $det['poster_path'];
        $status = $seen ? 'completed' : 'plan_to_watch';
        $upMedia->execute([$userId, "movie-$tmdbId", $tmdbId, 'movie', $status, $rating, mb_substr((string) ($mv['title'] ?? ''), 0, 255), $poster, $year, 'cinemaniac', 0, $seen ? ($added ?? $NEUTRAL) : null, $seen ? 1 : 0]);
    }
}

echo "SERIE TV (SeriesGuide):\n";
echo "  serie: $tvShows | episodi visti: $tvEps | completate: $tvCompleted | in corso: $tvWatching | preferiti: $tvFav | con voto: $tvRated\n\n";
echo "FILM (Cinemaniac):\n";
echo "  visti: $mvSeen | da vedere: $mvPlan | con voto: $mvRated | senza id: $mvNoMap\n\n";
if (!$apply) echo "(DRY-RUN: nessuna scrittura) — rilancia con --apply per importare.\n";
else echo "IMPORT COMPLETATO.\n";
