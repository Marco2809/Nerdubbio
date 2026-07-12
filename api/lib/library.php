<?php

function library_default_filters(): array {
    return ['newSeries' => true, 'seasonPremieres' => true, 'includeMovies' => true];
}

function library_level_from_xp(int $xp): int {
    return max(1, (int) floor($xp / 400) + 1);
}

function library_today(): string {
    return date('Y-m-d');
}

function library_bump_streak(array $stats): array {
    $t = library_today();
    if (($stats['last_active_day'] ?? null) === $t) {
        return ['streak_days' => (int) $stats['streak_days'], 'last_active_day' => $t];
    }
    $y = date('Y-m-d', strtotime('-1 day'));
    $streak = (($stats['last_active_day'] ?? null) === $y) ? ((int) $stats['streak_days'] + 1) : 1;
    return ['streak_days' => $streak, 'last_active_day' => $t];
}

function library_parse_media_key(string $key): ?array {
    if (preg_match('/^(tv|movie)-(\d+)$/', $key, $m)) {
        return ['type' => $m[1], 'tmdb_id' => (int) $m[2]];
    }
    return null;
}

function library_episode_key(int $season, int $episode): string {
    return "S{$season}E{$episode}";
}

/** True se tutti gli episodi 1..N della stagione risultano visti. */
function library_is_season_complete(array $watchedMap, int $season, int $episodesPerSeason): bool {
    if ($episodesPerSeason <= 0 || $episodesPerSeason > 200) return false;
    for ($i = 1; $i <= $episodesPerSeason; $i++) {
        if (!isset($watchedMap[library_episode_key($season, $i)])) return false;
    }
    return true;
}

function library_ensure_stats(PDO $pdo, string $userId): void {
    $stmt = $pdo->prepare('SELECT user_id FROM user_stats WHERE user_id = ?');
    $stmt->execute([$userId]);
    if ($stmt->fetch()) return;

    $pdo->prepare(
        'INSERT INTO user_stats (user_id, upcoming_filters, dismissed, achievements)
         VALUES (?, ?, ?, ?)'
    )->execute([
        $userId,
        to_json(library_default_filters()),
        to_json([]),
        to_json([]),
    ]);
}

function library_fetch_stats(PDO $pdo, string $userId): array {
    library_ensure_stats($pdo, $userId);
    $stmt = $pdo->prepare('SELECT * FROM user_stats WHERE user_id = ?');
    $stmt->execute([$userId]);
    return $stmt->fetch() ?: [];
}

function library_save_stats(PDO $pdo, string $userId, array $patch): void {
    $allowed = [
        'xp', 'level', 'streak_days', 'last_active_day', 'onboarding_done', 'language',
        'favorite_genres', 'mood_profile', 'platforms', 'upcoming_filters', 'dismissed', 'achievements', 'local_migrated',
        'import_pending',
    ];
    $sets = [];
    $vals = [];
    foreach ($allowed as $k) {
        if (!array_key_exists($k, $patch)) continue;
        $v = $patch[$k];
        if (in_array($k, ['favorite_genres', 'mood_profile', 'platforms', 'upcoming_filters', 'dismissed', 'achievements', 'import_pending'], true)) {
            $v = to_json($v);
        }
        if ($k === 'onboarding_done' || $k === 'local_migrated') {
            $v = $v ? 1 : 0;
        }
        $sets[] = "`$k` = ?";
        $vals[] = $v;
    }
    if (!$sets) return;
    $vals[] = $userId;
    $pdo->prepare('UPDATE user_stats SET ' . implode(', ', $sets) . ' WHERE user_id = ?')->execute($vals);
}

function library_row_to_entry(array $row, array $episodes): array {
    $watched = [];
    $reactions = parse_json($row['reactions'] ?? null, []);
    $episodeDates = [];
    $episodeWatchCounts = [];
    $lastFromEps = null;
    foreach ($episodes as $ep) {
        $key = library_episode_key((int) $ep['season'], (int) $ep['episode']);
        $watched[] = $key;
        $count = max(1, (int) ($ep['watch_count'] ?? 1));
        $episodeWatchCounts[$key] = $count;
        if (!empty($ep['watched_at'])) {
            $t = date('c', strtotime($ep['watched_at']));
            $episodeDates[$key] = $t;
            if (!$lastFromEps || $t > $lastFromEps) $lastFromEps = $t;
        }
    }

    $lastWatched = $row['last_watched_at'] ? date('c', strtotime($row['last_watched_at'])) : null;
    if ($lastFromEps && (!$lastWatched || $lastFromEps > $lastWatched)) {
        $lastWatched = $lastFromEps;
    }

    $movieWatchCount = (int) ($row['watch_count'] ?? 0);

    return [
        'id'              => $row['media_key'],
        'status'          => $row['status'],
        'favorite'        => (int) ($row['is_favorite'] ?? 0) === 1,
        'rating'          => $row['rating'] !== null ? (int) $row['rating'] : null,
        'currentSeason'   => $row['current_season'] !== null ? (int) $row['current_season'] : null,
        'currentEpisode'  => $row['current_episode'] !== null ? (int) $row['current_episode'] : null,
        'watchedEpisodes' => $watched,
        'episodeDates'    => $episodeDates ?: null,
        'episodeWatchCounts' => $episodeWatchCounts ?: null,
        'watchCount'      => $movieWatchCount > 0 ? $movieWatchCount : null,
        'reactions'       => is_array($reactions) ? $reactions : [],
        'notes'           => $row['notes'] ?? null,
        'addedAt'         => date('c', strtotime($row['added_at'])),
        'updatedAt'       => date('c', strtotime($row['updated_at'])),
        'lastWatchedAt'   => $lastWatched,
        'source'          => $row['source'] ?? 'manual',
        'title'           => $row['title'] ?? null,
        'posterUrl'       => $row['poster_url'] ?? null,
        'backdropUrl'     => $row['backdrop_url'] ?? null,
        'type'            => $row['media_type'] ?? null,
        'year'            => $row['year'] !== null ? (int) $row['year'] : null,
    ];
}

