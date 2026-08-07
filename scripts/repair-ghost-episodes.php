<?php
// Ripara gli episodi "fantasma" (stagioni/episodi inesistenti su TMDB) per una
// serie, su tutti gli utenti che la hanno. Valida contro la struttura reale
// TMDB e ricalcola current_season/current_episode dal massimo residuo REALE.
//
//   php scripts/repair-ghost-episodes.php <tmdbId>            # dry-run
//   php scripts/repair-ghost-episodes.php <tmdbId> --apply
//
// Non tocca gli XP (vanno gestiti a parte). Non cambia lo status: rimuove solo
// righe user_episodes impossibili e riallinea current_*.

if (PHP_SAPI !== 'cli') { http_response_code(403); exit('cli only'); }
require_once __DIR__ . '/../api/lib/helpers.php';
require_once __DIR__ . '/../api/lib/db.php';

$apply = in_array('--apply', $argv, true);
$args = array_values(array_filter(array_slice($argv, 1), fn($x) => $x !== '--apply'));
$tmdbId = (int) ($args[0] ?? 0);
if ($tmdbId <= 0) exit("Uso: <tmdbId> [--apply]\n");

$mediaKey = "tv-$tmdbId";
$tmdbKey = app_config('tmdb_api_key');

// Struttura reale TMDB: stagione => numero episodi.
$ch = curl_init("https://api.themoviedb.org/3/tv/$tmdbId?api_key=" . urlencode($tmdbKey));
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
$det = json_decode(curl_exec($ch), true);
curl_close($ch);
if (!$det) exit("TMDB non raggiungibile per $tmdbId\n");

$realCount = [];
foreach (($det['seasons'] ?? []) as $s) {
    $sn = (int) $s['season_number'];
    if ($sn < 1) continue;
    $realCount[$sn] = (int) $s['episode_count'];
}
$title = $det['name'] ?? $mediaKey;
echo ($apply ? "== APPLY ==" : "== DRY-RUN ==") . " $title ($mediaKey)\n";
echo "Struttura reale: " . implode(', ', array_map(fn($s, $c) => "S$s=$c", array_keys($realCount), $realCount)) . "\n\n";

$isGhost = fn(int $s, int $e) => !isset($realCount[$s]) || $e < 1 || $e > $realCount[$s];

$rows = $pdo->prepare(
    'SELECT ue.user_id, COALESCE(p.handle, ue.user_id) AS handle, ue.season, ue.episode
     FROM user_episodes ue LEFT JOIN profiles p ON p.id = ue.user_id
     WHERE ue.media_key = ? ORDER BY ue.user_id, ue.season, ue.episode');
$rows->execute([$mediaKey]);

$byUser = [];
foreach ($rows->fetchAll(PDO::FETCH_ASSOC) as $r) {
    $byUser[$r['user_id']]['handle'] = $r['handle'];
    $byUser[$r['user_id']]['eps'][] = [(int) $r['season'], (int) $r['episode']];
}

$del = $pdo->prepare('DELETE FROM user_episodes WHERE user_id=? AND media_key=? AND season=? AND episode=?');
$updCur = $pdo->prepare('UPDATE user_media SET current_season=?, current_episode=? WHERE user_id=? AND media_key=?');

$totGhost = 0; $usersHit = 0;
foreach ($byUser as $uid => $info) {
    $ghosts = array_values(array_filter($info['eps'], fn($e) => $isGhost($e[0], $e[1])));
    $valid = array_values(array_filter($info['eps'], fn($e) => !$isGhost($e[0], $e[1])));
    if (!$ghosts) continue;
    $usersHit++; $totGhost += count($ghosts);

    // Nuovo frontier = max sui validi (stagione, poi episodio).
    $maxS = 0; $maxE = 0;
    foreach ($valid as [$s, $e]) { if ($s > $maxS || ($s === $maxS && $e > $maxE)) { $maxS = $s; $maxE = $e; } }

    $ghostSeasons = array_values(array_unique(array_map(fn($e) => $e[0], $ghosts)));
    sort($ghostSeasons);
    printf("@%-18s fantasmi=%-3d (stagioni %s) | validi=%-3d | nuovo ultimo visto: %s\n",
        $info['handle'], count($ghosts), implode(',', $ghostSeasons), count($valid),
        $maxS ? "S{$maxS}E{$maxE}" : "nessuno");

    if ($apply) {
        foreach ($ghosts as [$s, $e]) $del->execute([$uid, $mediaKey, $s, $e]);
        $updCur->execute([$maxS ?: null, $maxE ?: null, $uid, $mediaKey]);
    }
}

echo "\nUtenti riparati: $usersHit | righe fantasma rimosse: $totGhost\n";
if (!$apply && $totGhost > 0) echo "Rilancia con --apply per applicare.\n";
