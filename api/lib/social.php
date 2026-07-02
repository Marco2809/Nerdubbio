<?php

function social_public_card(array $row): array {
    return [
        'id'           => $row['id'] ?? null,
        'handle'       => $row['handle'],
        'display_name' => $row['display_name'],
        'avatar_url'   => $row['avatar_url'],
        'bio'          => $row['bio'],
    ];
}

function social_find_user_by_handle(PDO $pdo, string $handle): ?array {
    $handle = strtolower(trim($handle));
    if ($handle === '' || !preg_match('/^[a-z0-9_]{3,24}$/', $handle)) return null;

    $stmt = $pdo->prepare(
        'SELECT u.id, p.handle, p.display_name, p.avatar_url, p.bio,
                s.level, s.streak_days, s.xp
         FROM profiles p
         JOIN users u ON u.id = p.id
         LEFT JOIN user_stats s ON s.user_id = p.id
         WHERE p.handle = ?'
    );
    $stmt->execute([$handle]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function social_public_media(PDO $pdo, string $userId, int $limit = 12): array {
    $stmt = $pdo->prepare(
        "SELECT media_key, media_type, status, rating, title, poster_url, year
         FROM user_media
         WHERE user_id = ? AND status IN ('watching','completed','favorite')
         ORDER BY COALESCE(rating, 0) DESC, updated_at DESC
         LIMIT $limit"
    );
    $stmt->execute([$userId]);
    $rows = $stmt->fetchAll();
    return array_map(static function (array $r): array {
        return [
            'id'        => $r['media_key'],
            'type'      => $r['media_type'],
            'status'    => $r['status'],
            'rating'    => $r['rating'] !== null ? (int) $r['rating'] : null,
            'title'     => $r['title'],
            'posterUrl' => $r['poster_url'],
            'year'      => $r['year'] !== null ? (int) $r['year'] : null,
        ];
    }, $rows);
}

function social_public_profile(PDO $pdo, string $handle): ?array {
    $user = social_find_user_by_handle($pdo, $handle);
    if (!$user) return null;

    $watching = $pdo->prepare(
        "SELECT media_key, media_type, title, poster_url, year
         FROM user_media WHERE user_id = ? AND status = 'watching'
         ORDER BY updated_at DESC LIMIT 6"
    );
    $watching->execute([$user['id']]);

    return [
        'handle'       => $user['handle'],
        'display_name' => $user['display_name'],
        'avatar_url'   => $user['avatar_url'],
        'bio'          => $user['bio'],
        'level'        => (int) ($user['level'] ?? 1),
        'streak'       => (int) ($user['streak_days'] ?? 0),
        'xp'           => (int) ($user['xp'] ?? 0),
        'watching'     => array_map(static fn ($r) => [
            'id'        => $r['media_key'],
            'type'      => $r['media_type'],
            'title'     => $r['title'],
            'posterUrl' => $r['poster_url'],
            'year'      => $r['year'] !== null ? (int) $r['year'] : null,
        ], $watching->fetchAll()),
        'topRated'     => social_public_media($pdo, $user['id'], 8),
    ];
}

function social_search_users(PDO $pdo, string $userId, string $query, int $limit = 20): array {
    $q = strtolower(trim($query));
    if ($q === '' || strlen($q) < 2) return [];

    $stmt = $pdo->prepare(
        'SELECT p.id, p.handle, p.display_name, p.avatar_url, p.bio
         FROM profiles p
         WHERE p.id != ?
           AND (p.handle LIKE ? OR p.display_name LIKE ?)
         ORDER BY p.handle ASC
         LIMIT ' . (int) $limit
    );
    $like = '%' . $q . '%';
    $stmt->execute([$userId, $like, $like]);
    return array_map('social_public_card', $stmt->fetchAll());
}

function social_friends_context(PDO $pdo, string $userId, string $otherId): ?string {
    $stmt = $pdo->prepare(
        'SELECT user_id, friend_id, status FROM friendships
         WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
         LIMIT 1'
    );
    $stmt->execute([$userId, $otherId, $otherId, $userId]);
    $row = $stmt->fetch();
    if (!$row) return null;
    if ($row['status'] === 'accepted') return 'accepted';
    if ($row['status'] === 'blocked') return 'blocked';
    if ($row['user_id'] === $userId) return 'pending_out';
    return 'pending_in';
}

function social_friends_list(PDO $pdo, string $userId): array {
    $stmt = $pdo->prepare(
        "SELECT f.user_id, f.friend_id, f.status, f.created_at,
                p.id, p.handle, p.display_name, p.avatar_url, p.bio
         FROM friendships f
         JOIN profiles p ON p.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
         WHERE (f.user_id = ? OR f.friend_id = ?)
         ORDER BY f.created_at DESC"
    );
    $stmt->execute([$userId, $userId, $userId]);

    $friends = [];
    $incoming = [];
    $outgoing = [];

    foreach ($stmt->fetchAll() as $row) {
        $card = social_public_card($row);
        $card['since'] = $row['created_at'];
        if ($row['status'] === 'accepted') {
            $friends[] = $card;
        } elseif ($row['status'] === 'pending' && $row['friend_id'] === $userId) {
            $card['requester_id'] = $row['user_id'];
            $incoming[] = $card;
        } elseif ($row['status'] === 'pending' && $row['user_id'] === $userId) {
            $card['target_id'] = $row['friend_id'];
            $outgoing[] = $card;
        }
    }

    return compact('friends', 'incoming', 'outgoing');
}

function social_send_friend_request(PDO $pdo, string $userId, string $handle): array {
    $target = social_find_user_by_handle($pdo, $handle);
    if (!$target) json_out(['error' => 'Utente non trovato'], 404);
    if ($target['id'] === $userId) json_out(['error' => 'Non puoi aggiungere te stesso'], 400);

    $ctx = social_friends_context($pdo, $userId, $target['id']);
    if ($ctx === 'accepted') json_out(['error' => 'Siete già amici'], 409);
    if ($ctx === 'pending_out') json_out(['error' => 'Richiesta già inviata'], 409);
    if ($ctx === 'pending_in') {
        $pdo->prepare(
            'UPDATE friendships SET status = ? WHERE user_id = ? AND friend_id = ?'
        )->execute(['accepted', $target['id'], $userId]);
        return social_friends_list($pdo, $userId);
    }
    if ($ctx === 'blocked') json_out(['error' => 'Impossibile inviare richiesta'], 403);

    $pdo->prepare(
        'INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, ?)'
    )->execute([$userId, $target['id'], 'pending']);

    return social_friends_list($pdo, $userId);
}

function social_respond_friend(PDO $pdo, string $userId, string $requesterId, bool $accept): array {
    $stmt = $pdo->prepare(
        'SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ? AND status = ?'
    );
    $stmt->execute([$requesterId, $userId, 'pending']);
    if (!$stmt->fetch()) json_out(['error' => 'Richiesta non trovata'], 404);

    if ($accept) {
        $pdo->prepare(
            'UPDATE friendships SET status = ? WHERE user_id = ? AND friend_id = ?'
        )->execute(['accepted', $requesterId, $userId]);
    } else {
        $pdo->prepare(
            'DELETE FROM friendships WHERE user_id = ? AND friend_id = ?'
        )->execute([$requesterId, $userId]);
    }
    return social_friends_list($pdo, $userId);
}

function social_remove_friend(PDO $pdo, string $userId, string $friendId): array {
    $pdo->prepare(
        'DELETE FROM friendships
         WHERE status = ? AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))'
    )->execute(['accepted', $userId, $friendId, $friendId, $userId]);
    return social_friends_list($pdo, $userId);
}

