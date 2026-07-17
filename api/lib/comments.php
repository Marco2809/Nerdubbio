<?php

const COMMENT_BODY_MAX = 2000;
const COMMENT_LIST_LIMIT = 30;

function comments_media_key(string $type, int $tmdbId): string {
    return $type . '-' . $tmdbId;
}

function comments_row_to_json(array $row, string $viewerId): array {
    return [
        'id'         => $row['id'],
        'body'       => $row['body'],
        'media_url'  => $row['media_url'] ?? null,
        'spoiler'    => !empty($row['spoiler']),
        'rating'     => isset($row['rating']) && $row['rating'] !== null ? (int) $row['rating'] : null,
        'parent_id'  => $row['parent_id'] ?? null,
        'reply_count' => isset($row['reply_count']) ? (int) $row['reply_count'] : 0,
        'created_at' => $row['created_at'],
        'is_mine'    => ($row['user_id'] ?? '') === $viewerId,
        'author'     => [
            'id'           => $row['user_id'],
            'handle'       => $row['handle'],
            'display_name' => $row['display_name'],
            'avatar_url'   => $row['avatar_url'],
        ],
        'author_status'   => $row['media_status'] ?? null,
        'author_rating'   => isset($row['media_rating']) && $row['media_rating'] !== null ? (int) $row['media_rating'] : null,
        'author_language' => normalize_locale($row['author_language'] ?? 'it'),
    ];
}

function comments_friend_ids(PDO $pdo, string $userId): array {
    $stmt = $pdo->prepare(
        "SELECT CASE WHEN user_id = ? THEN friend_id ELSE user_id END AS fid
         FROM friendships
         WHERE status = 'accepted' AND (user_id = ? OR friend_id = ?)"
    );
    $stmt->execute([$userId, $userId, $userId]);
    return array_column($stmt->fetchAll(), 'fid');
}

/** Commenti-episodio dell'utente per una stagione (per il recap personale). */
function comments_mine_for_season(PDO $pdo, string $userId, string $mediaType, int $tmdbId, int $season): array {
    $stmt = $pdo->prepare(
        'SELECT season, episode, body, rating, created_at
         FROM media_comments
         WHERE user_id = ? AND media_type = ? AND tmdb_id = ? AND season = ?
           AND episode IS NOT NULL AND parent_id IS NULL AND deleted_at IS NULL
           AND body IS NOT NULL AND body <> ""
         ORDER BY episode ASC'
    );
    $stmt->execute([$userId, $mediaType, $tmdbId, $season]);
    $out = [];
    foreach ($stmt->fetchAll() as $r) {
        $out[] = [
            'season'     => (int) $r['season'],
            'episode'    => (int) $r['episode'],
            'body'       => (string) $r['body'],
            'rating'     => $r['rating'] !== null ? (int) $r['rating'] : null,
            'created_at' => $r['created_at'],
        ];
    }
    return ['comments' => $out];
}

const COMMENT_SELECT = "c.id, c.user_id, c.body, c.media_url, c.spoiler, c.rating, c.parent_id, c.created_at,
                        p.handle, p.display_name, p.avatar_url,
                        um.status AS media_status, um.rating AS media_rating, us.language AS author_language";

