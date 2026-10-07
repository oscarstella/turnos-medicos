<?php
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
$body = json_decode((string)file_get_contents('php://input'));
$dni = preg_replace('/\D+/', '', (string)($body->dni ?? ''));
$password = (string)($body->password ?? '');
if (!preg_match('/^\d{7,8}$/', $dni) || $password === '') {
    http_response_code(400); echo json_encode(['message'=>'Ingresá un DNI válido y tu contraseña.']); exit;
}
require_once '../config/database.php';
$db = (new Database())->getConnection();
try {
    $lookup = $db->prepare("SELECT email FROM usuarios WHERE REGEXP_REPLACE(dni, '[^0-9]', '') = :dni AND rol = 'paciente' LIMIT 1");
    $lookup->execute([':dni'=>$dni]);
    $email = $lookup->fetchColumn();
    if (!$email) { http_response_code(401); echo json_encode(['message'=>'DNI o contraseña incorrectos.']); exit; }
    $apiKey = 'AIzaSyAP4m4iUJHu2UohFNVmpvXXy4Jzl4Lty_M';
    $url = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' . $apiKey;
    $payload = json_encode(['email'=>$email,'password'=>$password,'returnSecureToken'=>true]);
    $context = stream_context_create(['http'=>['method'=>'POST','header'=>"Content-Type: application/json\r\n",'content'=>$payload,'timeout'=>8,'ignore_errors'=>true]]);
    $response = @file_get_contents($url, false, $context);
    $result = $response ? json_decode($response,true) : null;
    if (empty($result['idToken'])) { http_response_code(401); echo json_encode(['message'=>'DNI o contraseña incorrectos.']); exit; }
    echo json_encode(['id_token'=>$result['idToken']]);
} catch (Throwable $e) {
    http_response_code(500); echo json_encode(['message'=>'No se pudo iniciar sesión en este momento.']);
}
?>
