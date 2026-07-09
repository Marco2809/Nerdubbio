<?php

// Consigli tra amici. Un titolo si può consigliare solo a chi non l'ha già visto.

/** Stato di un titolo nella libreria di un utente: 'seen' | 'listed' | 'new'. */
function recommend_state_from(?string $status, int $watchCount): string {
    if ($status === null) return 'new';
    if (in_array($status, ['completed', 'dropped', 'watching'], true) || $watchCount > 0) return 'seen';
    if ($status === 'plan_to_watch') return 'listed';
    return 'new';
}

/** Id degli amici accettati (in entrambe le direzioni). */
function recommend_friend_ids(PDO $pdo, string $userId): array {
    $stmt = $pdo->prepare(
        "SELECT CASE WHEN user_id = ? THEN friend_id ELSE user_id END AS fid
         FROM friendships
         WHERE (user_id = ? OR friend_id = ?) AND status = 'accepted'"
    );
    $stmt->execute([$userId, $userId, $userId]);
    return array_map(fn ($r) => (string) $r['fid'], $stmt->fetchAll());
}

/** Amici annotati con lo stato del titolo (per il selettore). */
function recommend_friends_for(PDO $pdo, string $userId, string $mediaKey): array {
    $ids = recommend_friend_ids($pdo, $userId);
    if (!$ids) return ['friends' => []];

    $ph = implode(',', array_fill(0, count($ids), '?'));

    $cards = $pdo->prepare(
        "SELECT id, handle, display_name, avatar_url FROM profiles WHERE id IN ($ph)"
    );
    $cards->execute($ids);
    $profiles = [];
    foreach ($cards->fetchAll() as $p) $profiles[(string) $p['id']] = $p;

    $seen = $pdo->prepare(
        "SELECT user_id, status, watch_count FROM user_media
         WHERE media_key = ? AND user_id IN ($ph)"
    );
    $seen->execute(array_merge([$mediaKey], $ids));
    $state = [];
    foreach ($seen->fetchAll() as $r) {
        $state[(string) $r['user_id']] = recommend_state_from($r['status'], (int) $r['watch_count']);
    }

    $sentStmt = $pdo->prepare('SELECT to_user FROM recommendations WHERE from_user = ? AND media_key = ?');
    $sentStmt->execute([$userId, $mediaKey]);
    $sent = array_column($sentStmt->fetchAll(), 'to_user');
    $sent = array_flip(array_map('strval', $sent));

    $friends = [];
    foreach ($ids as $fid) {
        $p = $profiles[$fid] ?? null;
        if (!$p) continue;
        $friends[] = [
            'id'           => $fid,
            'handle'       => $p['handle'],
            'display_name' => $p['display_name'],
            'avatar_url'   => $p['avatar_url'],
            'state'        => $state[$fid] ?? 'new',
            'alreadySent'  => isset($sent[$fid]),
        ];
    }
    // Ordine: chi può ancora vederla prima, chi l'ha vista in fondo.
    usort($friends, fn ($a, $b) => ($a['state'] === 'seen' ? 1 : 0) - ($b['state'] === 'seen' ? 1 : 0));
    return ['friends' => $friends];
}

function recommend_send(PDO $pdo, string $userId, array $body): array {
    $mediaKey = (string) ($body['mediaKey'] ?? '');
    if ($mediaKey === '') api_err('missing_media', 400);
    $friendIds = is_array($body['friendIds'] ?? null) ? array_map('strval', $body['friendIds']) : [];
    if (!$friendIds) api_err('no_recipients', 400);

    $accepted = array_flip(recommend_friend_ids($pdo, $userId));
    $mediaType = ($body['mediaType'] ?? '') === 'movie' ? 'movie' : (($body['mediaType'] ?? '') === 'tv' ? 'tv' : null);
    $title    = mb_substr((string) ($body['title'] ?? ''), 0, 255);
    $poster   = $body['posterUrl'] ? mb_substr((string) $body['posterUrl'], 0, 512) : null;
    $year     = isset($body['year']) && $body['year'] !== null ? (int) $body['year'] : null;
    $message  = isset($body['message']) ? mb_substr(trim((string) $body['message']), 0, 500) : null;
    if ($message === '') $message = null;

    $ins = $pdo->prepare(
        'INSERT INTO recommendations (id, from_user, to_user, media_key, media_type, title, poster_url, year, message, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, \'pending\')
         ON DUPLICATE KEY UPDATE message = VALUES(message), title = VALUES(title),
           poster_url = VALUES(poster_url), year = VALUES(year), status = \'pending\', created_at = CURRENT_TIMESTAMP'
    );

    $sent = 0;
    $skipped = 0;
    foreach (array_unique($friendIds) as $fid) {
        if (!isset($accepted[$fid])) { $skipped++; continue; }
        // Non consigliare a chi l'ha già visto.
        $s = $pdo->prepare('SELECT status, watch_count FROM user_media WHERE user_id = ? AND media_key = ?');
        $s->execute([$fid, $mediaKey]);
        $row = $s->fetch();
        $state = recommend_state_from($row['status'] ?? null, (int) ($row['watch_count'] ?? 0));
        if ($state === 'seen') { $skipped++; continue; }

        $ins->execute([uuid(), $userId, $fid, $mediaKey, $mediaType, $title, $poster, $year, $message]);
        $sent++;
    }

    return ['sent' => $sent, 'skipped' => $skipped];
}