function library_fetch_state(PDO $pdo, string $userId): array {
    $stats = library_fetch_stats($pdo, $userId);

    $mediaStmt = $pdo->prepare('SELECT * FROM user_media WHERE user_id = ? ORDER BY updated_at DESC');
    $mediaStmt->execute([$userId]);
    $mediaRows = $mediaStmt->fetchAll();

    $epStmt = $pdo->prepare(
        'SELECT media_key, season, episode, watched_at, watch_count FROM user_episodes WHERE user_id = ? ORDER BY season, episode'
    );
    $epStmt->execute([$userId]);
    $epRows = $epStmt->fetchAll();

    $epsByMedia = [];
    foreach ($epRows as $ep) {
        $epsByMedia[$ep['media_key']][] = $ep;
    }

    $media = [];
    foreach ($mediaRows as $row) {
        $media[$row['media_key']] = library_row_to_entry($row, $epsByMedia[$row['media_key']] ?? []);
    }

    $filters = parse_json($stats['upcoming_filters'] ?? null, library_default_filters());
    if (!is_array($filters)) $filters = library_default_filters();

    return [
        'xp'               => (int) ($stats['xp'] ?? 0),
        'level'            => (int) ($stats['level'] ?? 1),
        'streak'           => (int) ($stats['streak_days'] ?? 0),
        'lastActiveDay'    => $stats['last_active_day'] ?? null,
        'media'            => $media,
        'dismissed'        => parse_json($stats['dismissed'] ?? null, []),
        'achievements'     => parse_json($stats['achievements'] ?? null, []),
        'onboardingDone'   => !empty($stats['onboarding_done']),
        'language'         => normalize_locale($stats['language'] ?? 'it'),
        'favoriteGenres'   => parse_json($stats['favorite_genres'] ?? null, []),
        'moodProfile'      => parse_json($stats['mood_profile'] ?? null, null),
        'platforms'        => parse_json($stats['platforms'] ?? null, []),
        'upcomingFilters'  => $filters,
        'localMigrated'    => !empty($stats['local_migrated']),
        'importPending'    => parse_json($stats['import_pending'] ?? null, []),
    ];
}

function library_upsert_media(PDO $pdo, string $userId, string $mediaKey, array $entry): void {
    $parsed = library_parse_media_key($mediaKey);
    $type = $entry['type'] ?? ($parsed['type'] ?? null);
    $tmdbId = $parsed['tmdb_id'] ?? null;

    // is_favorite: aggiornato solo se il chiamante lo passa esplicitamente
    // (COALESCE preserva il flag durante import/toggle episodio/cambio stato).
    $favorite = array_key_exists('favorite', $entry) && $entry['favorite'] !== null
        ? ((int) (bool) $entry['favorite'])
        : null;

    $pdo->prepare(
        'INSERT INTO user_media
         (user_id, media_key, tmdb_id, media_type, status, rating, current_season, current_episode,
          reactions, notes, title, poster_url, backdrop_url, year, source, is_favorite, added_at, last_watched_at, watch_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 0), COALESCE(?, NOW()), ?, ?)
         ON DUPLICATE KEY UPDATE
           status = VALUES(status),
           rating = COALESCE(VALUES(rating), rating),
           current_season = COALESCE(VALUES(current_season), current_season),
           current_episode = COALESCE(VALUES(current_episode), current_episode),
           reactions = COALESCE(VALUES(reactions), reactions),
           notes = COALESCE(VALUES(notes), notes),
           title = COALESCE(VALUES(title), title),
           poster_url = COALESCE(VALUES(poster_url), poster_url),
           backdrop_url = COALESCE(VALUES(backdrop_url), backdrop_url),
           year = COALESCE(VALUES(year), year),
           source = COALESCE(VALUES(source), source),
           is_favorite = COALESCE(?, is_favorite),
           last_watched_at = COALESCE(VALUES(last_watched_at), last_watched_at),
           watch_count = GREATEST(watch_count, VALUES(watch_count)),
           updated_at = NOW()'
    )->execute([
        $userId,
        $mediaKey,
        $tmdbId,
        $type,
        $entry['status'] ?? 'plan_to_watch',
        $entry['rating'] ?? null,
        $entry['currentSeason'] ?? null,
        $entry['currentEpisode'] ?? null,
        isset($entry['reactions']) ? to_json($entry['reactions']) : null,
        $entry['notes'] ?? null,
        $entry['title'] ?? null,
        $entry['posterUrl'] ?? null,
        $entry['backdropUrl'] ?? null,
        $entry['year'] ?? null,
        $entry['source'] ?? 'manual',
        $favorite,
        normalize_datetime($entry['addedAt'] ?? null),
        isset($entry['lastWatchedAt']) ? normalize_datetime($entry['lastWatchedAt']) : null,
        isset($entry['watchCount']) ? max(0, (int) $entry['watchCount']) : 0,
        $favorite,
    ]);
}

function library_entry_episode_dates(array $entry): ?array {
    $dates = $entry['episodeDates'] ?? null;
    return is_array($dates) && $dates ? $dates : null;
}

