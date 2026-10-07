<?php
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
require_once '_auth.php';
require_once '../config/database.php';
$db = (new Database())->getConnection();

try {
    $claims = verify_firebase_id_token(firebase_token_from_request());
    $uid = $claims['sub'];
    $email = strtolower(trim((string)($claims['email'] ?? '')));
    if ($email === '') throw new RuntimeException('La cuenta de Firebase debe tener un correo electrónico.');
    $body = json_decode((string)file_get_contents('php://input'));
    $dni = normalize_dni($body->dni ?? '');

    $find = $db->prepare('SELECT id, firebase_uid, email, nombre, apellido, rol, dni FROM usuarios WHERE firebase_uid = :uid LIMIT 1');
    $find->execute([':uid' => $uid]);
    $user = $find->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        $find = $db->prepare('SELECT id, firebase_uid, email, nombre, apellido, rol, dni FROM usuarios WHERE LOWER(email) = :email LIMIT 1');
        $find->execute([':email' => $email]);
        $user = $find->fetch(PDO::FETCH_ASSOC);
        if ($user && empty($claims['email_verified'])) throw new RuntimeException('Verificá tu correo electrónico antes de vincular esta cuenta.');
    }

    if ($user) {
        $verifiedEmail = !empty($claims['email_verified']) ? $email : (string)$user['email'];
        if (($user['rol'] ?? '') === 'paciente') {
            if (empty($user['dni']) && !valid_dni($dni)) throw new RuntimeException('Ingresá un DNI válido de 7 u 8 números para completar tu perfil.');
            if ($dni !== '' && !valid_dni($dni)) throw new RuntimeException('Ingresá un DNI válido de 7 u 8 números.');
            if (!empty($user['dni']) && $dni !== '' && normalize_dni($user['dni']) !== $dni) {
                http_response_code(409);
                throw new RuntimeException('El DNI no coincide con el registrado. Contactá a recepción para actualizar tus datos.');
            }
            $dupe = $db->prepare("SELECT id FROM usuarios WHERE REGEXP_REPLACE(dni, '[^0-9]', '') = :dni AND id <> :id LIMIT 1");
            if ($dni !== '') $dupe->execute([':dni' => $dni, ':id' => $user['id']]);
            if ($dni !== '' && $dupe->fetchColumn()) {
                http_response_code(409);
                throw new RuntimeException('Ese DNI ya está asociado a otra cuenta. Contactá a recepción.');
            }
            // The DNI identifies the patient record; it is never accepted as proof of identity.
            $upd = $db->prepare('UPDATE usuarios SET 
                firebase_uid = :uid, 
                email = :email, 
                dni = COALESCE(NULLIF(dni, ""), :dni), 
                nombre = COALESCE(NULLIF(:nombre, ""), nombre), 
                apellido = COALESCE(NULLIF(:apellido, ""), apellido), 
                telefono = COALESCE(NULLIF(:telefono, ""), telefono),
                fecha_nacimiento = COALESCE(NULLIF(:fnac, ""), fecha_nacimiento),
                obra_social_id = COALESCE(:os_id, obra_social_id),
                plan_id = COALESCE(:plan_id, plan_id)
                WHERE id = :id');
            $upd->execute([
                ':uid' => $uid, ':email' => $verifiedEmail, ':dni' => $dni !== '' ? $dni : null,
                ':nombre' => trim((string)($body->nombre ?? '')),
                ':apellido' => trim((string)($body->apellido ?? '')),
                ':telefono' => trim((string)($body->telefono ?? '')),
                ':fnac' => !empty($body->fecha_nacimiento) ? $body->fecha_nacimiento : null,
                ':os_id' => !empty($body->obra_social_id) ? intval($body->obra_social_id) : null,
                ':plan_id' => !empty($body->plan_id) ? intval($body->plan_id) : null,
                ':id' => $user['id']
            ]);
        } else {
            $upd = $db->prepare('UPDATE usuarios SET firebase_uid = :uid, email = :email WHERE id = :id');
            $upd->execute([':uid' => $uid, ':email' => $verifiedEmail, ':id' => $user['id']]);
        }
        $userId = (int)$user['id'];
    } else {
        if (empty($claims['email_verified'])) throw new RuntimeException('Verificá tu correo electrónico antes de crear la cuenta.');
        if (!valid_dni($dni)) throw new RuntimeException('Ingresá un DNI válido de 7 u 8 números.');
        $dupe = $db->prepare("SELECT id FROM usuarios WHERE REGEXP_REPLACE(dni, '[^0-9]', '') = :dni LIMIT 1");
        $dupe->execute([':dni' => $dni]);
        if ($dupe->fetchColumn()) {
            http_response_code(409);
            throw new RuntimeException('Ese DNI ya tiene una ficha. Iniciá sesión con el correo registrado o contactá a recepción para vincularla.');
        }
        $name = trim((string)($body->nombre ?? $claims['name'] ?? explode('@', $email)[0]));
        $insert = $db->prepare("INSERT INTO usuarios (firebase_uid, email, nombre, apellido, dni, fecha_nacimiento, telefono, obra_social_id, plan_id, rol) VALUES (:uid, :email, :nombre, :apellido, :dni, :fnac, :tel, :os_id, :plan_id, 'paciente')");
        $insert->execute([
            ':uid' => $uid, ':email' => $email, ':nombre' => $name,
            ':apellido' => trim((string)($body->apellido ?? '')), ':dni' => $dni,
            ':fnac' => !empty($body->fecha_nacimiento) ? $body->fecha_nacimiento : null,
            ':tel' => !empty($body->telefono) ? $body->telefono : null,
            ':os_id' => !empty($body->obra_social_id) ? intval($body->obra_social_id) : null,
            ':plan_id' => !empty($body->plan_id) ? intval($body->plan_id) : null
        ]);
        $userId = (int)$db->lastInsertId();
    }

    $stmt = $db->prepare('SELECT id, nombre, apellido, email, dni, rol FROM usuarios WHERE id = :id');
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
    $_SESSION['rol'] = $user['rol'];
    $_SESSION['nombre'] = $user['nombre'];
    $count = $db->prepare("SELECT COUNT(*) FROM turnos WHERE paciente_id = :id AND estado IN ('asignado','pendiente','confirmado') AND fecha >= CURDATE()");
    $count->execute([':id' => $userId]);
    $user['turnos_pendientes'] = (int)$count->fetchColumn();
    http_response_code(200);
    echo json_encode(['message' => 'Autenticación correcta.', 'user' => $user]);
} catch (Throwable $e) {
    if ($e instanceof PDOException) { http_response_code(500); $message = 'No se pudo completar el acceso. Intentá nuevamente.'; }
    else { if (http_response_code() < 400) http_response_code(401); $message = $e->getMessage(); }
    echo json_encode(['message' => $message]);
}
?>
