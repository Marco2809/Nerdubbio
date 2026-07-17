<?php
// Riallinea gli stati delle serie di TUTTI gli utenti al calendario TMDB.
// Stessa regola dell'app, bidirezionale:
//   - "in corso"  -> "vista"    se in pari e niente in calendario (nessun
//                                episodio uscito dopo l'ultimo visto, nessun
//                                episodio futuro con data)
//   - "vista"     -> "in corso" se dopo l'ultimo visto c'è un episodio uscito
//                                O anche solo annunciato con una data futura
//                                (coerente col real-time: "la sto aspettando")
// Non tocca mai: pausa, abbandonate, da-vedere, entry senza episodi segnati
// (stati impostati a mano restano tali).
//
//   php scripts/sync-show-statuses.php            # dry-run
//   php scripts/sync-show-statuses.php --apply
//
// Pensato per il cron notturno: 1 fetch TMDB per serie DISTINTA (con cache in
// memoria), throttlato.

if (PHP_SAPI !== 'cli') { http_response_code(403); exit('cli only'); }

require_once __DIR__ . '/../api/lib/helpers.php';
require_once __DIR__ . '/../api/lib/db.php';

$apply = in_array('--apply', $argv, true);
$tmdbKey = app_config('tmdb_api_key');
if (!$tmdbKey) exit("ERRORE: tmdb_api_key mancante in api/config.php\n");

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

/** Episodi [ [s, e, air|null], ... ] di una serie, con cache per processo. */
$showCache = [];
function show_episodes(int $tmdbId): ?array {
    global $showCache;
    if (array_key_exists($tmdbId, $showCache)) return $showCache[$tmdbId];
    $det = tmdb_get("/tv/$tmdbId");
    usleep(110000);
    if (!$det) return $showCache[$tmdbId] = null;
    $eps = [];
    foreach (($det['seasons'] ?? []) as $s) {
        $sn = (int) ($s['season_number'] ?? 0);
        if ($sn < 1 || (int) ($s['episode_count'] ?? 0) < 1) continue;
        $sd = tmdb_get("/tv/$tmdbId/season/$sn");
        usleep(110000);
        if (!$sd) continue;
        foreach (($sd['episodes'] ?? []) as $e) {
            $eps[] = [(int) $e['season_number'], (int) $e['episode_number'], $e['air_date'] ?: null];
        }
    }
    return $showCache[$tmdbId] = $eps;
}

// Entry candidate: tv, watching|completed, con almeno 1 episodio segnato.
$rows = $pdo->query(
    'SELECT um.user_id, COALESCE(p.handle, um.user_id) AS handle, um.media_key, um.title, um.status,
            um.current_season, um.current_episode
     FROM user_media um
     LEFT JOIN profiles p ON p.id = um.user_id
     WHERE um.media_key LIKE "tv-%" AND um.status IN ("watching", "completed")
       AND EXISTS (SELECT 1 FROM user_episodes ue WHERE ue.user_id = um.user_id AND ue.media_key = um.media_key)
     ORDER BY um.media_key'
)->fetchAll();

$epStmt = $pdo->prepare('SELECT season, episode FROM user_episodes WHERE user_id = ? AND media_key = ?');
$upd = $pdo->prepare('UPDATE user_media SET status = ?, source = "status_sync" WHERE user_id = ? AND media_key = ?');

$today = date('Y-m-d');
$toCompleted = 0; $toWatching = 0; $unknown = 0; $checkedShows = [];

echo ($apply ? "== APPLY ==" : "== DRY-RUN ==") . ' ' . count($rows) . " entry da verificare\n\n";

foreach ($rows as $r) {
    $tmdbId = (int) substr($r['media_key'], 3);
    if ($tmdbId <= 0) continue;
    $eps = show_episodes($tmdbId);
    $checkedShows[$tmdbId] = true;
    if ($eps === null) { $unknown++; continue; } // TMDB muto: non giudicare

    // Frontier utente: max (stagione, episodio) tra episodi segnati e current_*.
    $epStmt->execute([$r['user_id'], $r['media_key']]);
    $fs = (int) ($r['current_season'] ?? 0);
    $fe = (int) ($r['current_episode'] ?? 0);
    foreach ($epStmt->fetchAll() as $e) {
        $s = (int) $e['season']; $ep = (int) $e['episode'];
        if ($s > $fs || ($s === $fs && $ep > $fe)) { $fs = $s; $fe = $ep; }
    }
    if ($fs === 0) continue;

    $airedAfter = false; $datedFuture = false;
    foreach ($eps as [$s, $e, $air]) {
        if (!($s > $fs || ($s === $fs && $e > $fe))) continue;
        if ($air !== null && $air <= $today) { $airedAfter = true; break; }
        if ($air !== null && $air > $today) $datedFuture = true;
    }

    if ($r['status'] === 'watching' && !$airedAfter && !$datedFuture) {
        $toCompleted++;
        printf("  VISTA      @%-18s %-38s (in pari, niente in calendario)\n", $r['handle'], mb_substr($r['title'] ?? $r['media_key'], 0, 37));
        if ($apply) $upd->execute(['completed', $r['user_id'], $r['media_key']]);
    } elseif ($r['status'] === 'completed' && ($airedAfter || $datedFuture)) {
        $toWatching++;
        $why = $airedAfter ? "uscito un episodio dopo S{$fs}E{$fe}" : "nuovo episodio annunciato dopo S{$fs}E{$fe}";
        printf("  IN CORSO   @%-18s %-38s (%s)\n", $r['handle'], mb_substr($r['title'] ?? $r['media_key'], 0, 37), $why);
        if ($apply) $upd->execute(['watching', $r['user_id'], $r['media_key']]);
    }
}

echo "\nSerie distinte interrogate: " . count($checkedShows) . " | -> Vista: $toCompleted | -> In corso: $toWatching | non verificabili: $unknown\n";
if (!$apply && ($toCompleted + $toWatching) > 0) echo "Rilancia con --apply per applicare.\n";
