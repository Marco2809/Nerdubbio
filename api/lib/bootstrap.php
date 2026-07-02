<?php

function make_unique_handle(PDO $pdo, string $seed): string {
    $base = strtolower(preg_replace('/[^a-z0-9_]/', '', $seed) ?? '');
    if (strlen($base) < 3) $base = 'nerd' . $base;
    if (strlen($base) > 20) $base = substr($base, 0, 20);

    $candidate = $base;
    $suffix = 0;
    $check = $pdo->prepare('SELECT 1 FROM profiles WHERE handle = ? LIMIT 1');
    while (true) {
        $check->execute([$candidate]);
        if (!$check->fetch()) return $candidate;
        $suffix++;
        $candidate = substr($base, 0, 20) . $suffix;
        if (strlen($candidate) > 24) $candidate = 'nerd' . $suffix;
    }
}

function bootstrap_new_user(PDO $pdo, string $userId, string $email, string $displayName, ?string $avatarUrl = null): void {
    $name   = $displayName !== '' ? $displayName : (explode('@', $email)[0] ?: 'Nerd');
    $handle = make_unique_handle($pdo, explode('@', $email)[0] ?: 'nerd');

    $pdo->prepare(
        'INSERT INTO profiles (id, handle, display_name, avatar_url) VALUES (?, ?, ?, ?)'
    )->execute([$userId, $handle, $name, $avatarUrl]);

    $hasAdmin = (bool) $pdo->query("SELECT 1 FROM user_roles WHERE role = 'admin' LIMIT 1")->fetch();
    $pdo->prepare('INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)')
        ->execute([uuid(), $userId, 'user']);
    if (!$hasAdmin) {
        $pdo->prepare('INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)')
            ->execute([uuid(), $userId, 'admin']);
    }

    require_once __DIR__ . '/library.php';
    library_ensure_stats($pdo, $userId);
}

function fetch_profile(PDO $pdo, string $userId): ?array {
    $stmt = $pdo->prepare(
        'SELECT u.id, u.email, p.handle, p.display_name, p.avatar_url, p.bio
         FROM users u
         JOIN profiles p ON p.id = u.id
         WHERE u.id = ?'
    );
    $stmt->execute([$userId]);
    $profile = $stmt->fetch();
    if (!$profile) return null;

    $roles = $pdo->prepare('SELECT role FROM user_roles WHERE user_id = ?');
    $roles->execute([$userId]);
    $profile['roles'] = array_column($roles->fetchAll(), 'role');
    return $profile;
}

function has_role(PDO $pdo, string $userId, string $role): bool {
    $stmt = $pdo->prepare('SELECT 1 FROM user_roles WHERE user_id = ? AND role = ? LIMIT 1');
    $stmt->execute([$userId, $role]);
    return (bool) $stmt->fetch();
}
