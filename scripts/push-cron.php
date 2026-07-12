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
