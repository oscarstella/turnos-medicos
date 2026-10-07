<?php
require_once __DIR__ . '/_auth.php';
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

// Verificar permisos (solo superadmin o admin) para operaciones destructivas
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
        // Leer Planes por Obra Social
        $obra_social_id = isset($_GET['obra_social_id']) ? $_GET['obra_social_id'] : null;
        if(!$obra_social_id) {
            http_response_code(400);
            echo json_encode(array("message" => "ID de obra social requerido."));
            exit();
        }
        $query = "SELECT id, obra_social_id, nombre FROM planes_obras_sociales WHERE obra_social_id = :os_id ORDER BY nombre ASC";
        $stmt = $db->prepare($query);
        $stmt->bindParam(":os_id", $obra_social_id);
        $stmt->execute();
        $planes = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($planes);
        break;

    case 'POST':
        // Crear Plan
        if(!empty($data->nombre) && !empty($data->obra_social_id)) {
            $query = "INSERT INTO planes_obras_sociales (obra_social_id, nombre) VALUES (:obra_social_id, :nombre)";
            $stmt = $db->prepare($query);
            $stmt->bindParam(":obra_social_id", $data->obra_social_id);
            $stmt->bindParam(":nombre", $data->nombre);
            if($stmt->execute()) {
                http_response_code(201);
                echo json_encode(array("message" => "Plan creado exitosamente.", "id" => $db->lastInsertId()));
            } else {
                http_response_code(503);
                echo json_encode(array("message" => "No se pudo crear el plan."));
            }
        } else {
            http_response_code(400);
            echo json_encode(array("message" => "Datos incompletos."));
        }
        break;

    case 'PUT':
        // Editar Plan
        if(!empty($data->id) && !empty($data->nombre)) {
            $query = "UPDATE planes_obras_sociales SET nombre = :nombre WHERE id = :id";
            $stmt = $db->prepare($query);
            $stmt->bindParam(":nombre", $data->nombre);
            $stmt->bindParam(":id", $data->id);
            if($stmt->execute()) {
                echo json_encode(array("message" => "Plan actualizado."));
            } else {
                http_response_code(503);
                echo json_encode(array("message" => "No se pudo actualizar el plan."));
            }
        }
        break;

    case 'DELETE':
        // Borrar Plan
        if(!empty($data->id)) {
            $query = "DELETE FROM planes_obras_sociales WHERE id = :id";
            $stmt = $db->prepare($query);
            $stmt->bindParam(":id", $data->id);
            if($stmt->execute()) {
                echo json_encode(array("message" => "Plan eliminado."));
            } else {
                http_response_code(503);
                echo json_encode(array("message" => "No se pudo eliminar el plan. Puede que esté en uso en algún turno."));
            }
        }
        break;
}
?>
