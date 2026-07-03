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
        'favorite_genres', 'mood_profile', 'upcoming_filters', 'dismissed', 'achievements', 'local_migrated',
        'import_pending',
    ];
    $sets = [];
    $vals = [];
    foreach ($allowed as $k) {
        if (!array_key_exists($k, $patch)) continue;
        $v = $patch[$k];
        if (in_array($k, ['favorite_genres', 'mood_profile', 'upcoming_filters', 'dismissed', 'achievements', 'import_pending'], true)) {
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
    $lastFromEps = null;
    foreach ($episodes as $ep) {
        $watched[] = library_episode_key((int) $ep['season'], (int) $ep['episode']);
        if (!empty($ep['watched_at'])) {
            $t = date('c', strtotime($ep['watched_at']));
            if (!$lastFromEps || $t > $lastFromEps) $lastFromEps = $t;
        }
    }

    $lastWatched = $row['last_watched_at'] ? date('c', strtotime($row['last_watched_at'])) : null;
    if ($lastFromEps && (!$lastWatched || $lastFromEps > $lastWatched)) {
        $lastWatched = $lastFromEps;
    }

    return [
        'id'              => $row['media_key'],
        'status'          => $row['status'],
        'rating'          => $row['rating'] !== null ? (int) $row['rating'] : null,
        'currentSeason'   => $row['current_season'] !== null ? (int) $row['current_season'] : null,
        'currentEpisode'  => $row['current_episode'] !== null ? (int) $row['current_episode'] : null,
        'watchedEpisodes' => $watched,
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
        'SELECT media_key, season, episode, watched_at FROM user_episodes WHERE user_id = ? ORDER BY season, episode'
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
        'language'         => ($stats['language'] ?? 'it') === 'en' ? 'en' : 'it',
        'favoriteGenres'   => parse_json($stats['favorite_genres'] ?? null, []),
        'moodProfile'      => parse_json($stats['mood_profile'] ?? null, null),
        'upcomingFilters'  => $filters,
        'localMigrated'    => !empty($stats['local_migrated']),
        'importPending'    => parse_json($stats['import_pending'] ?? null, []),
    ];
}

function library_upsert_media(PDO $pdo, string $userId, string $mediaKey, array $entry): void {
    $parsed = library_parse_media_key($mediaKey);
    $type = $entry['type'] ?? ($parsed['type'] ?? null);
    $tmdbId = $parsed['tmdb_id'] ?? null;

    $pdo->prepare(
        'INSERT INTO user_media
         (user_id, media_key, tmdb_id, media_type, status, rating, current_season, current_episode,
          reactions, notes, title, poster_url, backdrop_url, year, source, added_at, last_watched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()), ?)
         ON DUPLICATE KEY UPDATE
           status = VALUES(status),
           rating = COALESCE(VALUES(rating), rating),
           current_season = VALUES(current_season),
           current_episode = VALUES(current_episode),
           reactions = COALESCE(VALUES(reactions), reactions),
           notes = COALESCE(VALUES(notes), notes),
           title = COALESCE(VALUES(title), title),
           poster_url = COALESCE(VALUES(poster_url), poster_url),
           backdrop_url = COALESCE(VALUES(backdrop_url), backdrop_url),
           year = COALESCE(VALUES(year), year),
           source = COALESCE(VALUES(source), source),
           last_watched_at = VALUES(last_watched_at),
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
        normalize_datetime($entry['addedAt'] ?? null),
        isset($entry['lastWatchedAt']) ? normalize_datetime($entry['lastWatchedAt']) : null,
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

function library_sync_episodes(PDO $pdo, string $userId, string $mediaKey, array $watchedKeys, ?array $episodeDates = null): void {
    $pdo->prepare('DELETE FROM user_episodes WHERE user_id = ? AND media_key = ?')->execute([$userId, $mediaKey]);
    if (!$watchedKeys) return;

    $ins = $pdo->prepare(
        'INSERT INTO user_episodes (user_id, media_key, season, episode, watched_at) VALUES (?, ?, ?, ?, ?)'
    );
    foreach ($watchedKeys as $key) {
        if (!preg_match('/^S(\d+)E(\d+)$/', $key, $m)) continue;
        $watchedAt = null;
        if (is_array($episodeDates) && isset($episodeDates[$key])) {
            $watchedAt = normalize_datetime($episodeDates[$key]);
        }
        $ins->execute([
            $userId,
            $mediaKey,
            (int) $m[1],
            (int) $m[2],
            $watchedAt ?? date('Y-m-d H:i:s'),
        ]);
    }
}

function library_get_entry(PDO $pdo, string $userId, string $mediaKey): array {
    $stmt = $pdo->prepare('SELECT * FROM user_media WHERE user_id = ? AND media_key = ?');
    $stmt->execute([$userId, $mediaKey]);
    $row = $stmt->fetch();

    $epStmt = $pdo->prepare(
        'SELECT season, episode FROM user_episodes WHERE user_id = ? AND media_key = ?'
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
    library_upsert_media($pdo, $userId, $id, $entry);
    library_sync_episodes($pdo, $userId, $id, $entry['watchedEpisodes'] ?? []);
    library_apply_xp($pdo, $userId, 10, false);
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
): array {
    $entry = library_get_entry($pdo, $userId, $id);
    $key = library_episode_key($season, $episode);
    $watched = array_fill_keys($entry['watchedEpisodes'] ?? [], true);
    $wasWatched = isset($watched[$key]);
    if ($wasWatched) unset($watched[$key]); else $watched[$key] = true;

    $maxS = 0; $maxE = 0;
    foreach (array_keys($watched) as $k) {
        if (!preg_match('/^S(\d+)E(\d+)$/', $k, $m)) continue;
        $sN = (int) $m[1]; $eN = (int) $m[2];
        if ($sN > $maxS || ($sN === $maxS && $eN > $maxE)) { $maxS = $sN; $maxE = $eN; }
    }

    $watchedList = array_keys($watched);

    $entry['watchedEpisodes'] = $watchedList;
    $entry['currentSeason'] = $maxS ?: null;
    $entry['currentEpisode'] = $maxE ?: null;
    // Non segnare "completed" col toggle: il calcolo totalSeasons×epsPerSeason è inaffidabile.
    // Lo stato "visto" si imposta manualmente o con mark_all_watched / sync TMDB.
    if ($entry['status'] !== 'completed' && $entry['status'] !== 'favorite' && $entry['status'] !== 'dropped') {
        $entry['status'] = count($watched) > 0 ? 'watching' : ($entry['status'] ?? 'plan_to_watch');
    }
    $entry['lastWatchedAt'] = $wasWatched ? ($entry['lastWatchedAt'] ?? null) : date('c');

    $xpDelta = $wasWatched ? -15 : 15;
    if (!$wasWatched) {
        $seasonComplete = true;
        for ($i = 1; $i <= $episodesPerSeason; $i++) {
            if (!isset($watched[library_episode_key($season, $i)])) { $seasonComplete = false; break; }
        }
        if ($seasonComplete) $xpDelta += 50;
    }

    library_upsert_media($pdo, $userId, $id, $entry);
    library_sync_episodes($pdo, $userId, $id, $watchedList);
    library_apply_xp($pdo, $userId, $xpDelta, !$wasWatched);
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
    $entry['watchedEpisodes'] = $watchedList;
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
    library_sync_episodes($pdo, $userId, $id, $watchedList);
    if ($added > 0) {
        library_apply_xp($pdo, $userId, $added * 15 + 100, true);
    }
    return library_fetch_state($pdo, $userId);
}

function library_clear_watched(PDO $pdo, string $userId, string $id, ?string $restoreStatus): array {
    $entry = library_get_entry($pdo, $userId, $id);
    $entry['watchedEpisodes'] = [];
    $entry['currentSeason'] = null;
    $entry['currentEpisode'] = null;
    $entry['status'] = $restoreStatus ?? ($entry['status'] ?? 'watching');
    library_upsert_media($pdo, $userId, $id, $entry);
    library_sync_episodes($pdo, $userId, $id, []);
    return library_fetch_state($pdo, $userId);
}

function library_set_rating(PDO $pdo, string $userId, string $id, ?int $rating): array {
    $entry = library_get_entry($pdo, $userId, $id);
    $entry['rating'] = $rating;
    if (empty($entry['status'])) $entry['status'] = 'plan_to_watch';
    library_upsert_media($pdo, $userId, $id, $entry);
    library_sync_episodes($pdo, $userId, $id, $entry['watchedEpisodes'] ?? []);
    return library_fetch_state($pdo, $userId);
}

function library_set_reaction(PDO $pdo, string $userId, string $id, int $season, int $episode, ?string $emoji): array {
    $entry = library_get_entry($pdo, $userId, $id);
    $reactions = is_array($entry['reactions'] ?? null) ? $entry['reactions'] : [];
    $key = library_episode_key($season, $episode);
    if ($emoji) $reactions[$key] = $emoji; else unset($reactions[$key]);
    $entry['reactions'] = $reactions;
    library_upsert_media($pdo, $userId, $id, $entry);
    library_sync_episodes($pdo, $userId, $id, $entry['watchedEpisodes'] ?? []);
    return library_fetch_state($pdo, $userId);
}

function library_bulk_import(PDO $pdo, string $userId, array $entries, bool $withXp, ?array $importPending = null, bool $replaceEpisodes = false): array {
    $added = 0;
    foreach ($entries as $e) {
        if (!is_array($e) || empty($e['id'])) continue;
        $existing = library_get_entry($pdo, $userId, $e['id']);
        $merged = array_merge($existing, $e);
        if (!empty($existing['addedAt'])) $merged['addedAt'] = $existing['addedAt'];
        $statusMerged = library_merge_status($existing, $e);
        if ($statusMerged !== null) $merged['status'] = $statusMerged;
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
                $merged['watchedEpisodes'] = array_values(array_unique($wNew));
            }
        } elseif (count($wNew) > 0) {
            // Lista episodi esplicita dall'import: sostituisce, non accumula (evita doppioni col vecchio import).
            $merged['watchedEpisodes'] = array_values(array_unique($wNew));
        } elseif ($wExisting || $wNew) {
            $merged['watchedEpisodes'] = array_values(array_unique(array_merge($wExisting, $wNew)));
        }
        library_upsert_media($pdo, $userId, $e['id'], $merged);
        library_sync_episodes($pdo, $userId, $e['id'], $merged['watchedEpisodes'] ?? [], library_entry_episode_dates($merged));
        if (empty($existing['status']) || $existing['status'] === 'watching' && count($existing['watchedEpisodes'] ?? []) === 0) {
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
        'language'        => ($localState['language'] ?? 'it') === 'en' ? 'en' : 'it',
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
        'SELECT DATE_FORMAT(watched_at, "%Y-%m") AS ym, COUNT(*) AS cnt
         FROM user_episodes WHERE user_id = ? GROUP BY ym ORDER BY ym ASC'
    );
    $monthStmt->execute([$userId]);
    $byMonth = [];
    foreach ($monthStmt->fetchAll() as $row) {
        $byMonth[] = ['month' => $row['ym'], 'episodes' => (int) $row['cnt']];
    }

    $topStmt = $pdo->prepare(
        'SELECT um.title, um.media_key, COUNT(*) AS ep_count
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

    $totStmt = $pdo->prepare('SELECT COUNT(*) FROM user_episodes WHERE user_id = ?');
    $totStmt->execute([$userId]);
    $totalEpisodes = (int) $totStmt->fetchColumn();

    return [
        'totalEpisodes' => $totalEpisodes,
        'hoursEstimate' => (int) round($totalEpisodes * 45 / 60),
        'byMonth'       => $byMonth,
        'topShows'      => $topShows,
    ];
}