function library_merge_status(array $existing, array $incoming): ?string {
    if (!isset($incoming['status'])) return null;
    $inc = (string) $incoming['status'];
    $cur = (string) ($existing['status'] ?? 'plan_to_watch');
    $source = (string) ($incoming['source'] ?? '');

    if (in_array($cur, ['favorite', 'paused', 'dropped'], true) && $source !== 'status_sync') {
        return null;
    }
    if ($cur === 'completed' && $inc === 'watching' && $source !== 'tvtime') {
        return null;
    }
    if ($source === 'status_sync' || $source === 'tvtime' || $inc === 'completed') {
        return $inc;
    }
    $rank = ['favorite' => 5, 'watching' => 4, 'completed' => 3, 'plan_to_watch' => 2, 'paused' => 1, 'dropped' => 0];
    $inR = $rank[$inc] ?? -1;
    $exR = $rank[$cur] ?? -1;
    return $inR >= $exR ? $inc : null;
}

function library_entry_episode_watch_counts(array $entry): ?array {
    $counts = $entry['episodeWatchCounts'] ?? null;
    if (!is_array($counts) || !$counts) return null;
    return $counts;
}

/** Unisce episodi, conteggi rivisioni e date senza duplicare. */
function library_merge_episode_fields(array $existing, array $incoming): array {
    $wExisting = is_array($existing['watchedEpisodes'] ?? null) ? $existing['watchedEpisodes'] : [];
    $wNew = is_array($incoming['watchedEpisodes'] ?? null) ? $incoming['watchedEpisodes'] : [];
    $watched = array_values(array_unique(array_merge($wExisting, $wNew)));

    $countsExisting = is_array($existing['episodeWatchCounts'] ?? null) ? $existing['episodeWatchCounts'] : [];
    $countsNew = is_array($incoming['episodeWatchCounts'] ?? null) ? $incoming['episodeWatchCounts'] : [];
    $counts = [];
    foreach ($watched as $key) {
        $a = (int) ($countsExisting[$key] ?? 0);
        $b = (int) ($countsNew[$key] ?? 0);
        $counts[$key] = max($a, $b, 1);
    }

    $datesExisting = is_array($existing['episodeDates'] ?? null) ? $existing['episodeDates'] : [];
    $datesNew = is_array($incoming['episodeDates'] ?? null) ? $incoming['episodeDates'] : [];
    $dates = $datesExisting;
    foreach ($datesNew as $k => $d) {
        if (!isset($dates[$k]) || normalize_datetime($d) > normalize_datetime($dates[$k])) {
            $dates[$k] = $d;
        }
    }

    $maxS = 0;
    $maxE = 0;
    foreach ($watched as $k) {
        if (!preg_match('/^S(\d+)E(\d+)$/', $k, $m)) continue;
        $sN = (int) $m[1];
        $eN = (int) $m[2];
        if ($sN > $maxS || ($sN === $maxS && $eN > $maxE)) {
            $maxS = $sN;
            $maxE = $eN;
        }
    }

    return [
        'watchedEpisodes'      => $watched,
        'episodeWatchCounts'   => $counts ?: null,
        'episodeDates'         => $dates ?: null,
        'currentSeason'        => $maxS ?: ($existing['currentSeason'] ?? ($incoming['currentSeason'] ?? null)),
        'currentEpisode'       => $maxE ?: ($existing['currentEpisode'] ?? ($incoming['currentEpisode'] ?? null)),
    ];
}

function library_sync_episodes(PDO $pdo, string $userId, string $mediaKey, array $watchedKeys, ?array $episodeDates = null, ?array $watchCounts = null): void {
    $pdo->prepare('DELETE FROM user_episodes WHERE user_id = ? AND media_key = ?')->execute([$userId, $mediaKey]);
    if (!$watchedKeys) return;

    $ins = $pdo->prepare(
        'INSERT INTO user_episodes (user_id, media_key, season, episode, watched_at, watch_count) VALUES (?, ?, ?, ?, ?, ?)'
    );
    foreach ($watchedKeys as $key) {
        if (!preg_match('/^S(\d+)E(\d+)$/', $key, $m)) continue;
        $watchedAt = null;
        if (is_array($episodeDates) && isset($episodeDates[$key])) {
            $watchedAt = normalize_datetime($episodeDates[$key]);
        }
        $count = 1;
        if (is_array($watchCounts) && isset($watchCounts[$key])) {
            $count = max(1, (int) $watchCounts[$key]);
        }
        $ins->execute([
            $userId,
            $mediaKey,
            (int) $m[1],
            (int) $m[2],
            $watchedAt ?? date('Y-m-d H:i:s'),
            $count,
        ]);
    }
}

function library_sync_entry_episodes(PDO $pdo, string $userId, string $mediaKey, array $entry): void {
    library_sync_episodes(
        $pdo,
        $userId,
        $mediaKey,
        $entry['watchedEpisodes'] ?? [],
        library_entry_episode_dates($entry),
        library_entry_episode_watch_counts($entry)
    );
}

function library_get_entry(PDO $pdo, string $userId, string $mediaKey): array {
    $stmt = $pdo->prepare('SELECT * FROM user_media WHERE user_id = ? AND media_key = ?');
    $stmt->execute([$userId, $mediaKey]);
    $row = $stmt->fetch();

    $epStmt = $pdo->prepare(
        'SELECT season, episode, watched_at, watch_count FROM user_episodes WHERE user_id = ? AND media_key = ?'
    );
    $epStmt->execute([$userId, $mediaKey]);
    $eps = $epStmt->fetchAll();

    if (!$row) {
        return [
            'id' => $mediaKey,
            'status' => 'watching',
            'addedAt' => date('c'),
            'watchedEpisodes' => [],
            'reactions' => [],
        ];
    }
    return library_row_to_entry($row, $eps);
}

function library_apply_xp(PDO $pdo, string $userId, int $delta, bool $bumpStreak): array {
    $stats = library_fetch_stats($pdo, $userId);
    $xp = max(0, (int) $stats['xp'] + $delta);
    $patch = ['xp' => $xp, 'level' => library_level_from_xp($xp)];
    if ($bumpStreak) {
        $patch = array_merge($patch, library_bump_streak($stats));
    }
    library_save_stats($pdo, $userId, $patch);
    return $patch;
}

