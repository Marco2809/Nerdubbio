<?php
// Pulizia post-import per un account:
//  1) Duplicati (stesso titolo, tmdbId diversi): tiene l'entry con più episodi,
//     vi fonde gli episodi dell'altra (nessun dato perso) e cancella la doppia.
//  2) Serie CONCLUSE viste al >= 90% ma ancora "in corso": le segna completate.
//
//   php scripts/repair-cleanup.php <handle>           # dry-run
//   php scripts/repair-cleanup.php <handle> --apply
//
// Preferiti/pausa/abbandonate non vengono retrocessi.

if (PHP_SAPI !== 'cli') { http_response_code(403); exit('cli only'); }

require_once __DIR__ . '/../api/lib/helpers.php';
require_once __DIR__ . '/../api/lib/db.php';

$apply  = in_array('--apply', $argv, true);
$handle = $argv[1] ?? '';
if ($handle === '' || str_starts_with($handle, '--')) exit("Uso: php scripts/repair-cleanup.php <handle> [--apply]\n");

$tmdbKey = app_config('tmdb_api_key');
if (!$tmdbKey) exit("ERRORE: tmdb_api_key mancante in api/config.php\n");

$userId = (function () use ($pdo, $handle) {
    $s = $pdo->prepare('SELECT id FROM profiles WHERE handle = ?');
    $s->execute([$handle]);
    return $s->fetchColumn();
})();
if (!$userId) exit("Utente @$handle non trovato\n");

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

$STATUS_RANK = ['completed' => 5, 'watching' => 4, 'paused' => 3, 'plan_to_watch' => 2, 'dropped' => 1];
echo ($apply ? "== APPLY ==" : "== DRY-RUN ==") . " @$handle\n\n";

// ---------------------------------------------------------------------------
// 1) DUPLICATI
// ---------------------------------------------------------------------------
echo "--- Duplicati ---\n";
$dups = $pdo->prepare(
    'SELECT LOWER(TRIM(title)) t, GROUP_CONCAT(media_key) keys_csv
     FROM user_media WHERE user_id = ? AND media_key LIKE "tv-%" AND title IS NOT NULL AND TRIM(title) <> ""
     GROUP BY t HAVING COUNT(*) > 1'
);
$dups->execute([$userId]);

$epCount = $pdo->prepare('SELECT COUNT(*) FROM user_episodes WHERE user_id = ? AND media_key = ?');
$mergeEps = $pdo->prepare(
    'INSERT IGNORE INTO user_episodes (user_id, media_key, season, episode, watched_at, watch_count)
     SELECT user_id, ?, season, episode, watched_at, watch_count
     FROM user_episodes WHERE user_id = ? AND media_key = ?'
);
$delEps = $pdo->prepare('DELETE FROM user_episodes WHERE user_id = ? AND media_key = ?');
$delMedia = $pdo->prepare('DELETE FROM user_media WHERE user_id = ? AND media_key = ?');
$getMedia = $pdo->prepare('SELECT status, is_favorite, rating FROM user_media WHERE user_id = ? AND media_key = ?');
$updWinner = $pdo->prepare('UPDATE user_media SET status = ?, is_favorite = ?, rating = ? WHERE user_id = ? AND media_key = ?');

$mergedCount = 0;
foreach ($dups as $d) {
    $keys = explode(',', $d['keys_csv']);
    // Vincitore = entry con più episodi visti.
    $best = null; $bestEps = -1; $meta = [];
    foreach ($keys as $k) {
        $epCount->execute([$userId, $k]); $n = (int) $epCount->fetchColumn();
        $getMedia->execute([$userId, $k]); $m = $getMedia->fetch();
        $meta[$k] = ['eps' => $n, 'status' => $m['status'], 'fav' => (int) $m['is_favorite'], 'rating' => $m['rating']];
        if ($n > $bestEps) { $bestEps = $n; $best = $k; }
    }
    $losers = array_values(array_filter($keys, fn($k) => $k !== $best));

    // Stato/flag finali fusi.
    $status = $meta[$best]['status']; $fav = $meta[$best]['fav']; $rating = $meta[$best]['rating'];
    foreach ($keys as $k) {
        if (($STATUS_RANK[$meta[$k]['status']] ?? 0) > ($STATUS_RANK[$status] ?? 0)) $status = $meta[$k]['status'];
        $fav = $fav || $meta[$k]['fav'];
        $rating = max((int) $rating, (int) $meta[$k]['rating']) ?: null;
    }

    $desc = implode(' + ', array_map(fn($k) => "$k({$meta[$k]['eps']}ep,{$meta[$k]['status']})", $keys));
    printf("  %-26s %s -> tiene %s [%s]\n", mb_substr($d['t'], 0, 25), $desc, $best, $status);
    $mergedCount++;

    if ($apply) {
        $pdo->beginTransaction();
        try {
            foreach ($losers as $lk) {
                $mergeEps->execute([$best, $userId, $lk]);
                $delEps->execute([$userId, $lk]);
                $delMedia->execute([$userId, $lk]);
            }
            $updWinner->execute([$status, $fav ? 1 : 0, $rating, $userId, $best]);
            $pdo->commit();
        } catch (Throwable $e) { $pdo->rollBack(); echo "     ERRORE: " . $e->getMessage() . "\n"; }
    }
}
echo "  Titoli duplicati risolti: $mergedCount\n\n";

// ---------------------------------------------------------------------------
// 2) COMPLETAMENTO >= 90% su serie CONCLUSE ancora "in corso"
// ---------------------------------------------------------------------------
echo "--- Concluse viste >= 90% ---\n";
$q = $pdo->prepare(
    'SELECT media_key, title,
       (SELECT COUNT(*) FROM user_episodes ue WHERE ue.user_id = um.user_id AND ue.media_key = um.media_key) eps
     FROM user_media um WHERE user_id = ? AND status = "watching" AND media_key LIKE "tv-%" HAVING eps > 0'
);
$q->execute([$userId]);
$complete = $pdo->prepare('UPDATE user_media SET status = "completed", source = "status_sync" WHERE user_id = ? AND media_key = ?');

$done = 0;
foreach ($q->fetchAll() as $r) {
    $det = tmdb_get('/tv/' . (int) substr($r['media_key'], 3));
    usleep(90000);
    if (!$det) continue;
    if (!in_array(strtolower((string) ($det['status'] ?? '')), ['ended', 'canceled', 'cancelled'], true)) continue;
    $tot = 0;
    foreach (($det['seasons'] ?? []) as $s) if (($s['season_number'] ?? 0) > 0) $tot += (int) ($s['episode_count'] ?? 0);
    if ($tot <= 0) continue;
    if ($r['eps'] / $tot < 0.90) continue;

    printf("  COMPLETATA  %-40s (%d/%d = %d%%)\n", mb_substr($r['title'], 0, 39), $r['eps'], $tot, round($r['eps'] / $tot * 100));
    $done++;
    if ($apply) $complete->execute([$userId, $r['media_key']]);
}
echo "  Serie completate: $done\n";

if (!$apply) echo "\nRilancia con --apply per applicare.\n";
