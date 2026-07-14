<?php
// Rileva (e in modalità --apply corregge) le serie agganciate all'omonimo
// TMDB sbagliato: es. episodi di Scrubs (2001, 9 stagioni) finiti sul revival
// con 1 stagione. Euristica: se l'utente ha segnato una stagione superiore al
// numero di stagioni della serie agganciata, l'aggancio è sospetto.
//
//   php scripts/realign-homonyms.php            # dry-run: stampa e basta
//   php scripts/realign-homonyms.php --apply    # applica le rimappature
//
// Richiede tmdb_api_key in api/config.php.

if (PHP_SAPI !== 'cli') { http_response_code(403); exit('cli only'); }

require_once __DIR__ . '/../api/lib/helpers.php';
require_once __DIR__ . '/../api/lib/db.php';

$apply = in_array('--apply', $argv, true);
$tmdbKey = app_config('tmdb_api_key');
if (!$tmdbKey) exit("ERRORE: tmdb_api_key mancante in api/config.php\n");

function tmdb_get(string $path, array $params = []): ?array {
    global $tmdbKey;
    $params['api_key'] = $tmdbKey;
    $ch = curl_init('https://api.themoviedb.org/3' . $path . '?' . http_build_query($params));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 12]);
    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code === 404) return ['__404' => true];
    if ($code !== 200 || !$raw) return null;
    $d = json_decode($raw, true);
    return is_array($d) ? $d : null;
}

// 1) Entry TV + stagione massima segnata dall'utente.
$rows = $pdo->query(
    "SELECT um.user_id, um.media_key, um.title, um.status,
            COALESCE(p.handle, um.user_id) AS handle,
            (SELECT MAX(ue.season) FROM user_episodes ue
              WHERE ue.user_id = um.user_id AND ue.media_key = um.media_key) AS max_season,
            (SELECT MAX(ue.episode) FROM user_episodes ue
              WHERE ue.user_id = um.user_id AND ue.media_key = um.media_key
                AND ue.season = (SELECT MAX(season) FROM user_episodes
                                 WHERE user_id = um.user_id AND media_key = um.media_key)) AS max_ep
     FROM user_media um
     LEFT JOIN profiles p ON p.id = um.user_id
     WHERE um.media_key LIKE 'tv-%'"
)->fetchAll();

$showCache = [];   // tmdb_id -> ['seasons'=>n, 'name'=>..., '404'=>bool]
$suspects = 0;
$fixable = 0;

echo ($apply ? "== APPLY ==\n" : "== DRY-RUN (nessuna modifica) ==\n");

foreach ($rows as $r) {
    $maxSeason = (int) ($r['max_season'] ?? 0);
    if ($maxSeason <= 0) continue; // senza episodi non c'è nulla da validare

    $tmdbId = (int) substr($r['media_key'], 3);
    if ($tmdbId <= 0) continue;

    if (!isset($showCache[$tmdbId])) {
        $d = tmdb_get("/tv/$tmdbId");
        $showCache[$tmdbId] = $d === null
            ? null
            : [
                'seasons' => (int) ($d['number_of_seasons'] ?? 0),
                'name'    => (string) ($d['name'] ?? ''),
                '404'     => !empty($d['__404']),
              ];
        usleep(120000); // gentile con TMDB
    }
    $show = $showCache[$tmdbId];
    if ($show === null) continue; // errore rete: non giudicare

    $broken = $show['404'] || ($show['seasons'] > 0 && $maxSeason > $show['seasons']);
    if (!$broken) continue;

    $suspects++;
    $why = $show['404'] ? 'serie rimossa da TMDB' : "ha {$show['seasons']} stagioni, visto fino a S{$maxSeason}E{$r['max_ep']}";
    echo "@{$r['handle']}: \"{$r['title']}\" ({$r['media_key']}) SOSPETTA — $why\n";

    // 2) Candidato giusto: omonimo con abbastanza stagioni e più voti storici.
    $search = tmdb_get('/search/tv', ['query' => (string) $r['title'], 'language' => 'it-IT']);
    $best = null;
    foreach (array_slice($search['results'] ?? [], 0, 5) as $c) {
        if ((int) $c['id'] === $tmdbId) continue;
        $det = tmdb_get('/tv/' . (int) $c['id']);
        usleep(120000);
        if (!$det || !empty($det['__404'])) continue;
        if ((int) ($det['number_of_seasons'] ?? 0) < $maxSeason) continue;
        $votes = (int) ($c['vote_count'] ?? 0);
        if ($best === null || $votes > $best['votes']) {
            $best = [
                'id'      => (int) $c['id'],
                'name'    => (string) ($c['name'] ?? ''),
                'year'    => substr((string) ($c['first_air_date'] ?? ''), 0, 4),
                'seasons' => (int) ($det['number_of_seasons'] ?? 0),
                'votes'   => $votes,
            ];
        }
    }

    if (!$best) {
        echo "   -> nessun candidato adatto trovato: lascio com'è\n";
        continue;
    }

    $newKey = 'tv-' . $best['id'];
    $fixable++;
    echo "   -> rimappa su \"{$best['name']}\" ({$best['year']}, {$best['seasons']} stagioni, {$best['votes']} voti) [$newKey]\n";

    if (!$apply) continue;

    // 3) Rimappatura con merge: il dato più recente vince, gli episodi si sommano.
    $pdo->beginTransaction();
    try {
        $exists = $pdo->prepare('SELECT 1 FROM user_media WHERE user_id = ? AND media_key = ?');
        $exists->execute([$r['user_id'], $newKey]);
        if ($exists->fetch()) {
            // Entry di destinazione già presente: sposta gli episodi mancanti e togli la vecchia.
            $pdo->prepare(
                'INSERT IGNORE INTO user_episodes (user_id, media_key, season, episode, watched_at, watch_count)
                 SELECT user_id, ?, season, episode, watched_at, watch_count
                 FROM user_episodes WHERE user_id = ? AND media_key = ?'
            )->execute([$newKey, $r['user_id'], $r['media_key']]);
            $pdo->prepare('DELETE FROM user_episodes WHERE user_id = ? AND media_key = ?')
                ->execute([$r['user_id'], $r['media_key']]);
            $pdo->prepare('DELETE FROM user_media WHERE user_id = ? AND media_key = ?')
                ->execute([$r['user_id'], $r['media_key']]);
        } else {
            $pdo->prepare('UPDATE user_media SET media_key = ?, title = ? WHERE user_id = ? AND media_key = ?')
                ->execute([$newKey, $best['name'] ?: $r['title'], $r['user_id'], $r['media_key']]);
            $pdo->prepare('UPDATE user_episodes SET media_key = ? WHERE user_id = ? AND media_key = ?')
                ->execute([$newKey, $r['user_id'], $r['media_key']]);
        }
        $pdo->commit();
        echo "   -> APPLICATO\n";
    } catch (Throwable $e) {
        $pdo->rollBack();
        echo '   -> ERRORE: ' . $e->getMessage() . "\n";
    }
}

echo "\nTotale entry TV analizzate: " . count($rows) . " | sospette: $suspects | rimappabili: $fixable\n";
if (!$apply && $fixable > 0) echo "Rilancia con --apply per applicare.\n";