function library_add_to_list(PDO $pdo, string $userId, string $id, string $status, ?array $meta): array {
    $entry = library_get_entry($pdo, $userId, $id);
    if (empty($entry['addedAt']) || !isset($entry['status'])) {
        $entry['addedAt'] = date('c');
    }
    $entry['status'] = $status;
    if ($meta) {
        foreach (['title', 'posterUrl', 'backdropUrl', 'type', 'year'] as $k) {
            if (array_key_exists($k, $meta) && $meta[$k] !== null) $entry[$k] = $meta[$k];
        }
    }
    $isMovie = ($entry['type'] ?? '') === 'movie' || str_starts_with($id, 'movie-');
    if ($isMovie && $status === 'completed' && max(0, (int) ($entry['watchCount'] ?? 0)) < 1) {
        $entry['watchCount'] = 1;
        $entry['lastWatchedAt'] = date('c');
    }
    library_upsert_media($pdo, $userId, $id, $entry);
    if (!empty($entry['watchedEpisodes'])) {
        library_sync_entry_episodes($pdo, $userId, $id, $entry);
    }
    library_apply_xp($pdo, $userId, 10, false);
    return library_fetch_state($pdo, $userId);
}

function library_set_status(PDO $pdo, string $userId, string $id, string $status, ?array $meta): array {
    $exists = $pdo->prepare('SELECT 1 FROM user_media WHERE user_id = ? AND media_key = ? LIMIT 1');
    $exists->execute([$userId, $id]);
    if (!$exists->fetchColumn()) {
        return library_add_to_list($pdo, $userId, $id, $status, $meta);
    }

    $parsed = library_parse_media_key($id);
    $sets = ['status = ?', 'updated_at = NOW()'];
    $vals = [$status];

    if ($meta) {
        $map = [
            'title'       => 'title',
            'posterUrl'   => 'poster_url',
            'backdropUrl' => 'backdrop_url',
            'type'        => 'media_type',
            'year'        => 'year',
        ];
        foreach ($map as $client => $db) {
            if (!array_key_exists($client, $meta) || $meta[$client] === null) continue;
            $sets[] = "$db = COALESCE($db, ?)";
            $vals[] = $meta[$client];
        }
    }

    $type = is_array($meta) ? ($meta['type'] ?? null) : null;
    $isMovie = $type === 'movie' || ($parsed['type'] ?? '') === 'movie' || str_starts_with($id, 'movie-');
    if ($isMovie && $status === 'completed') {
        $sets[] = 'watch_count = GREATEST(watch_count, 1)';
        $sets[] = 'last_watched_at = COALESCE(last_watched_at, NOW())';
    }

    $vals[] = $userId;
    $vals[] = $id;
    $pdo->prepare(
        'UPDATE user_media SET ' . implode(', ', $sets) . ' WHERE user_id = ? AND media_key = ?'
    )->execute($vals);

    return library_fetch_state($pdo, $userId);
}

/** Preferito come flag indipendente: NON tocca lo stato. Crea l'entry se manca. */
function library_set_favorite(PDO $pdo, string $userId, string $id, bool $favorite, ?array $meta): array {
    $exists = $pdo->prepare('SELECT 1 FROM user_media WHERE user_id = ? AND media_key = ? LIMIT 1');
    $exists->execute([$userId, $id]);

    if (!$exists->fetchColumn()) {
        // Preferito su un titolo non ancora in libreria: entry minima "da vedere".
        $entry = ['status' => 'plan_to_watch', 'favorite' => $favorite, 'addedAt' => date('c')];
        if ($meta) {
            foreach (['title', 'posterUrl', 'backdropUrl', 'type', 'year'] as $k) {
                if (array_key_exists($k, $meta) && $meta[$k] !== null) $entry[$k] = $meta[$k];
            }
        }
        library_upsert_media($pdo, $userId, $id, $entry);
        return library_fetch_state($pdo, $userId);
    }

    $pdo->prepare(
        'UPDATE user_media SET is_favorite = ?, updated_at = NOW() WHERE user_id = ? AND media_key = ?'
    )->execute([$favorite ? 1 : 0, $userId, $id]);

    return library_fetch_state($pdo, $userId);
}

function library_remove_from_list(PDO $pdo, string $userId, string $id): array {
    $pdo->prepare('DELETE FROM user_episodes WHERE user_id = ? AND media_key = ?')->execute([$userId, $id]);
    $pdo->prepare('DELETE FROM user_media WHERE user_id = ? AND media_key = ?')->execute([$userId, $id]);
    return library_fetch_state($pdo, $userId);
}

function library_dismiss(PDO $pdo, string $userId, string $id): array {
    $stats = library_fetch_stats($pdo, $userId);
    $dismissed = parse_json($stats['dismissed'] ?? null, []);
    if (!is_array($dismissed)) $dismissed = [];
    $dismissed[] = $id;
    $dismissed = array_values(array_unique($dismissed));
    library_save_stats($pdo, $userId, ['dismissed' => $dismissed]);
    return library_fetch_state($pdo, $userId);
}

