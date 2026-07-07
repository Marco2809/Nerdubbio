<?php
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/library.php';
cors();

$action = $_GET['action'] ?? '';
$body   = body();
$jwt    = require_auth();
$userId = (string) $jwt['sub'];

if ($action === 'get') {
    json_out(library_fetch_state($pdo, $userId));
}

if ($action === 'patch_settings') {
    json_out(library_patch_settings($pdo, $userId, $body));
}

if ($action === 'add_to_list') {
    $id = (string) ($body['id'] ?? '');
    $status = (string) ($body['status'] ?? 'plan_to_watch');
    if ($id === '') api_err('missing_id', 400);
    json_out(library_add_to_list($pdo, $userId, $id, $status, $body['meta'] ?? null));
}

if ($action === 'set_status') {
    $id = (string) ($body['id'] ?? '');
    $status = (string) ($body['status'] ?? 'plan_to_watch');
    if ($id === '') api_err('missing_id', 400);
    json_out(library_set_status($pdo, $userId, $id, $status, is_array($body['meta'] ?? null) ? $body['meta'] : null));
}

if ($action === 'set_favorite') {
    $id = (string) ($body['id'] ?? '');
    if ($id === '') api_err('missing_id', 400);
    json_out(library_set_favorite(
        $pdo,
        $userId,
        $id,
        !empty($body['favorite']),
        is_array($body['meta'] ?? null) ? $body['meta'] : null,
    ));
}

if ($action === 'remove_from_list') {
    $id = (string) ($body['id'] ?? '');
    if ($id === '') api_err('missing_id', 400);
    json_out(library_remove_from_list($pdo, $userId, $id));
}

if ($action === 'dismiss') {
    $id = (string) ($body['id'] ?? '');
    if ($id === '') api_err('missing_id', 400);
    json_out(library_dismiss($pdo, $userId, $id));
}

if ($action === 'toggle_episode') {
    $id = (string) ($body['id'] ?? '');
    if ($id === '') api_err('missing_id', 400);
    json_out(library_toggle_episode(
        $pdo,
        $userId,
        $id,
        (int) ($body['season'] ?? 0),
        (int) ($body['episode'] ?? 0),
        (int) ($body['episodesPerSeason'] ?? 1),
        (int) ($body['totalSeasons'] ?? 1),
        is_array($body['meta'] ?? null) ? $body['meta'] : null,
        !empty($body['unwatch']),
    ));
}

if ($action === 'log_movie_watch') {
    $id = (string) ($body['id'] ?? '');
    if ($id === '') api_err('missing_id', 400);
    json_out(library_log_movie_watch(
        $pdo,
        $userId,
        $id,
        is_array($body['meta'] ?? null) ? $body['meta'] : null,
    ));
}

if ($action === 'mark_all_watched') {
    $id = (string) ($body['id'] ?? '');
    if ($id === '') api_err('missing_id', 400);
    json_out(library_mark_all_watched(
        $pdo,
        $userId,
        $id,
        is_array($body['seasons'] ?? null) ? $body['seasons'] : [],
        !empty($body['onlyAired']),
        $body['meta'] ?? null,
    ));
}

if ($action === 'clear_watched') {
    $id = (string) ($body['id'] ?? '');
    if ($id === '') api_err('missing_id', 400);
    json_out(library_clear_watched($pdo, $userId, $id, $body['restoreStatus'] ?? null));
}

if ($action === 'set_rating') {
    $id = (string) ($body['id'] ?? '');
    if ($id === '') api_err('missing_id', 400);
    $rating = array_key_exists('rating', $body) && $body['rating'] !== null ? (int) $body['rating'] : null;
    json_out(library_set_rating($pdo, $userId, $id, $rating));
}

if ($action === 'set_reaction') {
    $id = (string) ($body['id'] ?? '');
    if ($id === '') api_err('missing_id', 400);
    json_out(library_set_reaction(
        $pdo,
        $userId,
        $id,
        (int) ($body['season'] ?? 0),
        (int) ($body['episode'] ?? 0),
        isset($body['emoji']) ? (string) $body['emoji'] : null,
    ));
}

if ($action === 'bulk_import') {
    $entries = is_array($body['entries'] ?? null) ? $body['entries'] : [];
    $importPending = array_key_exists('importPending', $body) && is_array($body['importPending'])
        ? $body['importPending']
        : null;
    $withXp = !array_key_exists('withXp', $body) || $body['withXp'] !== false;
    $replaceEpisodes = !empty($body['replaceEpisodes']);
    $mergeImport = !empty($body['mergeImport']);
    json_out(library_bulk_import($pdo, $userId, $entries, $withXp, $importPending, $replaceEpisodes, $mergeImport));
}

if ($action === 'repair_cleanup') {
    $keepIds = is_array($body['keepIds'] ?? null) ? $body['keepIds'] : [];
    $removed = library_repair_cleanup($pdo, $userId, $keepIds);
    $state = library_fetch_state($pdo, $userId);
    $state['repairRemoved'] = $removed;
    json_out($state);
}

if ($action === 'import_local') {
    json_out(library_import_local($pdo, $userId, $body));
}

if ($action === 'skip_local_migration') {
    json_out(library_skip_local_migration($pdo, $userId));
}

if ($action === 'watch_stats') {
    json_out(library_fetch_watch_stats($pdo, $userId));
}

api_err('invalid_action', 400);