function social_group_card(PDO $pdo, array $group, string $userId): array {
    $members = $pdo->prepare(
        'SELECT p.id, p.handle, p.display_name, p.avatar_url, gm.role
         FROM group_members gm
         JOIN profiles p ON p.id = gm.user_id
         WHERE gm.group_id = ?
         ORDER BY gm.role DESC, p.display_name ASC'
    );
    $members->execute([$group['id']]);
    $memberRows = $members->fetchAll();

    return [
        'id'         => $group['id'],
        'name'       => $group['name'],
        'owner_id'   => $group['owner_id'],
        'is_owner'   => $group['owner_id'] === $userId,
        'created_at' => $group['created_at'],
        'members'    => array_map(static fn ($m) => [
            'id'           => $m['id'],
            'handle'       => $m['handle'],
            'display_name' => $m['display_name'],
            'avatar_url'   => $m['avatar_url'],
            'role'         => $m['role'],
        ], $memberRows),
    ];
}

function social_groups_list(PDO $pdo, string $userId): array {
    $stmt = $pdo->prepare(
        'SELECT g.*
         FROM groups g
         JOIN group_members gm ON gm.group_id = g.id
         WHERE gm.user_id = ?
         ORDER BY g.created_at DESC'
    );
    $stmt->execute([$userId]);
    return array_map(fn ($g) => social_group_card($pdo, $g, $userId), $stmt->fetchAll());
}