function library_toggle_episode(
    PDO $pdo,
    string $userId,
    string $id,
    int $season,
    int $episode,
    int $episodesPerSeason,
    int $totalSeasons,
    ?array $meta = null,
    bool $unwatch = false,
): array {
    $entry = library_get_entry($pdo, $userId, $id);
    // Backfill: se la entry nasce dal toggle (serie mai aggiunta) salva titolo/poster.
    if ($meta) {
        foreach (['title', 'posterUrl', 'backdropUrl', 'type', 'year'] as $k) {
            if (array_key_exists($k, $meta) && $meta[$k] !== null && ($entry[$k] ?? null) === null) {
                $entry[$k] = $meta[$k];
            }
        }
    }
    $key = library_episode_key($season, $episode);
    $watched = array_fill_keys($entry['watchedEpisodes'] ?? [], true);
    $counts = is_array($entry['episodeWatchCounts'] ?? null) ? $entry['episodeWatchCounts'] : [];
    foreach (array_keys($watched) as $k) {
        if (!isset($counts[$k])) $counts[$k] = 1;
    }
    $wasWatched = isset($watched[$key]);
    $seasonWasComplete = library_is_season_complete($watched, $season, $episodesPerSeason);

    if ($unwatch) {
        if (!$wasWatched) return library_fetch_state($pdo, $userId);
        $currentCount = max(1, (int) ($counts[$key] ?? 1));
        if ($currentCount > 1) {
            $counts[$key] = $currentCount - 1;
            $xpDelta = -15;
            $bumpStreak = false;
        } else {
            unset($watched[$key], $counts[$key]);
            $xpDelta = -15;
            $bumpStreak = false;
            // Stagione era completa e ora no → togli anche il bonus una tantum.
            if ($seasonWasComplete && !library_is_season_complete($watched, $season, $episodesPerSeason)) {
                $xpDelta -= 50;
            }
        }
    } else {
        if ($wasWatched) {
            $counts[$key] = max(1, (int) ($counts[$key] ?? 1)) + 1;
            $xpDelta = 15;
            $bumpStreak = true;
        } else {
            $watched[$key] = true;
            $counts[$key] = 1;
            $xpDelta = 15;
            $bumpStreak = true;
            // Bonus stagione solo la prima volta che la stagione si completa.
            if (!$seasonWasComplete && library_is_season_complete($watched, $season, $episodesPerSeason)) {
                $xpDelta += 50;
            }
        }
        $entry['lastWatchedAt'] = date('c');
    }

    $maxS = 0; $maxE = 0;
    foreach (array_keys($watched) as $k) {
        if (!preg_match('/^S(\d+)E(\d+)$/', $k, $m)) continue;
        $sN = (int) $m[1]; $eN = (int) $m[2];
        if ($sN > $maxS || ($sN === $maxS && $eN > $maxE)) { $maxS = $sN; $maxE = $eN; }
    }

    $watchedList = array_keys($watched);

    $entry['watchedEpisodes'] = $watchedList;
    $entry['episodeWatchCounts'] = $counts ?: null;
    $entry['currentSeason'] = $maxS ?: null;
    $entry['currentEpisode'] = $maxE ?: null;
    // Non segnare "completed" col toggle: il calcolo totalSeasons×epsPerSeason è inaffidabile.
    // Lo stato "visto" si imposta manualmente o con mark_all_watched / sync TMDB.
    if ($entry['status'] !== 'completed' && $entry['status'] !== 'favorite' && $entry['status'] !== 'dropped') {
        $entry['status'] = count($watched) > 0 ? 'watching' : ($entry['status'] ?? 'plan_to_watch');
    }

    library_upsert_media($pdo, $userId, $id, $entry);
    library_sync_entry_episodes($pdo, $userId, $id, $entry);
    library_apply_xp($pdo, $userId, $xpDelta, $bumpStreak);
    return library_fetch_state($pdo, $userId);
}

function library_mark_all_watched(PDO $pdo, string $userId, string $id, array $seasons, bool $onlyAired, ?array $meta): array {
    $entry = library_get_entry($pdo, $userId, $id);
    $watched = array_fill_keys($entry['watchedEpisodes'] ?? [], true);
    $today = library_today();
    $added = 0;
    $maxS = 0; $maxE = 0;

    foreach ($seasons as $se) {
        $sn = (int) ($se['seasonNumber'] ?? 0);
        $count = (int) ($se['episodeCount'] ?? 0);
        $air = $se['airDate'] ?? null;
        if ($onlyAired && $air && $air > $today) continue;
        for ($ep = 1; $ep <= $count; $ep++) {
            $k = library_episode_key($sn, $ep);
            if (!isset($watched[$k])) { $watched[$k] = true; $added++; }
            if ($sn > $maxS || ($sn === $maxS && $ep > $maxE)) { $maxS = $sn; $maxE = $ep; }
        }
    }

    $watchedList = array_keys($watched);
    $counts = is_array($entry['episodeWatchCounts'] ?? null) ? $entry['episodeWatchCounts'] : [];
    foreach ($watchedList as $k) {
        if (!isset($counts[$k])) $counts[$k] = 1;
    }
    $entry['watchedEpisodes'] = $watchedList;
    $entry['episodeWatchCounts'] = $counts ?: null;
    $entry['currentSeason'] = $maxS ?: ($entry['currentSeason'] ?? null);
    $entry['currentEpisode'] = $maxE ?: ($entry['currentEpisode'] ?? null);
    $entry['status'] = 'completed';
    if ($meta) {
        foreach (['title', 'posterUrl', 'backdropUrl', 'type', 'year'] as $k) {
            if (array_key_exists($k, $meta) && $meta[$k] !== null) $entry[$k] = $meta[$k];
        }
    }
    if ($added > 0) $entry['lastWatchedAt'] = date('c');

    library_upsert_media($pdo, $userId, $id, $entry);
    library_sync_entry_episodes($pdo, $userId, $id, $entry);
    if ($added > 0) {
        library_apply_xp($pdo, $userId, $added * 15 + 100, true);
    }
    return library_fetch_state($pdo, $userId);
}

function library_clear_watched(PDO $pdo, string $userId, string $id, ?string $restoreStatus): array {
    $entry = library_get_entry($pdo, $userId, $id);
    $entry['watchedEpisodes'] = [];
    $entry['episodeWatchCounts'] = null;
    $entry['currentSeason'] = null;
    $entry['currentEpisode'] = null;
    $entry['status'] = $restoreStatus ?? ($entry['status'] ?? 'watching');
    library_upsert_media($pdo, $userId, $id, $entry);
    library_sync_entry_episodes($pdo, $userId, $id, $entry);
    return library_fetch_state($pdo, $userId);
}

