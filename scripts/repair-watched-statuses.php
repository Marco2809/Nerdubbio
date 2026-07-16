<?php
// Rimette "completata" alle serie che il re-import ha retrocesso a "in corso".
//
// Il CSV di TV Time è una foto vecchia e sovrascriveva lo stato reale. Qui si
// ricalcola con la stessa regola dell'app: serie conclusa + nessun episodio
// uscito dopo l'ultimo visto => completata. Le serie ancora in onda restano
// "in corso" (sei in pari, aspetti i nuovi episodi), e pausa/abbandonata non
// si toccano mai.
//
//   php scripts/repair-watched-statuses.php <handle>           # dry-run
//   php scripts/repair-watched-statuses.php <handle> --apply
//
// Server-side e throttlato: dal client sarebbero centinaia di round-trip.

if (PHP_SAPI !== 'cli') { http_response_code(403); exit('cli only'); }

require_once __DIR__ . '/../api/lib/helpers.php';
require_once __DIR__ . '/../api/lib/db.php';

$apply  = in_array('--apply', $argv, true);
$handle = $argv[1] ?? '';
if ($handle === '' || str_starts_with($handle, '--')) {
    exit("Uso: php scripts/repair-watched-statuses.php <handle> [--apply]\n");
}

$tmdbKey = app_config('tmdb_api_key');
if (!$tmdbKey) exit("ERRORE: tmdb_api_key mancante in api/config.php\n");

$stmt = $pdo->prepare('SELECT id FROM profiles WHERE handle = ?');
$stmt->execute([$handle]);
$userId = $stmt->fetchColumn();
if (!$userId) exit("Utente @$handle non trovato\n");

function tmdb_get(string $path): ?array {
    global $tmdbKey;
    for ($try = 0; $try < 3; $try++) {
        $ch = curl_init("https://api.themoviedb.org/3$path?api_key=" . urlencode($tmdbKey));
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
        $raw  = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code === 200 && $raw) return json_decode($raw, true);
        if ($code === 429) { sleep(2); continue; }
        return null; // 404 o errore: non giudicare
    }
    return null;
}

$rows = $pdo->prepare(
    'SELECT media_key, title, current_season, current_episode FROM user_media
     WHERE user_id = ? AND status = "watching" AND media_key LIKE "tv-%"
     ORDER BY title'
);
$rows->execute([$userId]);
$shows = $rows->fetchAll();

$today = date('Y-m-d');
$upd = $pdo->prepare('UPDATE user_media SET status = "completed", source = "status_sync" WHERE user_id = ? AND media_key = ?');
$epStmt = $pdo->prepare('SELECT season, episode FROM user_episodes WHERE user_id = ? AND media_key = ?');

echo ($apply ? "== APPLY ==" : "== DRY-RUN ==") . " @$handle — " . count($shows) . " serie 'in corso' da verificare\n\n";

$toComplete = 0; $stillWatching = 0; $unknown = 0;
foreach ($shows as $r) {
    $tmdbId = (int) substr($r['media_key'], 3);
    if ($tmdbId <= 0) continue;

    $epStmt->execute([$userId, $r['media_key']]);
    $lastS = (int) ($r['current_season'] ?? 0);
    $lastE = (int) ($r['current_episode'] ?? 0);
    $count = 0;
    foreach ($epStmt->fetchAll() as $e) {
        $count++;
        $s = (int) $e['season']; $ep = (int) $e['episode'];
        if ($s > $lastS || ($s === $lastS && $ep > $lastE)) { $lastS = $s; $lastE = $ep; }
    }
    if ($count === 0 && $lastS === 0) continue; // nessun progresso: non è "vista"

    $det = tmdb_get("/tv/$tmdbId");
    usleep(120000);
    if (!$det) { $unknown++; continue; }

    $status = strtolower((string) ($det['status'] ?? ''));
    $ended = in_array($status, ['ended', 'canceled', 'cancelled'], true);
    if (!$ended) { $stillWatching++; continue; } // ancora in onda: "in corso" è corretto

    // C'è un episodio già uscito dopo l'ultimo visto?
    $seasons = array_values(array_filter($det['seasons'] ?? [],
        fn($s) => ($s['season_number'] ?? 0) > 0 && ($s['episode_count'] ?? 0) > 0));
    usort($seasons, fn($a, $b) => $a['season_number'] <=> $b['season_number']);

    $pending = false; $failed = false;
    foreach ($seasons as $s) {
        if ($s['season_number'] < $lastS) continue;
        $sd = tmdb_get("/tv/$tmdbId/season/{$s['season_number']}");
        usleep(120000);
        if (!$sd) { $failed = true; break; }
        foreach (($sd['episodes'] ?? []) as $e) {
            $sn = (int) $e['season_number']; $en = (int) $e['episode_number'];
            if (!($sn > $lastS || ($sn === $lastS && $en > $lastE))) continue;
            if (!empty($e['air_date']) && $e['air_date'] <= $today) { $pending = true; break 2; }
        }
    }
    if ($failed) { $unknown++; continue; }

    if ($pending) { $stillWatching++; continue; }

    $toComplete++;
    printf("  COMPLETATA  %-40s (%s, vista fino a S%dE%d)\n", mb_substr($r['title'] ?? $r['media_key'], 0, 39), $status, $lastS, $lastE);
    if ($apply) $upd->execute([$userId, $r['media_key']]);
}

echo "\nDa segnare completate: $toComplete | restano in corso: $stillWatching | non verificabili: $unknown\n";
if (!$apply && $toComplete > 0) echo "Rilancia con --apply per applicare.\n";
