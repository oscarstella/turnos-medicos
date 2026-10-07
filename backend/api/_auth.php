<?php
// Shared Firebase ID token and PHP session helpers.
// Never trust a UID, email, or role supplied by the browser without a verified token.
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_name('TURNOSSESSID_V2'); // Invalidate legacy sessions created by the previous unverified login flow.
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();
}

function firebase_project_id(): string { return 'turnos-medicos-db87c'; }

function firebase_b64url_decode(string $value) {
    $decoded = base64_decode(strtr($value, '-_', '+/') . str_repeat('=', (4 - strlen($value) % 4) % 4), true);
    return $decoded === false ? false : $decoded;
}

function firebase_certificates(): array {
    $cache = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'turnos-firebase-certs.json';
    if (is_file($cache) && filemtime($cache) > time() - 3600) {
        $cached = json_decode((string)file_get_contents($cache), true);
        if (is_array($cached)) return $cached;
    }
    $url = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_CONNECTTIMEOUT=>3, CURLOPT_TIMEOUT=>5]);
        $body = curl_exec($curl); curl_close($curl);
    } else {
        $context = stream_context_create(['http' => ['timeout' => 5, 'ignore_errors' => true]]);
        $body = @file_get_contents($url, false, $context);
    }
    $certs = $body ? json_decode($body, true) : null;
    if (!is_array($certs) || !$certs) {
        if (is_file($cache)) {
            $cached = json_decode((string)file_get_contents($cache), true);
            if (is_array($cached)) return $cached;
        }
        throw new RuntimeException('No se pudieron obtener los certificados de Firebase.');
    }
    @file_put_contents($cache, json_encode($certs), LOCK_EX);
    return $certs;
}

function verify_firebase_id_token(string $token): array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) throw new RuntimeException('Token de Firebase inválido.');
    $header = json_decode(firebase_b64url_decode($parts[0]), true);
    $claims = json_decode(firebase_b64url_decode($parts[1]), true);
    if (!is_array($header) || !is_array($claims) || ($header['alg'] ?? '') !== 'RS256' || empty($header['kid'])) {
        throw new RuntimeException('Token de Firebase inválido.');
    }
    $certs = firebase_certificates();
    if (!isset($certs[$header['kid']])) throw new RuntimeException('Certificado de Firebase inválido.');
    $signature = firebase_b64url_decode($parts[2]);
    $publicKey = openssl_pkey_get_public($certs[$header['kid']]);
    if (!$publicKey || $signature === false || openssl_verify($parts[0] . '.' . $parts[1], $signature, $publicKey, OPENSSL_ALGO_SHA256) !== 1) {
        throw new RuntimeException('Firma de Firebase inválida.');
    }
    $now = time();
    if (($claims['aud'] ?? '') !== firebase_project_id()
        || ($claims['iss'] ?? '') !== 'https://securetoken.google.com/' . firebase_project_id()
        || empty($claims['sub']) || strlen($claims['sub']) > 128
        || !isset($claims['exp'], $claims['iat']) || (int)$claims['exp'] <= $now
        || (int)$claims['iat'] > $now + 60) {
        throw new RuntimeException('Token de Firebase vencido o con destinatario incorrecto.');
    }
    $claims['email_verified'] = filter_var($claims['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);
    return $claims;
}

function firebase_token_from_request(): string {
    static $cachedToken = null;
    if ($cachedToken !== null) return $cachedToken;
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $authorization = $headers['Authorization'] ?? $headers['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/^Bearer\s+(.+)$/i', $authorization, $match)) return $cachedToken = trim($match[1]);
    $body = json_decode((string)file_get_contents('php://input'));
    return $cachedToken = is_object($body) && !empty($body->id_token) ? trim($body->id_token) : '';
}

function firebase_user_from_request(PDO $db, bool $requireVerifiedEmailForLink = true): array {
    $claims = verify_firebase_id_token(firebase_token_from_request());
    $uid = $claims['sub'];
    $email = strtolower(trim((string)($claims['email'] ?? '')));
    $stmt = $db->prepare('SELECT id, firebase_uid, email, nombre, apellido, rol, dni FROM usuarios WHERE firebase_uid = :uid LIMIT 1');
    $stmt->execute([':uid' => $uid]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user && $email !== '') {
        if ($requireVerifiedEmailForLink && empty($claims['email_verified'])) {
            throw new RuntimeException('Verificá tu correo electrónico antes de vincular la cuenta.');
        }
        $stmt = $db->prepare('SELECT id, firebase_uid, email, nombre, apellido, rol, dni FROM usuarios WHERE LOWER(email) = :email LIMIT 1');
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($user) {
            $update = $db->prepare('UPDATE usuarios SET firebase_uid = :uid WHERE id = :id');
            $update->execute([':uid' => $uid, ':id' => $user['id']]);
            $user['firebase_uid'] = $uid;
        }
    }
    if (!$user) throw new RuntimeException('No encontramos una cuenta asociada a esta identidad de Firebase.');
    if ($email !== '' && !empty($claims['email_verified']) && strcasecmp((string)$user['email'], $email) !== 0) {
        $update = $db->prepare('UPDATE usuarios SET email = :email WHERE id = :id');
        $update->execute([':email' => $email, ':id' => $user['id']]);
        $user['email'] = $email;
    }
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int)$user['id'];
    $_SESSION['rol'] = $user['rol'];
    $_SESSION['nombre'] = $user['nombre'];
    return $user;
}

function require_firebase_user(PDO $db): array {
    if (firebase_token_from_request() !== '') return firebase_user_from_request($db);
    if (isset($_SESSION['user_id'])) {
        $stmt = $db->prepare('SELECT id, firebase_uid, email, nombre, apellido, rol, dni FROM usuarios WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => (int)$_SESSION['user_id']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($user) {
            $_SESSION['rol'] = $user['rol']; // Refresh permissions after role changes.
            return $user;
        }
        session_destroy();
    }
    return firebase_user_from_request($db);
}

function normalize_dni($value): string {
    return preg_replace('/\D+/', '', (string)$value);
}

function valid_dni(string $dni): bool { return (bool)preg_match('/^\d{7,8}$/', $dni); }
?>
