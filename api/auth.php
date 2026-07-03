<?php
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/google.php';
require_once __DIR__ . '/lib/bootstrap.php';
cors();

$action = $_GET['action'] ?? '';
$body   = body();

if ($action === 'signup') {
    $email = strtolower(trim($body['email'] ?? ''));
    $pass  = $body['password'] ?? '';
    $name  = trim($body['display_name'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($pass) < 6) {
        json_out(['error' => 'Email o password non validi'], 400);
    }

    $exists = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $exists->execute([$email]);
    if ($exists->fetch()) json_out(['error' => 'Email già registrata'], 409);

    $id   = uuid();
    $hash = password_hash($pass, PASSWORD_BCRYPT);

    $pdo->beginTransaction();
    try {
        $pdo->prepare(
            'INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)'
        )->execute([$id, $email, $hash, $name ?: explode('@', $email)[0]]);
        bootstrap_new_user($pdo, $id, $email, $name);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_out(['error' => 'Errore creazione account'], 500);
    }

    json_out(['token' => make_token($id, $email), 'user' => fetch_profile($pdo, $id)]);
}

if ($action === 'login') {
    $email = strtolower(trim($body['email'] ?? ''));
    $pass  = $body['password'] ?? '';

    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !$user['password_hash'] || !password_verify($pass, $user['password_hash'])) {
        json_out(['error' => 'Credenziali non valide'], 401);
    }

    $profile = fetch_profile($pdo, $user['id']);
    if (!$profile) {
        bootstrap_new_user($pdo, $user['id'], $user['email'], $user['display_name'] ?? '');
        $profile = fetch_profile($pdo, $user['id']);
    }

    json_out(['token' => make_token($user['id'], $user['email']), 'user' => $profile]);
}

if ($action === 'google') {
    $credential = trim($body['credential'] ?? '');
    $clientId   = (string) app_config('google_client_id');

    if (!$clientId) json_out(['error' => 'Login Google non configurato'], 400);
    if (!$credential) json_out(['error' => 'Token Google mancante'], 400);

    $claims = verify_google_id_token($credential, $clientId);
    if (!$claims) json_out(['error' => 'Token Google non valido'], 401);

    $email    = strtolower(trim($claims['email'] ?? ''));
    $sub      = (string) ($claims['sub'] ?? '');
    $name     = trim($claims['name'] ?? '');
    $avatar   = $claims['picture'] ?? null;
    $verified = !empty($claims['email_verified']);

    if (!$email || !$verified) json_out(['error' => 'Email Google non verificata'], 401);

    $stmt = $pdo->prepare('SELECT * FROM users WHERE google_id = ? OR email = ? LIMIT 1');
    $stmt->execute([$sub, $email]);
    $user = $stmt->fetch();

    $pdo->beginTransaction();
    try {
        if ($user) {
            $pdo->prepare(
                'UPDATE users SET google_id = COALESCE(google_id, ?),
                                  avatar_url = COALESCE(avatar_url, ?),
                                  display_name = COALESCE(NULLIF(display_name, ""), ?)
                 WHERE id = ?'
            )->execute([$sub, $avatar, $name ?: explode('@', $email)[0], $user['id']]);
            $id = $user['id'];
            if (!fetch_profile($pdo, $id)) {
                bootstrap_new_user($pdo, $id, $email, $name, $avatar);
            } else {
                require_once __DIR__ . '/lib/library.php';
                library_ensure_stats($pdo, $id);
            }
        } else {
            $id = uuid();
            $pdo->prepare(
                'INSERT INTO users (id, email, password_hash, google_id, avatar_url, display_name)
                 VALUES (?, ?, NULL, ?, ?, ?)'
            )->execute([$id, $email, $sub, $avatar, $name ?: explode('@', $email)[0]]);
            bootstrap_new_user($pdo, $id, $email, $name, $avatar);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_out(['error' => 'Errore login Google'], 500);
    }

    json_out(['token' => make_token($id, $email), 'user' => fetch_profile($pdo, $id)]);
}

if ($action === 'me') {
    $jwt = require_auth();
    $profile = fetch_profile($pdo, $jwt['sub']);
    if (!$profile) json_out(['error' => 'Utente non trovato'], 404);
    json_out($profile);
}

if ($action === 'profile') {
    $jwt  = require_auth();
    $body = body();
    $allowed = ['display_name', 'bio', 'avatar_url', 'handle'];
    $sets = [];
    $vals = [];

    foreach ($allowed as $k) {
        if (!array_key_exists($k, $body)) continue;
        if ($k === 'handle') {
            $handle = strtolower(trim((string) $body['handle']));
            if (!preg_match('/^[a-z0-9_]{3,24}$/', $handle)) {
                json_out(['error' => 'Handle non valido (3-24 caratteri, a-z 0-9 _)'], 400);
            }
            $dup = $pdo->prepare('SELECT 1 FROM profiles WHERE handle = ? AND id != ?');
            $dup->execute([$handle, $jwt['sub']]);
            if ($dup->fetch()) json_out(['error' => 'Handle già in uso'], 409);
        }
        $sets[] = "`$k` = ?";
        $vals[] = $body[$k];
    }

    if ($sets) {
        $vals[] = $jwt['sub'];
        $pdo->prepare('UPDATE profiles SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
        if (isset($body['display_name'])) {
            $pdo->prepare('UPDATE users SET display_name = ? WHERE id = ?')
                ->execute([$body['display_name'], $jwt['sub']]);
        }
    }
    json_out(fetch_profile($pdo, $jwt['sub']) ?? ['ok' => true]);
}

if ($action === 'forgot') {
    $email = strtolower(trim($body['email'] ?? ''));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_out(['error' => 'Email non valida'], 400);
    }

    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user) {
        $token = bin2hex(random_bytes(32));
        $pdo->prepare('DELETE FROM password_reset_tokens WHERE user_id = ?')->execute([$user['id']]);
        $pdo->prepare(
            'INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))'
        )->execute([$token, $user['id']]);

        $appUrl = rtrim((string) app_config('app_url'), '/');
        $link   = "$appUrl/reset-password?token=$token";
        send_mail(
            $email,
            'Reset password — Nerdubbio',
            "<p>Ciao!</p><p>Clicca per reimpostare la password:</p><p><a href=\"$link\">$link</a></p><p>Il link scade tra 1 ora.</p>"
        );
    }

    json_out(['ok' => true]);
}

if ($action === 'reset') {
    $token = trim($body['token'] ?? '');
    $pass  = $body['password'] ?? '';

    if (strlen($pass) < 6) json_out(['error' => 'Password troppo corta'], 400);
    if ($token === '') json_out(['error' => 'Token mancante'], 400);

    $stmt = $pdo->prepare(
        'SELECT user_id FROM password_reset_tokens WHERE token = ? AND expires_at > NOW() LIMIT 1'
    );
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if (!$row) json_out(['error' => 'Link non valido o scaduto'], 400);

    $hash = password_hash($pass, PASSWORD_BCRYPT);
    $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([$hash, $row['user_id']]);
    $pdo->prepare('DELETE FROM password_reset_tokens WHERE token = ?')->execute([$token]);

    $user = $pdo->prepare('SELECT email FROM users WHERE id = ?');
    $user->execute([$row['user_id']]);
    $email = (string) ($user->fetch()['email'] ?? '');

    json_out(['token' => make_token($row['user_id'], $email), 'user' => fetch_profile($pdo, $row['user_id'])]);
}

json_out(['error' => 'Azione non valida'], 400);
