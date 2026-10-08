<?php
// Nerdacolo di gruppo: votazione 👍/👎 sui migliori candidati, ognuno dal
// proprio telefono. Solo i membri del gruppo vedono e votano.
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/webpush.php';
cors();

$action = $_GET['action'] ?? '';
$body   = body();
$jwt    = require_auth();
$uid    = $jwt['sub'];

const VOTE_TTL_HOURS = 24;
const VOTE_MAX_CANDIDATES = 8;

function nv_is_member(PDO $pdo, string $groupId, string $userId): bool {
    $s = $pdo->prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?');
    $s->execute([$groupId, $userId]);
    return (bool) $s->fetchColumn();
}

function nv_load_session(PDO $pdo, string $id, string $userId): array {
    $s = $pdo->prepare('SELECT * FROM nerdacolo_vote_sessions WHERE id = ?');
    $s->execute([$id]);
    $row = $s->fetch();
    if (!$row) api_err('not_found', 404);
    if (!nv_is_member($pdo, $row['group_id'], $userId)) api_err('not_group_member', 403);
    return $row;
}

/** Testo della push nella lingua di chi la riceve. */
function nv_push_text(string $lang, string $name, string $group): array {
    $t = [
        'it' => ['🔮 Si vota!', "$name chiede a «$group» cosa guardare stasera: dai il tuo voto."],
        'en' => ['🔮 Time to vote!', "$name is asking «$group» what to watch tonight: cast your vote."],
        'es' => ['🔮 ¡A votar!', "$name pregunta a «$group» qué ver esta noche: da tu voto."],
        'fr' => ['🔮 On vote !', "$name demande à «$group» quoi regarder ce soir : donne ton avis."],
        'de' => ['🔮 Abstimmung!', "$name fragt «$group», was heute Abend läuft: stimm ab."],
    ];
    return $t[$lang] ?? $t['it'];
}

// --- Crea una votazione dai candidati del Nerdacolo ----------------------
if ($action === 'vote_create') {
    $groupId = (string) ($body['group_id'] ?? '');
    if ($groupId === '' || !nv_is_member($pdo, $groupId, $uid)) api_err('not_group_member', 403);

    $clean = [];
    foreach (array_slice(is_array($body['candidates'] ?? null) ? $body['candidates'] : [], 0, VOTE_MAX_CANDIDATES) as $c) {
        $key = (string) ($c['mediaKey'] ?? '');
        if (!preg_match('/^(tv|movie)-\d+$/', $key)) continue;
        $poster = (string) ($c['posterPath'] ?? '');
        $clean[] = [
            'mediaKey'    => $key,
            'tmdbId'      => (int) ($c['tmdbId'] ?? 0),
            'mediaType'   => str_starts_with($key, 'tv-') ? 'tv' : 'movie',
            'title'       => mb_substr((string) ($c['title'] ?? ''), 0, 200),
            'releaseYear' => isset($c['releaseYear']) ? (int) $c['releaseYear'] : null,
            'posterPath'  => preg_match('#^https://image\.tmdb\.org/#', $poster) ? $poster : null,
        ];
    }
    if (count($clean) < 2) api_err('not_enough_candidates', 400);

    $id = uuid();
    $pdo->prepare(
        'INSERT INTO nerdacolo_vote_sessions (id, group_id, created_by, candidates, expires_at)
         VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ' . VOTE_TTL_HOURS . ' HOUR))'
    )->execute([$id, $groupId, $uid, json_encode($clean, JSON_UNESCAPED_UNICODE)]);

    // Avvisa gli altri membri (best effort: senza push semplicemente non arriva).
    $meta = $pdo->prepare(
        'SELECT g.name AS group_name, COALESCE(p.display_name, p.handle) AS me
         FROM groups g LEFT JOIN profiles p ON p.id = ? WHERE g.id = ?'
    );
    $meta->execute([$uid, $groupId]);
    $m = $meta->fetch() ?: ['group_name' => '', 'me' => ''];
    $others = $pdo->prepare(
        'SELECT gm.user_id, COALESCE(us.language, "it") AS lang
         FROM group_members gm LEFT JOIN user_stats us ON us.user_id = gm.user_id
         WHERE gm.group_id = ? AND gm.user_id <> ?'
    );
    $others->execute([$groupId, $uid]);
    foreach ($others->fetchAll() as $o) {
        [$title, $text] = nv_push_text((string) $o['lang'], (string) $m['me'], (string) $m['group_name']);
        try {
            wp_send_to_user($pdo, $o['user_id'], ['title' => $title, 'body' => $text, 'url' => "/voto/$id"]);
        } catch (Throwable $e) { /* best effort */ }
    }
    json_out(['id' => $id]);
}

// --- Stato della votazione (candidati, conteggi, miei voti) --------------
if ($action === 'vote_get') {
    $row = nv_load_session($pdo, (string) ($_GET['id'] ?? ''), $uid);

    $tally = [];
    $mine = [];
    $voters = [];
    $v = $pdo->prepare('SELECT user_id, media_key, vote FROM nerdacolo_votes WHERE session_id = ?');
    $v->execute([$row['id']]);
    foreach ($v->fetchAll() as $x) {
        $k = $x['media_key'];
        $tally[$k] ??= ['yes' => 0, 'no' => 0];
        if ((int) $x['vote'] > 0) $tally[$k]['yes']++;
        else $tally[$k]['no']++;
        if ($x['user_id'] === $uid) $mine[$k] = (int) $x['vote'];
        $voters[$x['user_id']] = true;
    }

    $info = $pdo->prepare(
        'SELECT g.name, COALESCE(p.display_name, p.handle) AS creator,
                (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS members
         FROM groups g LEFT JOIN profiles p ON p.id = ? WHERE g.id = ?'
    );
    $info->execute([$row['created_by'], $row['group_id']]);
    $i = $info->fetch() ?: ['name' => '', 'creator' => '', 'members' => 0];

    json_out([
        'id'          => $row['id'],
        'groupName'   => $i['name'],
        'createdBy'   => $i['creator'],
        'isCreator'   => $row['created_by'] === $uid,
        'expired'     => strtotime($row['expires_at']) < time(),
        'memberCount' => (int) $i['members'],
        'voterCount'  => count($voters),
        'candidates'  => json_decode($row['candidates'], true) ?: [],
        'tally'       => (object) $tally,
        'myVotes'     => (object) $mine,
    ]);
}

// --- Vota (1 = sì, -1 = no, 0 = togli il voto) ---------------------------
if ($action === 'vote_cast') {
    $row = nv_load_session($pdo, (string) ($body['id'] ?? ''), $uid);
    if (strtotime($row['expires_at']) < time()) api_err('vote_expired', 410);
    $key = (string) ($body['media_key'] ?? '');
    $keys = array_column(json_decode($row['candidates'], true) ?: [], 'mediaKey');
    if (!in_array($key, $keys, true)) api_err('bad_candidate', 400);
    $vote = (int) ($body['vote'] ?? 0);

    if ($vote === 0) {
        $pdo->prepare('DELETE FROM nerdacolo_votes WHERE session_id = ? AND user_id = ? AND media_key = ?')
            ->execute([$row['id'], $uid, $key]);
    } else {
        $pdo->prepare(
            'INSERT INTO nerdacolo_votes (session_id, user_id, media_key, vote) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE vote = VALUES(vote)'
        )->execute([$row['id'], $uid, $key, $vote > 0 ? 1 : -1]);
    }
    json_out(['ok' => true]);
}

api_err('unknown_action', 400);