function library_set_rating(PDO $pdo, string $userId, string $id, ?int $rating): array {
    $entry = library_get_entry($pdo, $userId, $id);
    $entry['rating'] = $rating;
    if (empty($entry['status'])) $entry['status'] = 'plan_to_watch';
    library_upsert_media($pdo, $userId, $id, $entry);
    library_sync_entry_episodes($pdo, $userId, $id, $entry);
    return library_fetch_state($pdo, $userId);
}

function library_set_notes(PDO $pdo, string $userId, string $id, string $notes): array {
    $entry = library_get_entry($pdo, $userId, $id);
    // L'upsert usa COALESCE su notes: per svuotare va salvata stringa vuota,
    // non null (null preserverebbe il valore precedente).
    $entry['notes'] = mb_substr($notes, 0, 1000);
    if (empty($entry['status'])) $entry['status'] = 'plan_to_watch';
    library_upsert_media($pdo, $userId, $id, $entry);
    return library_fetch_state($pdo, $userId);
}

function library_log_movie_watch(PDO $pdo, string $userId, string $id, ?array $meta = null): array {
    $entry = library_get_entry($pdo, $userId, $id);
    if ($meta) {
        foreach (['title', 'posterUrl', 'backdropUrl', 'type', 'year'] as $k) {
            if (array_key_exists($k, $meta) && $meta[$k] !== null && ($entry[$k] ?? null) === null) {
                $entry[$k] = $meta[$k];
            }
        }
    }
    $count = max(0, (int) ($entry['watchCount'] ?? 0));
    if ($count === 0) {
        $count = 1;
        if (($entry['status'] ?? '') !== 'completed' && ($entry['status'] ?? '') !== 'favorite') {
            $entry['status'] = 'completed';
        }
    } else {
        $count++;
    }
    $entry['watchCount'] = $count;
    $entry['lastWatchedAt'] = date('c');
    library_upsert_media($pdo, $userId, $id, $entry);
    library_apply_xp($pdo, $userId, 15, true);
    return library_fetch_state($pdo, $userId);
}

function library_set_reaction(PDO $pdo, string $userId, string $id, int $season, int $episode, ?string $emoji): array {
    $entry = library_get_entry($pdo, $userId, $id);
    $reactions = is_array($entry['reactions'] ?? null) ? $entry['reactions'] : [];
    $key = library_episode_key($season, $episode);
    if ($emoji) $reactions[$key] = $emoji; else unset($reactions[$key]);
    $entry['reactions'] = $reactions;
    library_upsert_media($pdo, $userId, $id, $entry);
    library_sync_entry_episodes($pdo, $userId, $id, $entry);
    return library_fetch_state($pdo, $userId);
}

/**
 * Episodi segnati in-app DOPO l'import originale (watched_at > added_at + 10').
 * Il margine di 10 minuti copre gli import vecchi che scrivevano watched_at
 * qualche secondo dopo added_at; i nuovi import usano le date storiche TV Time.
 */
function library_post_import_episode_keys(PDO $pdo, string $userId, string $mediaKey): array {
    $stmt = $pdo->prepare(
        'SELECT ue.season, ue.episode
         FROM user_episodes ue
         JOIN user_media um ON um.user_id = ue.user_id AND um.media_key = ue.media_key
         WHERE ue.user_id = ? AND ue.media_key = ?
           AND ue.watched_at > DATE_ADD(um.added_at, INTERVAL 10 MINUTE)'
    );
    $stmt->execute([$userId, $mediaKey]);
    $keys = [];
    foreach ($stmt->fetchAll() as $r) {
        $keys[] = library_episode_key((int) $r['season'], (int) $r['episode']);
    }
    return $keys;
}

/**
 * Rimuove le serie "fantasma" di un vecchio import TV Time (match sbagliati):
 * source tvtime, non presenti nel re-import corretto, mai toccate dopo
 * l'import (nessun episodio post-import, entry mai aggiornata). Solo serie TV.
 */
function library_repair_cleanup(PDO $pdo, string $userId, array $keepIds): int {
    $stmt = $pdo->prepare(
        "SELECT media_key FROM user_media
         WHERE user_id = ? AND source = 'tvtime' AND media_key LIKE 'tv-%'
           AND updated_at < DATE_ADD(added_at, INTERVAL 10 MINUTE)
           AND NOT EXISTS (
             SELECT 1 FROM user_episodes ue
             WHERE ue.user_id = user_media.user_id AND ue.media_key = user_media.media_key
               AND ue.watched_at > DATE_ADD(user_media.added_at, INTERVAL 10 MINUTE)
           )"
    );
    $stmt->execute([$userId]);
    $keep = array_fill_keys(array_map('strval', $keepIds), true);
    $removed = 0;
    foreach ($stmt->fetchAll() as $r) {
        $key = (string) $r['media_key'];
        if (isset($keep[$key])) continue;
        $pdo->prepare('DELETE FROM user_episodes WHERE user_id = ? AND media_key = ?')->execute([$userId, $key]);
        $pdo->prepare('DELETE FROM user_media WHERE user_id = ? AND media_key = ?')->execute([$userId, $key]);
        $removed++;
    }
    return $removed;
}