function comments_list(
    PDO $pdo,
    string $viewerId,
    string $mediaType,
    int $tmdbId,
    string $scope = 'all',
    int $offset = 0,
    ?int $season = null,
    ?int $episode = null,
): array {
    if (!in_array($mediaType, ['tv', 'movie'], true)) api_err('invalid_media_type', 400);
    if ($tmdbId <= 0) api_err('invalid_tmdb_id', 400);
    if (!in_array($scope, ['all', 'friends'], true)) $scope = 'all';

    $offset = max(0, $offset);
    $limit = COMMENT_LIST_LIMIT;

    // Scope episodio vs titolo.
    $episodeScope = ($season !== null && $episode !== null);
    $scopeWhere = $episodeScope ? 'c.season = ? AND c.episode = ?' : 'c.season IS NULL AND c.episode IS NULL';
    $scopeParams = $episodeScope ? [$season, $episode] : [];

    $params = array_merge([$mediaType, $tmdbId], $scopeParams);
    $friendFilter = '';
    if ($scope === 'friends') {
        $friendIds = comments_friend_ids($pdo, $viewerId);
        $allowed = array_values(array_unique(array_merge([$viewerId], $friendIds)));
        $placeholders = implode(',', array_fill(0, count($allowed), '?'));
        $friendFilter = " AND c.user_id IN ($placeholders)";
        $params = array_merge($params, $allowed);
    }

    $where = "c.media_type = ? AND c.tmdb_id = ? AND $scopeWhere
              AND c.parent_id IS NULL AND c.deleted_at IS NULL $friendFilter";

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM media_comments c WHERE $where");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $mediaKey = comments_media_key($mediaType, $tmdbId);
    $sql = "SELECT " . COMMENT_SELECT . ",
                   (SELECT COUNT(*) FROM media_comments r WHERE r.parent_id = c.id AND r.deleted_at IS NULL) AS reply_count
            FROM media_comments c
            JOIN profiles p ON p.id = c.user_id
            LEFT JOIN user_stats us ON us.user_id = c.user_id
            LEFT JOIN user_media um ON um.user_id = c.user_id AND um.media_key = ?
            WHERE $where
            ORDER BY c.created_at DESC
            LIMIT $limit OFFSET " . (int) $offset;
    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_merge([$mediaKey], $params));
    $rows = $stmt->fetchAll();

    return [
        'comments' => array_map(fn ($r) => comments_row_to_json($r, $viewerId), $rows),
        'total'    => $total,
        'has_more' => $offset + count($rows) < $total,
    ];
}

/** Reply (thread) di un commento, in ordine cronologico. */
function comments_replies(PDO $pdo, string $viewerId, string $parentId): array {
    $parent = $pdo->prepare('SELECT media_type, tmdb_id FROM media_comments WHERE id = ?');
    $parent->execute([$parentId]);
    $pRow = $parent->fetch();
    if (!$pRow) return ['replies' => []];

    $mediaKey = comments_media_key((string) $pRow['media_type'], (int) $pRow['tmdb_id']);
    $sql = "SELECT " . COMMENT_SELECT . "
            FROM media_comments c
            JOIN profiles p ON p.id = c.user_id
            LEFT JOIN user_stats us ON us.user_id = c.user_id
            LEFT JOIN user_media um ON um.user_id = c.user_id AND um.media_key = ?
            WHERE c.parent_id = ? AND c.deleted_at IS NULL
            ORDER BY c.created_at ASC
            LIMIT 200";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$mediaKey, $parentId]);

    return ['replies' => array_map(fn ($r) => comments_row_to_json($r, $viewerId), $stmt->fetchAll())];
}

/** Conteggio commenti per episodio (per i badge nella lista episodi). */
function comments_counts(PDO $pdo, string $mediaType, int $tmdbId): array {
    if (!in_array($mediaType, ['tv', 'movie'], true)) api_err('invalid_media_type', 400);
    if ($tmdbId <= 0) api_err('invalid_tmdb_id', 400);

    $stmt = $pdo->prepare(
        "SELECT season, episode, COUNT(*) AS n FROM media_comments
         WHERE media_type = ? AND tmdb_id = ? AND season IS NOT NULL AND episode IS NOT NULL AND deleted_at IS NULL
         GROUP BY season, episode"
    );
    $stmt->execute([$mediaType, $tmdbId]);
    $counts = [];
    foreach ($stmt->fetchAll() as $r) {
        $counts['S' . (int) $r['season'] . 'E' . (int) $r['episode']] = (int) $r['n'];
    }
    return ['counts' => $counts];
}

