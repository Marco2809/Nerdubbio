<?php
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/recommend.php';
cors();

$action = $_GET['action'] ?? '';
$body   = body();
$jwt    = require_auth();
$userId = (string) $jwt['sub'];

if ($action === 'friends_for') {
    $mediaKey = (string) ($_GET['media_key'] ?? ($body['mediaKey'] ?? ''));
    if ($mediaKey === '') api_err('missing_media', 400);
    json_out(recommend_friends_for($pdo, $userId, $mediaKey));
}

if ($action === 'send') {
    json_out(recommend_send($pdo, $userId, $body));
}

if ($action === 'received') {
    json_out(recommend_received($pdo, $userId));
}

if ($action === 'act') {
    $id = (string) ($body['id'] ?? '');
    $act = in_array($body['action'] ?? '', ['add', 'dismiss', 'restore'], true) ? (string) $body['action'] : 'dismiss';
    if ($id === '') api_err('missing_id', 400);
    json_out(recommend_act($pdo, $userId, $id, $act));
}

if ($action === 'sent_feedback') {
    json_out(recommend_sent_feedback($pdo, $userId));
}

if ($action === 'sent_ack') {
    $id = (string) ($body['id'] ?? '');
    json_out(recommend_sent_ack($pdo, $userId, $id !== '' ? $id : null));
}

api_err('invalid_action', 400);
