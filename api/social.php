<?php
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/social.php';
cors();

$action = $_GET['action'] ?? '';
$body   = body();

if ($action === 'public_profile') {
    $handle = strtolower(trim($_GET['handle'] ?? ($body['handle'] ?? '')));
    $profile = social_public_profile($pdo, $handle);
    if (!$profile) api_err('profile_not_found', 404);
    json_out($profile);
}

$jwt    = require_auth();
$userId = (string) $jwt['sub'];

if ($action === 'search') {
    json_out(social_search_users($pdo, $userId, (string) ($_GET['q'] ?? $body['q'] ?? '')));
}

if ($action === 'friends') {
    json_out(social_friends_list($pdo, $userId));
}

if ($action === 'friend_request') {
    json_out(social_send_friend_request($pdo, $userId, (string) ($body['handle'] ?? '')));
}

if ($action === 'friend_respond') {
    json_out(social_respond_friend(
        $pdo,
        $userId,
        (string) ($body['user_id'] ?? ''),
        !empty($body['accept']),
    ));
}

if ($action === 'friend_remove') {
    json_out(social_remove_friend($pdo, $userId, (string) ($body['user_id'] ?? '')));
}

if ($action === 'groups') {
    json_out(['groups' => social_groups_list($pdo, $userId)]);
}

if ($action === 'group_create') {
    json_out(['groups' => social_group_create($pdo, $userId, (string) ($body['name'] ?? ''))]);
}

if ($action === 'group_add_member') {
    json_out(['groups' => social_group_add_member(
        $pdo,
        $userId,
        (string) ($body['group_id'] ?? ''),
        (string) ($body['handle'] ?? ''),
    )]);
}

if ($action === 'group_remove_member') {
    json_out(['groups' => social_group_remove_member(
        $pdo,
        $userId,
        (string) ($body['group_id'] ?? ''),
        (string) ($body['user_id'] ?? ''),
    )]);
}

if ($action === 'group_delete') {
    json_out(['groups' => social_group_delete($pdo, $userId, (string) ($body['group_id'] ?? ''))]);
}

api_err('invalid_action', 400);