function social_group_create(PDO $pdo, string $userId, string $name): array {
    $name = trim($name);
    if ($name === '' || strlen($name) > 120) json_out(['error' => 'Nome gruppo non valido'], 400);

    $id = uuid();
    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT INTO groups (id, name, owner_id) VALUES (?, ?, ?)')
            ->execute([$id, $name, $userId]);
        $pdo->prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)')
            ->execute([$id, $userId, 'owner']);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_out(['error' => 'Errore creazione gruppo'], 500);
    }

    return social_groups_list($pdo, $userId);
}

function social_group_add_member(PDO $pdo, string $userId, string $groupId, string $handle): array {
    $group = $pdo->prepare('SELECT * FROM groups WHERE id = ?');
    $group->execute([$groupId]);
    $g = $group->fetch();
    if (!$g) json_out(['error' => 'Gruppo non trovato'], 404);

    $isMember = $pdo->prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?');
    $isMember->execute([$groupId, $userId]);
    if (!$isMember->fetch()) json_out(['error' => 'Non sei nel gruppo'], 403);

    $target = social_find_user_by_handle($pdo, $handle);
    if (!$target) json_out(['error' => 'Utente non trovato'], 404);
    if (social_friends_context($pdo, $userId, $target['id']) !== 'accepted') {
        json_out(['error' => 'Puoi invitare solo amici accettati'], 400);
    }

    $exists = $pdo->prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?');
    $exists->execute([$groupId, $target['id']]);
    if ($exists->fetch()) json_out(['error' => 'Già nel gruppo'], 409);

    $pdo->prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)')
        ->execute([$groupId, $target['id'], 'member']);

    return social_groups_list($pdo, $userId);
}

function social_group_remove_member(PDO $pdo, string $userId, string $groupId, string $memberId): array {
    $group = $pdo->prepare('SELECT * FROM groups WHERE id = ?');
    $group->execute([$groupId]);
    $g = $group->fetch();
    if (!$g) json_out(['error' => 'Gruppo non trovato'], 404);

    if ($memberId === $g['owner_id'] && $userId !== $g['owner_id']) {
        json_out(['error' => 'Non puoi rimuovere il proprietario'], 403);
    }
    if ($memberId !== $userId && $userId !== $g['owner_id']) {
        json_out(['error' => 'Permesso negato'], 403);
    }

    $pdo->prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?')
        ->execute([$groupId, $memberId]);

    if ($memberId === $g['owner_id']) {
        $pdo->prepare('DELETE FROM groups WHERE id = ?')->execute([$groupId]);
    }

    return social_groups_list($pdo, $userId);
}

function social_group_delete(PDO $pdo, string $userId, string $groupId): array {
    $group = $pdo->prepare('SELECT owner_id FROM groups WHERE id = ?');
    $group->execute([$groupId]);
    $g = $group->fetch();
    if (!$g) json_out(['error' => 'Gruppo non trovato'], 404);
    if ($g['owner_id'] !== $userId) json_out(['error' => 'Solo il proprietario può eliminare'], 403);

    $pdo->prepare('DELETE FROM groups WHERE id = ?')->execute([$groupId]);
    return social_groups_list($pdo, $userId);
}
