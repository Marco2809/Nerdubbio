<?php

// Web Push senza dipendenze: VAPID (RFC 8292, JWT ES256) + cifratura payload
// aes128gcm (RFC 8291) con openssl. Le chiavi VAPID vengono generate una sola
// volta e salvate in push_vapid.

const WEBPUSH_SUBJECT = 'mailto:marco.salmi89@gmail.com';

function wp_b64url_encode(string $bin): string {
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}

function wp_b64url_decode(string $s): string {
    $pad = strlen($s) % 4;
    if ($pad) $s .= str_repeat('=', 4 - $pad);
    return base64_decode(strtr($s, '-_', '+/')) ?: '';
}

/** Estrae il punto pubblico EC non compresso (65 byte) da una chiave openssl. */
function wp_ec_public_point($key): string {
    $det = openssl_pkey_get_details($key);
    $x = str_pad($det['ec']['x'], 32, "\0", STR_PAD_LEFT);
    $y = str_pad($det['ec']['y'], 32, "\0", STR_PAD_LEFT);
    return "\x04" . $x . $y;
}

/** Chiave pubblica PEM a partire dal punto raw (65 byte) — per l'ECDH. */
function wp_point_to_pem(string $point): string {
    // SubjectPublicKeyInfo per prime256v1 + BIT STRING del punto.
    $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $point;
    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
}

/** Coppia VAPID dal DB, creata al primo uso. Ritorna [publicKeyB64url, privatePem]. */
function wp_vapid_keys(PDO $pdo): array {
    $row = $pdo->query('SELECT public_key, private_key_pem FROM push_vapid WHERE id = 1')->fetch();
    if ($row) return [$row['public_key'], $row['private_key_pem']];

    $key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    if (!$key) api_err('push_keygen_failed', 500);
    openssl_pkey_export($key, $pem);
    $public = wp_b64url_encode(wp_ec_public_point($key));

    $pdo->prepare('INSERT IGNORE INTO push_vapid (id, public_key, private_key_pem) VALUES (1, ?, ?)')
        ->execute([$public, $pem]);
    // In caso di corsa vince il primo INSERT: rileggi.
    $row = $pdo->query('SELECT public_key, private_key_pem FROM push_vapid WHERE id = 1')->fetch();
    return [$row['public_key'], $row['private_key_pem']];
}

/** Firma DER ECDSA -> raw r||s (64 byte) come richiesto da JWS. */
function wp_der_to_raw(string $der): string {
    $pos = 4; // SEQ(1+1) + INT header(1+1)
    $lenR = ord($der[3]);
    $r = substr($der, $pos, $lenR);
    $pos += $lenR + 2;
    $lenS = ord($der[$pos - 1]);
    $s = substr($der, $pos, $lenS);
    $r = str_pad(ltrim($r, "\0"), 32, "\0", STR_PAD_LEFT);
    $s = str_pad(ltrim($s, "\0"), 32, "\0", STR_PAD_LEFT);
    return $r . $s;
}

function wp_vapid_jwt(string $audience, string $privatePem): string {
    $header = wp_b64url_encode(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $claims = wp_b64url_encode(json_encode([
        'aud' => $audience,
        'exp' => time() + 12 * 3600,
        'sub' => WEBPUSH_SUBJECT,
    ]));
    $input = $header . '.' . $claims;
    openssl_sign($input, $sigDer, $privatePem, OPENSSL_ALGO_SHA256);
    return $input . '.' . wp_b64url_encode(wp_der_to_raw($sigDer));
}

/** Cifra il payload per la subscription secondo RFC 8291 (aes128gcm). */
function wp_encrypt(string $plaintext, string $p256dhB64, string $authB64): ?array {
    $uaPublic = wp_b64url_decode($p256dhB64);
    $authSecret = wp_b64url_decode($authB64);
    if (strlen($uaPublic) !== 65 || strlen($authSecret) !== 16) return null;

    $asKey = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    if (!$asKey) return null;
    $asPublic = wp_ec_public_point($asKey);

    $peer = openssl_pkey_get_public(wp_point_to_pem($uaPublic));
    if (!$peer) return null;
    $ecdh = openssl_pkey_derive($peer, $asKey, 32);
    if ($ecdh === false) return null;

    $prk  = hash_hkdf('sha256', $ecdh, 32, "WebPush: info\0" . $uaPublic . $asPublic, $authSecret);
    $salt = random_bytes(16);
    $cek   = hash_hkdf('sha256', $prk, 16, "Content-Encoding: aes128gcm\0", $salt);
    $nonce = hash_hkdf('sha256', $prk, 12, "Content-Encoding: nonce\0", $salt);

    $padded = $plaintext . "\x02"; // delimitatore ultimo record
    $tag = '';
    $cipher = openssl_encrypt($padded, 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
    if ($cipher === false) return null;

    // Header aes128gcm: salt(16) | record size(4) | idlen(1) | keyid(as_public)
    $body = $salt . pack('N', 4096) . chr(65) . $asPublic . $cipher . $tag;
    return ['body' => $body];
}

/**
 * Invia una notifica alla subscription. Ritorna lo status HTTP (0 = errore rete).
 * 404/410 = subscription morta: il chiamante deve cancellarla.
 */
function wp_send(PDO $pdo, array $sub, array $payload): int {
    [$vapidPublic, $vapidPem] = wp_vapid_keys($pdo);

    $enc = wp_encrypt(to_json($payload), $sub['p256dh'], $sub['auth']);
    if ($enc === null) return 410;

    $parts = parse_url($sub['endpoint']);
    if (empty($parts['scheme']) || empty($parts['host'])) return 0;
    $audience = $parts['scheme'] . '://' . $parts['host'];
    $jwt = wp_vapid_jwt($audience, $vapidPem);

    $ch = curl_init($sub['endpoint']);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $enc['body'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => [
            'TTL: 86400',
            'Urgency: normal',
            'Content-Type: application/octet-stream',
            'Content-Encoding: aes128gcm',
            'Content-Length: ' . strlen($enc['body']),
            'Authorization: vapid t=' . $jwt . ', k=' . $vapidPublic,
        ],
    ]);
    curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code;
}

/** Invia a tutte le subscription dell'utente, ripulendo quelle morte. */
function wp_send_to_user(PDO $pdo, string $userId, array $payload): int {
    $stmt = $pdo->prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?');
    $stmt->execute([$userId]);
    $ok = 0;
    foreach ($stmt->fetchAll() as $sub) {
        $code = wp_send($pdo, $sub, $payload);
        if ($code === 404 || $code === 410) {
            $pdo->prepare('DELETE FROM push_subscriptions WHERE id = ?')->execute([$sub['id']]);
        } elseif ($code >= 200 && $code < 300) {
            $ok++;
        }
    }
    return $ok;
}