function recommend_received(PDO $pdo, string $userId): array {
    $stmt = $pdo->prepare(
        "SELECT r.id, r.media_key, r.media_type, r.title, r.poster_url, r.year, r.message, r.created_at,
                p.handle, p.display_name, p.avatar_url
         FROM recommendations r
         JOIN profiles p ON p.id = r.from_user
         WHERE r.to_user = ? AND r.status = 'pending'
         ORDER BY r.created_at DESC
         LIMIT 50"
    );
    $stmt->execute([$userId]);
    $out = [];
    foreach ($stmt->fetchAll() as $r) {
        $out[] = [
            'id'      => $r['id'],
            'from'    => [
                'handle'       => $r['handle'],
                'display_name' => $r['display_name'],
                'avatar_url'   => $r['avatar_url'],
            ],
            'media'   => [
                'key'       => $r['media_key'],
                'type'      => $r['media_type'],
                'title'     => $r['title'],
                'posterUrl' => $r['poster_url'],
                'year'      => $r['year'] !== null ? (int) $r['year'] : null,
            ],
            'message'    => $r['message'],
            'created_at' => $r['created_at'],
        ];
    }
    return ['received' => $out];
}

function recommend_act(PDO $pdo, string $userId, string $id, string $action): array {
    $status = match ($action) {
        'add'     => 'added',
        'restore' => 'pending',
        default   => 'dismissed',
    };
    if ($status === 'added') {
        // Reset dell'ack: il mittente deve poter vedere il nuovo "aggiunto".
        $pdo->prepare('UPDATE recommendations SET status = ?, ack_by_sender = 0 WHERE id = ? AND to_user = ?')
            ->execute([$status, $id, $userId]);
    } else {
        $pdo->prepare('UPDATE recommendations SET status = ? WHERE id = ? AND to_user = ?')
            ->execute([$status, $id, $userId]);
    }
    return recommend_received($pdo, $userId);
}

/** Consigli inviati dall'utente che sono stati aggiunti e non ancora "letti". */
function recommend_sent_feedback(PDO $pdo, string $userId): array {
    $stmt = $pdo->prepare(
        "SELECT r.id, r.media_key, r.media_type, r.title, r.poster_url, r.year,
                p.handle, p.display_name, p.avatar_url
         FROM recommendations r
         JOIN profiles p ON p.id = r.to_user
         WHERE r.from_user = ? AND r.status = 'added' AND r.ack_by_sender = 0
         ORDER BY r.created_at DESC
         LIMIT 30"
    );
    $stmt->execute([$userId]);
    $out = [];
    foreach ($stmt->fetchAll() as $r) {
        $out[] = [
            'id'    => $r['id'],
            'to'    => [
                'handle'       => $r['handle'],
                'display_name' => $r['display_name'],
                'avatar_url'   => $r['avatar_url'],
            ],
            'media' => [
                'key'       => $r['media_key'],
                'type'      => $r['media_type'],
                'title'     => $r['title'],
                'posterUrl' => $r['poster_url'],
                'year'      => $r['year'] !== null ? (int) $r['year'] : null,
            ],
        ];
    }
    return ['feedback' => $out];
}

function recommend_sent_ack(PDO $pdo, string $userId, ?string $id): array {
    if ($id !== null && $id !== '') {
        $pdo->prepare('UPDATE recommendations SET ack_by_sender = 1 WHERE from_user = ? AND id = ?')
            ->execute([$userId, $id]);
    } else {
        $pdo->prepare("UPDATE recommendations SET ack_by_sender = 1 WHERE from_user = ? AND status = 'added'")
            ->execute([$userId]);
    }
    return recommend_sent_feedback($pdo, $userId);
}
