<?php
require_once __DIR__ . '/_auth.php';
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

// Verificar permisos (solo superadmin o admin)
if ($method !== 'GET') {
    if (!isset($_SESSION['user_id']) || !in_array($_SESSION['rol'], ['superadmin', 'admin'])) {
        http_response_code(403);
        echo json_encode(array("message" => "Acceso denegado."));
        exit();
    }
}

$database = new Database();
$db = $database->getConnection();
$data = json_decode(file_get_contents("php://input"));

switch($method) {
    case 'GET':
        $query = "SELECT id, nombre FROM especialidades ORDER BY nombre ASC";
        $stmt = $db->prepare($query);
        $stmt->execute();
        $obras = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($obras);
        break;

    case 'POST':
        if(!empty($data->nombre)) {
            $query = "INSERT INTO especialidades (nombre) VALUES (:nombre)";
            $stmt = $db->prepare($query);
            $stmt->bindParam(":nombre", $data->nombre);
            if($stmt->execute()) {
                http_response_code(201);
                echo json_encode(array("message" => "Categoría creada.", "id" => $db->lastInsertId()));
            } else {
                http_response_code(503);
                echo json_encode(array("message" => "No se pudo crear. ¿Ya existe?"));
            }
        }
        break;

    case 'DELETE':
        if(!empty($data->id)) {
            $query = "DELETE FROM especialidades WHERE id = :id";
            $stmt = $db->prepare($query);
            $stmt->bindParam(":id", $data->id);
            if($stmt->execute()) {
                echo json_encode(array("message" => "Categoría eliminada."));
            } else {
                http_response_code(503);
                echo json_encode(array("message" => "No se pudo eliminar. Puede que esté en uso por algún médico."));
            }
        }
        break;
}
?>