function library_bulk_import(PDO $pdo, string $userId, array $entries, bool $withXp, ?array $importPending = null, bool $replaceEpisodes = false, bool $mergeImport = false): array {
    $added = 0;
    foreach ($entries as $e) {
        if (!is_array($e) || empty($e['id'])) continue;
        $existing = library_get_entry($pdo, $userId, $e['id']);
        $merged = array_merge($existing, $e);
        if (!empty($existing['addedAt'])) $merged['addedAt'] = $existing['addedAt'];
        $statusMerged = library_merge_status($existing, $e);
        if ($statusMerged !== null) $merged['status'] = $statusMerged;

        if ($mergeImport) {
            foreach (['title', 'posterUrl', 'backdropUrl', 'year'] as $k) {
                if (!empty($existing[$k])) $merged[$k] = $existing[$k];
            }
            $merged = array_merge($merged, library_merge_episode_fields($existing, $e));
            if (isset($e['rating']) && $e['rating'] !== null) {
                $merged['rating'] = max((int) ($existing['rating'] ?? 0), (int) $e['rating']) ?: null;
            }
            if (isset($e['watchCount']) && (int) $e['watchCount'] > 0) {
                $merged['watchCount'] = max((int) ($existing['watchCount'] ?? 0), (int) $e['watchCount']);
            }
        } else {
            $epDates = library_entry_episode_dates($merged);
            if ($epDates) {
                $maxWatch = null;
                foreach ($epDates as $d) {
                    $n = normalize_datetime($d);
                    if (!$maxWatch || $n > $maxWatch) $maxWatch = $n;
                }
                if ($maxWatch) {
                    $cur = isset($merged['lastWatchedAt']) ? normalize_datetime($merged['lastWatchedAt']) : null;
                    if (!$cur || $maxWatch > $cur) $merged['lastWatchedAt'] = date('c', strtotime($maxWatch));
                }
            }
            $wExisting = is_array($existing['watchedEpisodes'] ?? null) ? $existing['watchedEpisodes'] : [];
            $wNew = is_array($e['watchedEpisodes'] ?? null) ? $e['watchedEpisodes'] : [];
            if ($replaceEpisodes && ($e['source'] ?? '') === 'tvtime') {
                $isTv = ($e['type'] ?? '') === 'tv' || str_starts_with((string) $e['id'], 'tv-');
                if ($isTv) {
                    // Sostituisci i dati del vecchio import ma conserva SEMPRE
                    // gli episodi segnati manualmente dopo l'import.
                    $manual = library_post_import_episode_keys($pdo, $userId, (string) $e['id']);
                    $merged['watchedEpisodes'] = array_values(array_unique(array_merge($wNew, $manual)));
                    $countsNew = is_array($e['episodeWatchCounts'] ?? null) ? $e['episodeWatchCounts'] : [];
                    $merged['episodeWatchCounts'] = $countsNew ?: null;
                }
            } elseif (count($wNew) > 0) {
                $merged['watchedEpisodes'] = array_values(array_unique($wNew));
                $countsNew = is_array($e['episodeWatchCounts'] ?? null) ? $e['episodeWatchCounts'] : [];
                if ($countsNew) $merged['episodeWatchCounts'] = $countsNew;
            } elseif ($wExisting || $wNew) {
                $merged['watchedEpisodes'] = array_values(array_unique(array_merge($wExisting, $wNew)));
            }
            $countsExisting = is_array($existing['episodeWatchCounts'] ?? null) ? $existing['episodeWatchCounts'] : [];
            $countsIncoming = is_array($e['episodeWatchCounts'] ?? null) ? $e['episodeWatchCounts'] : [];
            if ($countsIncoming && !($replaceEpisodes && ($e['source'] ?? '') === 'tvtime')) {
                $mergedCounts = $countsExisting;
                foreach ($countsIncoming as $k => $v) {
                    $mergedCounts[$k] = max((int) ($mergedCounts[$k] ?? 0), max(1, (int) $v));
                }
                $merged['episodeWatchCounts'] = $mergedCounts ?: null;
            }
            if (isset($e['watchCount']) && (int) $e['watchCount'] > 0) {
                $merged['watchCount'] = max((int) ($existing['watchCount'] ?? 0), (int) $e['watchCount']);
            }
        }

        $epDates = library_entry_episode_dates($merged);
        if ($epDates) {
            $maxWatch = null;
            foreach ($epDates as $d) {
                $n = normalize_datetime($d);
                if (!$maxWatch || $n > $maxWatch) $maxWatch = $n;
            }
            if ($maxWatch) {
                $cur = isset($merged['lastWatchedAt']) ? normalize_datetime($merged['lastWatchedAt']) : null;
                if (!$cur || $maxWatch > $cur) $merged['lastWatchedAt'] = date('c', strtotime($maxWatch));
            }
        }

        library_upsert_media($pdo, $userId, $e['id'], $merged);
        library_sync_entry_episodes($pdo, $userId, $e['id'], $merged);
        if (!$mergeImport && (empty($existing['status']) || $existing['status'] === 'watching' && count($existing['watchedEpisodes'] ?? []) === 0)) {
            $added++;
        }
    }
    if ($importPending !== null) {
        library_save_stats($pdo, $userId, ['import_pending' => $importPending]);
    }
    if ($withXp && $added > 0) {
        library_apply_xp($pdo, $userId, $added * 5, false);
    }
    return library_fetch_state($pdo, $userId);
}

function library_import_local(PDO $pdo, string $userId, array $localState): array {
    $statsPatch = [
        'xp'              => (int) ($localState['xp'] ?? 0),
        'level'           => library_level_from_xp((int) ($localState['xp'] ?? 0)),
        'streak_days'     => (int) ($localState['streak'] ?? 0),
        'last_active_day' => $localState['lastActiveDay'] ?? null,
        'onboarding_done' => !empty($localState['onboardingDone']),
        'language'        => normalize_locale($localState['language'] ?? 'it'),
        'favorite_genres' => $localState['favoriteGenres'] ?? [],
        'mood_profile'    => $localState['moodProfile'] ?? null,
        'upcoming_filters'=> $localState['upcomingFilters'] ?? library_default_filters(),
        'dismissed'       => $localState['dismissed'] ?? [],
        'achievements'    => $localState['achievements'] ?? [],
        'local_migrated'  => 1,
    ];
    library_ensure_stats($pdo, $userId);
    library_save_stats($pdo, $userId, $statsPatch);

    $entries = [];
    foreach (($localState['media'] ?? []) as $entry) {
        if (is_array($entry) && !empty($entry['id'])) $entries[] = $entry;
    }
    library_bulk_import($pdo, $userId, $entries, false);
    library_save_stats($pdo, $userId, [
        'xp'    => (int) ($localState['xp'] ?? 0),
        'level' => library_level_from_xp((int) ($localState['xp'] ?? 0)),
    ]);
    return library_fetch_state($pdo, $userId);
}

