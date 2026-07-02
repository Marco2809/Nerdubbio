<?php

function jwt_secret(): string {
    return (string) app_config('jwt_secret');
}

function base64url(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function jwt_create(array $payload): string {
    $header = base64url(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
    $body   = base64url(json_encode($payload));
    $sig    = base64url(hash_hmac('sha256', "$header.$body", jwt_secret(), true));
    return "$header.$body.$sig";
}

function jwt_verify(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$h, $b, $sig] = $parts;
    $expected = base64url(hash_hmac('sha256', "$h.$b", jwt_secret(), true));
    if (!hash_equals($expected, $sig)) return null;
    $payload = json_decode(base64_decode(strtr($b, '-_', '+/')), true);
    if (!$payload || (isset($payload['exp']) && $payload['exp'] < time())) return null;
    return $payload;
}

function require_auth(): array {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    $token = str_starts_with($h, 'Bearer ') ? substr($h, 7) : '';
    $payload = $token ? jwt_verify($token) : null;
    if (!$payload) {
        http_response_code(401);
        die(json_encode(['error' => 'Non autenticato']));
    }
    return $payload;
}

function make_token(string $userId, string $email): string {
    return jwt_create([
        'sub'   => $userId,
        'email' => $email,
        'iat'   => time(),
        'exp'   => time() + 86400 * 30,
    ]);
}
