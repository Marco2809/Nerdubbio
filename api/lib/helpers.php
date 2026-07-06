<?php

require_once __DIR__ . '/errors.php';

function cors(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function json_out(mixed $data, int $code = 200): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function body(): array {
    $raw = file_get_contents('php://input');
    return $raw ? (json_decode($raw, true) ?? []) : [];
}

function app_config(?string $key = null): mixed {
    static $cfg = null;
    if ($cfg === null) {
        $f = __DIR__ . '/../config.php';
        $cfg = file_exists($f) ? require $f : [];
    }
    if ($key === null) return $cfg;
    return $cfg[$key] ?? null;
}

function uuid(): string {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function normalize_locale(?string $lang): string {
    static $allowed = ['it', 'en', 'es', 'fr', 'de'];
    $lang = strtolower(trim((string) $lang));
    return in_array($lang, $allowed, true) ? $lang : 'it';
}

function parse_json(mixed $val, mixed $default = []): mixed {
    if ($val === null || $val === '') return $default;
    if (is_array($val)) return $val;
    $d = json_decode((string) $val, true);
    return json_last_error() === JSON_ERROR_NONE ? $d : $default;
}

function to_json(mixed $val): string {
    return json_encode($val, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function normalize_datetime(mixed $v): ?string {
    if ($v === null || $v === '') return null;
    if (!is_string($v)) return null;
    $ts = strtotime($v);
    if ($ts === false) return null;
    return date('Y-m-d H:i:s', $ts);
}

function send_mail(string $to, string $subject, string $html): bool {
    $host = (string) app_config('smtp_host');
    if ($host === '') return false;

    $from     = (string) app_config('smtp_from');
    $fromName = (string) app_config('smtp_from_name');
    $user     = (string) app_config('smtp_user');
    $pass     = (string) app_config('smtp_pass');
    $port     = (int) app_config('smtp_port');
    $secure   = (string) app_config('smtp_secure');

    $transport = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;
    $fp = @stream_socket_client($transport, $errno, $errstr, 10);
    if (!$fp) return false;

    $read = fn () => fgets($fp, 512);
    $cmd  = function (string $c) use ($fp, $read): bool {
        fwrite($fp, $c . "\r\n");
        $line = $read();
        return $line !== false && (int) $line[0] < 4;
    };

    $read();
    if (!$cmd('EHLO localhost')) { fclose($fp); return false; }
    while ($line = $read()) {
        if (isset($line[3]) && $line[3] === ' ') break;
    }
    if ($secure === 'tls') {
        if (!$cmd('STARTTLS')) { fclose($fp); return false; }
        stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
        if (!$cmd('EHLO localhost')) { fclose($fp); return false; }
        while ($line = $read()) {
            if (isset($line[3]) && $line[3] === ' ') break;
        }
    }
    if ($user !== '') {
        if (!$cmd('AUTH LOGIN')) { fclose($fp); return false; }
        if (!$cmd(base64_encode($user))) { fclose($fp); return false; }
        if (!$cmd(base64_encode($pass))) { fclose($fp); return false; }
    }
    if (!$cmd("MAIL FROM:<$from>")) { fclose($fp); return false; }
    if (!$cmd("RCPT TO:<$to>")) { fclose($fp); return false; }
    if (!$cmd('DATA')) { fclose($fp); return false; }

    $msg  = "From: $fromName <$from>\r\n";
    $msg .= "To: $to\r\n";
    $msg .= "Subject: $subject\r\n";
    $msg .= "MIME-Version: 1.0\r\n";
    $msg .= "Content-Type: text/html; charset=UTF-8\r\n\r\n";
    $msg .= $html . "\r\n.";
    fwrite($fp, $msg . "\r\n");
    $read();
    $cmd('QUIT');
    fclose($fp);
    return true;
}
