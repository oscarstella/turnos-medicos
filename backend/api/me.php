<?php
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__ . '/_auth.php';
require_once '../config/database.php';
$db=(new Database())->getConnection();
try {
    $user=require_firebase_user($db);
    echo json_encode(['user'=>['id'=>(int)$user['id'],'nombre'=>$user['nombre'],'apellido'=>$user['apellido'],'email'=>$user['email'],'dni'=>$user['dni'],'rol'=>$user['rol'],'firebase_uid'=>$user['firebase_uid']]]);
} catch(Throwable $e) {
    http_response_code(401); echo json_encode(['message'=>'No autenticado.']);
}
?>
