<?php
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/webpush.php';
cors();

$action = $_GET['action'] ?? '';
$body   = body();
$jwt    = require_auth();
$userId = (string) $jwt['sub'];

if ($action === 'vapid_key') {
    [$publicKey] = wp_vapid_keys($pdo);
    json_out(['publicKey' => $publicKey]);
}

if ($action === 'subscribe') {
    $endpoint = trim((string) ($body['endpoint'] ?? ''));
    $p256dh   = trim((string) ($body['p256dh'] ?? ''));
    $auth     = trim((string) ($body['auth'] ?? ''));
    if ($endpoint === '' || !preg_match('#^https://#', $endpoint) || $p256dh === '' || $auth === '') {
        api_err('push_bad_subscription', 400);
    }
    $stmt = $pdo->prepare(
        'INSERT INTO push_subscriptions (user_id, endpoint_hash, endpoint, p256dh, auth)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)'
    );
    $stmt->execute([$userId, hash('sha256', $endpoint), $endpoint, $p256dh, $auth]);
    json_out(['ok' => true]);
}

if ($action === 'unsubscribe') {
    $endpoint = trim((string) ($body['endpoint'] ?? ''));
    if ($endpoint === '') api_err('push_bad_subscription', 400);
    $pdo->prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint_hash = ?')
        ->execute([$userId, hash('sha256', $endpoint)]);
    json_out(['ok' => true]);
}

if ($action === 'status') {
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM push_subscriptions WHERE user_id = ?');
    $stmt->execute([$userId]);
    json_out(['subscriptions' => (int) $stmt->fetchColumn()]);
}

if ($action === 'test') {
    $sent = wp_send_to_user($pdo, $userId, [
        'title' => 'Nerdubbio',
        'body'  => (string) ($body['message'] ?? 'Le notifiche funzionano! 🎉'),
        'url'   => '/app',
    ]);
    json_out(['sent' => $sent]);
}

// --- Reminder server-side (specchio di quelli locali; il cron li notifica) ---

if ($action === 'reminder_add') {
    $itemId  = trim((string) ($body['item_id'] ?? ''));
    $tmdbId  = (int) ($body['tmdb_id'] ?? 0);
    $title   = trim((string) ($body['title'] ?? ''));
    $label   = trim((string) ($body['label'] ?? ''));
    $airDate = trim((string) ($body['air_date'] ?? ''));
    $href    = trim((string) ($body['href'] ?? ''));
    if ($itemId === '' || $tmdbId <= 0 || $title === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $airDate)) {
        api_err('reminder_invalid', 400);
    }
    $stmt = $pdo->prepare(
        'INSERT INTO user_reminders (user_id, item_id, tmdb_id, title, label, air_date, href)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE title = VALUES(title), label = VALUES(label),
           air_date = VALUES(air_date), href = VALUES(href), notified_at = NULL'
    );
    $stmt->execute([
        $userId, mb_substr($itemId, 0, 64), $tmdbId, mb_substr($title, 0, 255),
        mb_substr($label, 0, 120), $airDate, mb_substr($href, 0, 255),
    ]);
    json_out(['ok' => true]);
}

if ($action === 'reminder_remove') {
    $itemId = trim((string) ($body['item_id'] ?? ''));
    if ($itemId === '') api_err('reminder_invalid', 400);
    $pdo->prepare('DELETE FROM user_reminders WHERE user_id = ? AND item_id = ?')
        ->execute([$userId, mb_substr($itemId, 0, 64)]);
    json_out(['ok' => true]);
}

api_err('unknown_action', 400);
