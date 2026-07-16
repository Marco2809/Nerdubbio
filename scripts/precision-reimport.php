<?php
// Re-import di precisione da tracking-prod-records-v2.csv di TV Time.
// Usa la cronologia per-episodio (stagione, episodio, data reale) invece del
// conteggio: risolve numerazione, date e stati. Mappa l'id TV Time (TVDB) su
// TMDB via /find (esatto).
//
//   php scripts/precision-reimport.php <handle> <csv> [--apply]
//
// Dry-run default. In apply: riscrive gli episodi TV Time con quelli esatti,
// conserva gli episodi aggiunti in-app dopo la data di export, ricalcola lo stato.

if (PHP_SAPI !== 'cli') { http_response_code(403); exit('cli only'); }

require_once __DIR__ . '/../api/lib/helpers.php';
require_once __DIR__ . '/../api/lib/db.php';

$apply  = in_array('--apply', $argv, true);
$args   = array_values(array_filter(array_slice($argv, 1), fn($a) => $a !== '--apply'));
$handle = $args[0] ?? '';
$csv    = $args[1] ?? '';
if ($handle === '' || $csv === '' || !is_file($csv)) exit("Uso: php scripts/precision-reimport.php <handle> <csv> [--apply]\n");

$tmdbKey = app_config('tmdb_api_key');
if (!$tmdbKey) exit("ERRORE: tmdb_api_key mancante\n");

$userId = (function () use ($pdo, $handle) {
    $s = $pdo->prepare('SELECT id FROM profiles WHERE handle = ?');
    $s->execute([$handle]);
    return $s->fetchColumn();
})();
if (!$userId) exit("Utente @$handle non trovato\n");

// Data di export: gli episodi segnati dopo (in-app) vanno conservati.
$exportCutoff = date('Y-m-d H:i:s', filemtime($csv));

function tmdb_get(string $path): ?array {
    global $tmdbKey;
    for ($i = 0; $i < 4; $i++) {
        $ch = curl_init("https://api.themoviedb.org/3$path" . (strpos($path, '?') === false ? '?' : '&') . 'api_key=' . urlencode($tmdbKey));
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
        $raw = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code === 200 && $raw) return json_decode($raw, true);
        if ($code === 429) { sleep(2); continue; }
        return null;
    }
    return null;
}

// --- 1) Parse per-episodio: raggruppa per id TV Time (TVDB) ---
$fh = fopen($csv, 'r');
$header = fgetcsv($fh);
$idx = array_flip($header);
foreach (['series_name', 'season_number', 'episode_number', 's_id', 'created_at'] as $col) {
    if (!isset($idx[$col])) exit("Colonna mancante nel CSV: $col\n");
}

$shows = []; // tvdbId => ['name'=>, 'eps'=>[key=>date]]
while (($row = fgetcsv($fh)) !== false) {
    $s  = (int) ($row[$idx['season_number']] ?? 0);
    $e  = (int) ($row[$idx['episode_number']] ?? 0);
    $sid = (int) ($row[$idx['s_id']] ?? 0);
    if ($s < 1 || $e < 1 || $sid <= 0) continue; // salta speciali/film/aggregati
    $key = "S{$s}E{$e}";
    $date = (string) ($row[$idx['created_at']] ?? '');
    if (!isset($shows[$sid])) $shows[$sid] = ['name' => (string) ($row[$idx['series_name']] ?? ''), 'eps' => []];
    // Tieni la data più vecchia (prima visione) per episodio.
    if (!isset($shows[$sid]['eps'][$key]) || ($date && $date < $shows[$sid]['eps'][$key])) {
        $shows[$sid]['eps'][$key] = $date ?: null;
    }
}
fclose($fh);
echo ($apply ? "== APPLY ==" : "== DRY-RUN ==") . " @$handle | file: " . basename($csv) . " (export ~$exportCutoff)\n";
echo "Serie nel file: " . count($shows) . " | episodi unici: " . array_sum(array_map(fn($x) => count($x['eps']), $shows)) . "\n\n";

// --- 2) Per ogni serie: mappa TVDB->TMDB, confronta, calcola stato ---
$curEps = $pdo->prepare('SELECT COUNT(*) FROM user_episodes WHERE user_id = ? AND media_key = ?');
$curStat = $pdo->prepare('SELECT status FROM user_media WHERE user_id = ? AND media_key = ?');

$mapOk = 0; $unmapped = 0; $toComplete = 0; $epsBefore = 0; $epsAfter = 0;
$sampleComplete = []; $sampleBig = [];
$today = date('Y-m-d');

foreach ($shows as $sid => $sh) {
    $find = tmdb_get("/find/$sid?external_source=tvdb_id");
    usleep(80000);
    $tv = $find['tv_results'][0] ?? null;
    if (!$tv) { $unmapped++; continue; }
    $tmdbId = (int) $tv['id'];
    $mapKey = "tv-$tmdbId";
    $mapOk++;

    $newCount = count($sh['eps']);
    $epsAfter += $newCount;
    $curEps->execute([$userId, $mapKey]); $oldCount = (int) $curEps->fetchColumn();
    $epsBefore += $oldCount;
    $curStat->execute([$userId, $mapKey]); $curStatus = (string) ($curStat->fetchColumn() ?: '');

    // Stato proposto: serie conclusa + copertura >= 90% => completata.
    $det = tmdb_get("/tv/$tmdbId");
    usleep(80000);
    $ended = $det && in_array(strtolower((string) ($det['status'] ?? '')), ['ended', 'canceled', 'cancelled'], true);
    $tot = 0;
    if ($det) foreach (($det['seasons'] ?? []) as $ss) if (($ss['season_number'] ?? 0) > 0) $tot += (int) ($ss['episode_count'] ?? 0);
    $newStatus = ($ended && $tot > 0 && $newCount / $tot >= 0.90) ? 'completed' : ($newCount > 0 ? 'watching' : 'plan_to_watch');
    if (in_array($curStatus, ['paused', 'dropped'], true)) $newStatus = $curStatus; // mai retrocedere questi

    if ($newStatus === 'completed' && $curStatus === 'watching') {
        $toComplete++;
        if (count($sampleComplete) < 25) $sampleComplete[] = sprintf("%-34s %d/%d ep", mb_substr($sh['name'], 0, 33), $newCount, $tot);
    }
    if (abs($newCount - $oldCount) >= 5 && count($sampleBig) < 20) {
        $sampleBig[] = sprintf("%-30s %3d -> %3d ep  [%s]", mb_substr($sh['name'], 0, 29), $oldCount, $newCount, $mapKey);
    }
}

echo "Mappate TVDB->TMDB: $mapOk | non mappate: $unmapped\n";
echo "Episodi in libreria: $epsBefore  ->  $epsAfter (dai dati esatti)\n";
echo "Serie che passerebbero 'in corso' -> 'completata': $toComplete\n\n";
echo "Esempi completamento:\n";
foreach ($sampleComplete as $s) echo "  $s\n";
echo "\nEsempi con conteggio episodi molto diverso:\n";
foreach ($sampleBig as $s) echo "  $s\n";
if (!$apply) echo "\n(DRY-RUN: nessuna modifica) — rilancia con --apply per applicare.\n";