function comments_create(
    PDO $pdo,
    string $userId,
    string $mediaType,
    int $tmdbId,
    string $body,
    bool $spoiler = false,
    ?int $season = null,
    ?int $episode = null,
    ?string $parentId = null,
    ?int $rating = null,
    ?string $mediaUrl = null,
): array {
    if (!in_array($mediaType, ['tv', 'movie'], true)) api_err('invalid_media_type', 400);
    if ($tmdbId <= 0) api_err('invalid_tmdb_id', 400);

    $body = trim($body);
    $mediaUrl = $mediaUrl !== null ? trim($mediaUrl) : null;
    if ($mediaUrl !== null && $mediaUrl !== '') {
        if (mb_strlen($mediaUrl) > 512 || !preg_match('#^(https?://|/api/uploads/)#', $mediaUrl)) {
            api_err('invalid_media_url', 400);
        }
    } else {
        $mediaUrl = null;
    }
    if ($body === '' && $mediaUrl === null) api_err('comment_empty', 400);
    if (mb_strlen($body) > COMMENT_BODY_MAX) {
        api_err('comment_too_long', 400, ['max' => COMMENT_BODY_MAX]);
    }

    // Una reply eredita il contesto (episodio/titolo) dal padre.
    if ($parentId !== null && $parentId !== '') {
        $p = $pdo->prepare('SELECT media_type, tmdb_id, season, episode FROM media_comments WHERE id = ? AND deleted_at IS NULL');
        $p->execute([$parentId]);
        $pRow = $p->fetch();
        if (!$pRow) api_err('comment_not_found', 404);
        $mediaType = (string) $pRow['media_type'];
        $tmdbId    = (int) $pRow['tmdb_id'];
        $season    = $pRow['season'] !== null ? (int) $pRow['season'] : null;
        $episode   = $pRow['episode'] !== null ? (int) $pRow['episode'] : null;
    } else {
        $parentId = null;
    }

    $rating = $rating !== null ? max(1, min(10, $rating)) : null;

    $rate = $pdo->prepare(
        'SELECT COUNT(*) FROM media_comments
         WHERE user_id = ? AND deleted_at IS NULL AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)'
    );
    $rate->execute([$userId]);
    if ((int) $rate->fetchColumn() >= 40) api_err('comment_rate_limit', 429);

    $id = uuid();
    $pdo->prepare(
        'INSERT INTO media_comments (id, user_id, media_type, tmdb_id, season, episode, parent_id, body, media_url, spoiler, rating)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([$id, $userId, $mediaType, $tmdbId, $season, $episode, $parentId, $body, $mediaUrl, $spoiler ? 1 : 0, $rating]);

    $stmt = $pdo->prepare(
        'SELECT ' . COMMENT_SELECT . '
         FROM media_comments c
         JOIN profiles p ON p.id = c.user_id
         LEFT JOIN user_stats us ON us.user_id = c.user_id
         LEFT JOIN user_media um ON um.user_id = c.user_id AND um.media_key = ?
         WHERE c.id = ?'
    );
    $stmt->execute([comments_media_key($mediaType, $tmdbId), $id]);
    $row = $stmt->fetch();
    if (!$row) api_err('comment_create_failed', 500);

    return ['comment' => comments_row_to_json($row, $userId)];
}

function comments_delete(PDO $pdo, string $userId, string $commentId): array {
    $stmt = $pdo->prepare('SELECT user_id FROM media_comments WHERE id = ? AND deleted_at IS NULL');
    $stmt->execute([$commentId]);
    $row = $stmt->fetch();
    if (!$row) api_err('comment_not_found', 404);
    if ($row['user_id'] !== $userId) api_err('permission_denied', 403);

    $pdo->prepare('UPDATE media_comments SET deleted_at = NOW() WHERE id = ?')->execute([$commentId]);
    return ['ok' => true];
}
