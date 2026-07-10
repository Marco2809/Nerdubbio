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
    $season    = isset($_GET['season']) && $_GET['season'] !== '' ? (int) $_GET['season'] : null;
    $episode   = isset($_GET['episode']) && $_GET['episode'] !== '' ? (int) $_GET['episode'] : null;
    json_out(comments_list($pdo, $userId, $mediaType, $tmdbId, $scope, $offset, $season, $episode));
}

if ($action === 'replies') {
    $parentId = (string) ($_GET['parent_id'] ?? $body['parent_id'] ?? '');
    if ($parentId === '') api_err('missing_parent', 400);
    json_out(comments_replies($pdo, $userId, $parentId));
}

if ($action === 'create') {
    $rating = array_key_exists('rating', $body) && $body['rating'] !== null && $body['rating'] !== ''
        ? (int) $body['rating'] : null;
    json_out(comments_create(
        $pdo,
        $userId,
        (string) ($body['type'] ?? ''),
        (int) ($body['tmdb_id'] ?? 0),
        (string) ($body['body'] ?? ''),
        !empty($body['spoiler']),
        isset($body['season']) && $body['season'] !== null && $body['season'] !== '' ? (int) $body['season'] : null,
        isset($body['episode']) && $body['episode'] !== null && $body['episode'] !== '' ? (int) $body['episode'] : null,
        isset($body['parent_id']) && $body['parent_id'] !== '' ? (string) $body['parent_id'] : null,
        $rating,
    ));
}

if ($action === 'delete') {
    json_out(comments_delete($pdo, $userId, (string) ($body['id'] ?? '')));
}

api_err('invalid_action', 400);
