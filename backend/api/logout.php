<?php
require_once __DIR__ . '/_auth.php';
$_SESSION = array();
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}
session_destroy();
header("Content-Type: application/json; charset=UTF-8");
echo json_encode(["status" => "success", "message" => "Sesión cerrada correctamente."]);
