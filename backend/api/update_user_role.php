<?php
require_once __DIR__ . '/_auth.php';
header("Content-Type: application/json; charset=UTF-8");

include_once '../config/database.php';

// Validar que sea superadmin
if (!isset($_SESSION['user_id']) || $_SESSION['rol'] !== 'superadmin') {
    http_response_code(403);
    echo json_encode(["message" => "Acceso denegado. Solo el Superadministrador puede cambiar roles."]);
    exit();
}

$data = json_decode(file_get_contents("php://input"));

if(!empty($data->usuario_id) && !empty($data->nuevo_rol)) {
    $database = new Database();
    $db = $database->getConnection();
    
    // Evitar que el superadmin se cambie el rol a sí mismo por error
    if ($data->usuario_id == $_SESSION['user_id']) {
         http_response_code(400);
         echo json_encode(["message" => "No puedes cambiar tu propio rol de Superadministrador."]);
         exit();
    }

    try {
        $query = "UPDATE usuarios SET rol = :rol WHERE id = :id";
        $stmt = $db->prepare($query);
        
        $stmt->bindParam(":rol", $data->nuevo_rol);
        $stmt->bindParam(":id", $data->usuario_id);
        
        if($stmt->execute()) {
            echo json_encode(["message" => "Rol actualizado exitosamente."]);
        } else {
            http_response_code(503);
            echo json_encode(["message" => "No se pudo actualizar el rol."]);
        }
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Error de base de datos."]);
    }
} else {
    http_response_code(400);
    echo json_encode(["message" => "Datos incompletos."]);
}
?>
