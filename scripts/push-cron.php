<?php
// Invia le notifiche push per i reminder in scadenza (premiere/episodi usciti oggi).
// Da eseguire via cron (una o due volte al giorno), dalla root del progetto:
//   0 9,17 * * * php /var/www/demos/nerdubbio/scripts/push-cron.php >> /var/log/nerdubbio-push.log 2>&1

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('cli only');
}

require_once __DIR__ . '/../api/lib/helpers.php';
require_once __DIR__ . '/../api/lib/db.php';
require_once __DIR__ . '/../api/lib/webpush.php';

$today = date('Y-m-d');

$due = $pdo->prepare(
    'SELECT r.id, r.user_id, r.title, r.label, r.href
     FROM user_reminders r
     WHERE r.air_date <= ? AND r.notified_at IS NULL
     ORDER BY r.user_id'
);
$due->execute([$today]);
$rows = $due->fetchAll();

$mark = $pdo->prepare('UPDATE user_reminders SET notified_at = NOW() WHERE id = ?');

$sent = 0;
foreach ($rows as $r) {
    $ok = wp_send_to_user($pdo, $r['user_id'], [
        'title' => 'Nerdubbio 📺',
        'body'  => $r['title'] . ($r['label'] !== '' ? ' — ' . $r['label'] : '') . ' è disponibile!',
        'url'   => $r['href'] !== '' ? $r['href'] : '/prossimi',
    ]);
    // Marca comunque: evita ri-invii infiniti se l'utente non ha subscription.
    $mark->execute([$r['id']]);
    $sent += $ok;
}

echo date('c') . " reminders=" . count($rows) . " push_sent=$sent\n";

// ---------------------------------------------------------------------------
// Push automatiche "esce oggi": per le serie IN CORSO degli utenti con push
// attive, controlla su TMDB se oggi esce un episodio. Una chiamata TMDB per
// serie distinta (non per utente); log anti-duplicato in push_airing_log.
// Richiede tmdb_api_key in config.php: senza, questa parte viene saltata.
// ---------------------------------------------------------------------------

$tmdbKey = app_config('tmdb_api_key');
if (!$tmdbKey) {
    echo "airing: skipped (tmdb_api_key mancante)\n";
    exit;
}

$watching = $pdo->query(
    "SELECT um.user_id, um.media_key, um.title
     FROM user_media um
     WHERE um.status = 'watching' AND um.media_key LIKE 'tv-%'
       AND um.user_id IN (SELECT DISTINCT user_id FROM push_subscriptions)"
)->fetchAll();

$byShow = [];
foreach ($watching as $w) {
    $byShow[$w['media_key']]['title'] = $w['title'] ?: $w['media_key'];
    $byShow[$w['media_key']]['users'][] = $w['user_id'];
}

$logIns = $pdo->prepare(
    'INSERT IGNORE INTO push_airing_log (user_id, media_key, air_date) VALUES (?, ?, ?)'
);

$airSent = 0;
$checked = 0;
foreach ($byShow as $mediaKey => $show) {
    $tmdbId = (int) substr($mediaKey, 3);
    if ($tmdbId <= 0) continue;
    $checked++;

    $ch = curl_init("https://api.themoviedb.org/3/tv/$tmdbId?api_key=" . urlencode($tmdbKey));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
    $raw = curl_exec($ch);
    curl_close($ch);
    if (!$raw) continue;
    $data = json_decode($raw, true);
    if (!is_array($data)) continue;

    // Episodio che esce oggi: next_episode_to_air (non ancora marcato uscito)
    // o last_episode_to_air con data odierna.
    $ep = null;
    foreach (['next_episode_to_air', 'last_episode_to_air'] as $f) {
        if (($data[$f]['air_date'] ?? '') === $today) { $ep = $data[$f]; break; }
    }
    if (!$ep) continue;

    $label = 'S' . (int) ($ep['season_number'] ?? 0) . 'E' . (int) ($ep['episode_number'] ?? 0);
    foreach (array_unique($show['users']) as $uid) {
        // INSERT IGNORE come gate: se la riga esiste già (run delle 9), salta.
        $logIns->execute([$uid, $mediaKey, $today]);
        if ($logIns->rowCount() === 0) continue;
        $airSent += wp_send_to_user($pdo, $uid, [
            'title' => 'Nerdubbio 🍿',
            'body'  => $label . ' di ' . $show['title'] . ' esce oggi!',
            'url'   => '/media/tv/' . $tmdbId,
        ]);
    }
}

echo date('c') . " airing: shows_checked=$checked push_sent=$airSent\n";
