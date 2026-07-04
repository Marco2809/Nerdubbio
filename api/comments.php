<?php
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/comments.php';
cors();

$action = $_GET['action'] ?? '';
$body   = body();
$jwt    = require_auth();
$userId = (string) $jwt['sub'];

if ($action === 'list') {
    $mediaType = (string) ($_GET['type'] ?? $body['type'] ?? '');
    $tmdbId    = (int) ($_GET['tmdb_id'] ?? $body['tmdb_id'] ?? 0);
    $scope     = (string) ($_GET['scope'] ?? $body['scope'] ?? 'all');
    $offset    = (int) ($_GET['offset'] ?? $body['offset'] ?? 0);
    json_out(comments_list($pdo, $userId, $mediaType, $tmdbId, $scope, $offset));
}

if ($action === 'create') {
    json_out(comments_create(
        $pdo,
        $userId,
        (string) ($body['type'] ?? ''),
        (int) ($body['tmdb_id'] ?? 0),
        (string) ($body['body'] ?? ''),
        !empty($body['spoiler']),
    ));
}

if ($action === 'delete') {
    json_out(comments_delete($pdo, $userId, (string) ($body['id'] ?? '')));
}

json_out(['error' => 'Azione non valida'], 400);