function library_patch_settings(PDO $pdo, string $userId, array $patch): array {
    $map = [
        'onboardingDone'  => 'onboarding_done',
        'language'        => 'language',
        'favoriteGenres'  => 'favorite_genres',
        'moodProfile'     => 'mood_profile',
        'platforms'       => 'platforms',
        'upcomingFilters' => 'upcoming_filters',
        'dismissed'       => 'dismissed',
        'achievements'    => 'achievements',
        'xp'              => 'xp',
        'level'           => 'level',
        'streak'          => 'streak_days',
        'lastActiveDay'   => 'last_active_day',
        'localMigrated'   => 'local_migrated',
        'importPending'   => 'import_pending',
    ];
    $dbPatch = [];
    foreach ($map as $client => $db) {
        if (array_key_exists($client, $patch)) $dbPatch[$db] = $patch[$client];
    }
    if (isset($patch['xp']) && !isset($patch['level'])) {
        $dbPatch['level'] = library_level_from_xp((int) $patch['xp']);
    }
    library_save_stats($pdo, $userId, $dbPatch);
    return library_fetch_state($pdo, $userId);
}

function library_skip_local_migration(PDO $pdo, string $userId): array {
    library_save_stats($pdo, $userId, ['local_migrated' => 1]);
    return library_fetch_state($pdo, $userId);
}

/** Statistiche di visione aggregate (episodi/mese, top binge). */
function library_fetch_watch_stats(PDO $pdo, string $userId): array {
    $monthStmt = $pdo->prepare(
        'SELECT DATE_FORMAT(watched_at, "%Y-%m") AS ym, SUM(watch_count) AS cnt
         FROM user_episodes WHERE user_id = ? GROUP BY ym ORDER BY ym ASC'
    );
    $monthStmt->execute([$userId]);
    $byMonth = [];
    foreach ($monthStmt->fetchAll() as $row) {
        $byMonth[] = ['month' => $row['ym'], 'episodes' => (int) $row['cnt']];
    }

    $topStmt = $pdo->prepare(
        'SELECT um.title, um.media_key, SUM(ue.watch_count) AS ep_count
         FROM user_episodes ue
         JOIN user_media um ON um.user_id = ue.user_id AND um.media_key = ue.media_key
         WHERE ue.user_id = ?
         GROUP BY ue.media_key, um.title
         ORDER BY ep_count DESC
         LIMIT 10'
    );
    $topStmt->execute([$userId]);
    $topShows = [];
    foreach ($topStmt->fetchAll() as $row) {
        $topShows[] = [
            'title'    => $row['title'] ?? $row['media_key'],
            'mediaKey' => $row['media_key'],
            'episodes' => (int) $row['ep_count'],
        ];
    }

    $totStmt = $pdo->prepare('SELECT COALESCE(SUM(watch_count), 0) FROM user_episodes WHERE user_id = ?');
    $totStmt->execute([$userId]);
    $totalEpisodes = (int) $totStmt->fetchColumn();

    // Blocco per l'anno corrente — alimenta il Wrapped.
    $year = (int) date('Y');
    $yearTopStmt = $pdo->prepare(
        'SELECT um.title, um.media_key, SUM(ue.watch_count) AS ep_count
         FROM user_episodes ue
         JOIN user_media um ON um.user_id = ue.user_id AND um.media_key = ue.media_key
         WHERE ue.user_id = ? AND YEAR(ue.watched_at) = ?
         GROUP BY ue.media_key, um.title
         ORDER BY ep_count DESC
         LIMIT 5'
    );
    $yearTopStmt->execute([$userId, $year]);
    $yearTop = [];
    foreach ($yearTopStmt->fetchAll() as $row) {
        $yearTop[] = [
            'title'    => $row['title'] ?? $row['media_key'],
            'mediaKey' => $row['media_key'],
            'episodes' => (int) $row['ep_count'],
        ];
    }

    $yearEpisodes = 0;
    $busiest = null;
    foreach ($byMonth as $m) {
        if (strpos($m['month'], (string) $year) !== 0) continue;
        $yearEpisodes += $m['episodes'];
        if ($busiest === null || $m['episodes'] > $busiest['episodes']) $busiest = $m;
    }

    // Serie completate quest'anno (status completed aggiornato nell'anno).
    $doneStmt = $pdo->prepare(
        "SELECT COUNT(*) FROM user_media
         WHERE user_id = ? AND status = 'completed' AND media_key LIKE 'tv-%' AND YEAR(updated_at) = ?"
    );
    $doneStmt->execute([$userId, $year]);

    return [
        'totalEpisodes' => $totalEpisodes,
        'hoursEstimate' => (int) round($totalEpisodes * 45 / 60),
        'byMonth'       => $byMonth,
        'topShows'      => $topShows,
        'year'          => [
            'year'            => $year,
            'episodes'        => $yearEpisodes,
            'hoursEstimate'   => (int) round($yearEpisodes * 45 / 60),
            'topShows'        => $yearTop,
            'busiestMonth'    => $busiest,
            'completedSeries' => (int) $doneStmt->fetchColumn(),
        ],
    ];
}
