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
        'spoiler'    => !empty($row['spoiler']),
        'created_at' => $row['created_at'],
        'is_mine'    => ($row['user_id'] ?? '') === $viewerId,
        'author'     => [
            'id'           => $row['user_id'],
            'handle'       => $row['handle'],
            'display_name' => $row['display_name'],
            'avatar_url'   => $row['avatar_url'],
        ],
        'author_status' => $row['media_status'] ?? null,
        'author_rating' => $row['media_rating'] !== null ? (int) $row['media_rating'] : null,
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

function comments_list(
    PDO $pdo,
    string $viewerId,
    string $mediaType,
    int $tmdbId,
    string $scope = 'all',
    int $offset = 0,
): array {
    if (!in_array($mediaType, ['tv', 'movie'], true)) {
        json_out(['error' => 'Tipo media non valido'], 400);
    }
    if ($tmdbId <= 0) json_out(['error' => 'TMDB id non valido'], 400);
    if (!in_array($scope, ['all', 'friends'], true)) $scope = 'all';

    $offset = max(0, $offset);
    $limit = COMMENT_LIST_LIMIT;

    $params = [$mediaType, $tmdbId];
    $friendFilter = '';
    if ($scope === 'friends') {
        $friendIds = comments_friend_ids($pdo, $viewerId);
        $allowed = array_values(array_unique(array_merge([$viewerId], $friendIds)));
        if ($allowed === []) {
            return ['comments' => [], 'total' => 0, 'has_more' => false];
        }
        $placeholders = implode(',', array_fill(0, count($allowed), '?'));
        $friendFilter = " AND c.user_id IN ($placeholders)";
        $params = array_merge($params, $allowed);
    }

    $countSql = "SELECT COUNT(*) FROM media_comments c
                 WHERE c.media_type = ? AND c.tmdb_id = ?
                   AND c.season IS NULL AND c.episode IS NULL
                   AND c.deleted_at IS NULL
                   $friendFilter";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $mediaKey = comments_media_key($mediaType, $tmdbId);
    $listSql = "SELECT c.id, c.user_id, c.body, c.spoiler, c.created_at,
                       p.handle, p.display_name, p.avatar_url,
                       um.status AS media_status, um.rating AS media_rating,
                       us.language AS author_language
                FROM media_comments c
                JOIN profiles p ON p.id = c.user_id
                LEFT JOIN user_stats us ON us.user_id = c.user_id
                LEFT JOIN user_media um ON um.user_id = c.user_id AND um.media_key = ?
                WHERE c.media_type = ? AND c.tmdb_id = ?
                  AND c.season IS NULL AND c.episode IS NULL
                  AND c.deleted_at IS NULL
                  $friendFilter
                ORDER BY c.created_at DESC
                LIMIT $limit OFFSET " . (int) $offset;

    $listParams = array_merge([$mediaKey], $params);
    $stmt = $pdo->prepare($listSql);
    $stmt->execute($listParams);
    $rows = $stmt->fetchAll();

    return [
        'comments' => array_map(fn ($r) => comments_row_to_json($r, $viewerId), $rows),
        'total'    => $total,
        'has_more' => $offset + count($rows) < $total,
    ];
}

function comments_create(
    PDO $pdo,
    string $userId,
    string $mediaType,
    int $tmdbId,
    string $body,
    bool $spoiler = false,
): array {
    if (!in_array($mediaType, ['tv', 'movie'], true)) {
        json_out(['error' => 'Tipo media non valido'], 400);
    }
    if ($tmdbId <= 0) json_out(['error' => 'TMDB id non valido'], 400);

    $body = trim($body);
    if ($body === '') json_out(['error' => 'Commento vuoto'], 400);
    if (mb_strlen($body) > COMMENT_BODY_MAX) {
        json_out(['error' => 'Commento troppo lungo (max ' . COMMENT_BODY_MAX . ' caratteri)'], 400);
    }

    $rate = $pdo->prepare(
        'SELECT COUNT(*) FROM media_comments
         WHERE user_id = ? AND deleted_at IS NULL AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)'
    );
    $rate->execute([$userId]);
    if ((int) $rate->fetchColumn() >= 20) {
        json_out(['error' => 'Troppi commenti in poco tempo, riprova tra un po\''], 429);
    }

    $id = uuid();
    $pdo->prepare(
        'INSERT INTO media_comments (id, user_id, media_type, tmdb_id, body, spoiler)
         VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$id, $userId, $mediaType, $tmdbId, $body, $spoiler ? 1 : 0]);

    $stmt = $pdo->prepare(
        'SELECT c.id, c.user_id, c.body, c.spoiler, c.created_at,
                p.handle, p.display_name, p.avatar_url,
                um.status AS media_status, um.rating AS media_rating,
                us.language AS author_language
         FROM media_comments c
         JOIN profiles p ON p.id = c.user_id
         LEFT JOIN user_stats us ON us.user_id = c.user_id
         LEFT JOIN user_media um ON um.user_id = c.user_id AND um.media_key = ?
         WHERE c.id = ?'
    );
    $stmt->execute([comments_media_key($mediaType, $tmdbId), $id]);
    $row = $stmt->fetch();
    if (!$row) json_out(['error' => 'Errore creazione commento'], 500);

    return ['comment' => comments_row_to_json($row, $userId)];
}

function comments_delete(PDO $pdo, string $userId, string $commentId): array {
    $stmt = $pdo->prepare(
        'SELECT user_id FROM media_comments WHERE id = ? AND deleted_at IS NULL'
    );
    $stmt->execute([$commentId]);
    $row = $stmt->fetch();
    if (!$row) json_out(['error' => 'Commento non trovato'], 404);
    if ($row['user_id'] !== $userId) json_out(['error' => 'Permesso negato'], 403);

    $pdo->prepare('UPDATE media_comments SET deleted_at = NOW() WHERE id = ?')
        ->execute([$commentId]);

    return ['ok' => true];
}
