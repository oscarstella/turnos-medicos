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
        // Leer Obras Sociales con conteo de planes
        $query = "SELECT o.id, o.nombre, COUNT(p.id) as total_planes 
                  FROM obras_sociales o 
                  LEFT JOIN planes_obras_sociales p ON o.id = p.obra_social_id 
                  GROUP BY o.id, o.nombre 
                  ORDER BY o.nombre ASC";
        $stmt = $db->prepare($query);
        $stmt->execute();
        $obras = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($obras);
        break;

    case 'POST':
        // Crear Obra Social
        if(!empty($data->nombre)) {
            $nombre = trim($data->nombre);

            // Verificar si ya existe
            $check = $db->prepare("SELECT id FROM obras_sociales WHERE LOWER(TRIM(nombre)) = LOWER(:nombre)");
            $check->bindParam(":nombre", $nombre);
            $check->execute();
            if ($check->rowCount() > 0) {
                http_response_code(400);
                echo json_encode(array("message" => "Ya existe una obra social con ese nombre."));
                break;
            }

            $query = "INSERT INTO obras_sociales (nombre) VALUES (:nombre)";
            $stmt = $db->prepare($query);
            $stmt->bindParam(":nombre", $nombre);

            if($stmt->execute()) {
                $obra_social_id = $db->lastInsertId();
                $planes_creados = 0;

                // Si se especificaron múltiples planes
                if (!empty($data->planes) && is_array($data->planes)) {
                    $stmt_plan = $db->prepare("INSERT INTO planes_obras_sociales (obra_social_id, nombre) VALUES (:os_id, :nombre)");
                    foreach($data->planes as $plan_nombre) {
                        $p_nom = trim($plan_nombre);
                        if (!empty($p_nom)) {
                            $stmt_plan->bindParam(":os_id", $obra_social_id);
                            $stmt_plan->bindParam(":nombre", $p_nom);
                            $stmt_plan->execute();
                            $planes_creados++;
                        }
                    }
                } 
                // O si se especificó Plan Único
                else if (isset($data->tipo_plan) && $data->tipo_plan === 'unico') {
                    $plan_nombre = !empty($data->plan_unico_nombre) ? trim($data->plan_unico_nombre) : 'Plan Único';
                    $stmt_plan = $db->prepare("INSERT INTO planes_obras_sociales (obra_social_id, nombre) VALUES (:os_id, :nombre)");
                    $stmt_plan->bindParam(":os_id", $obra_social_id);
                    $stmt_plan->bindParam(":nombre", $plan_nombre);
                    $stmt_plan->execute();
                    $planes_creados++;
                }

                http_response_code(201);
                echo json_encode(array(
                    "message" => "Obra Social creada exitosamente.",
                    "id" => $obra_social_id,
                    "planes_creados" => $planes_creados
                ));
            } else {
                http_response_code(503);
                echo json_encode(array("message" => "No se pudo crear la obra social."));
            }
        } else {
            http_response_code(400);
            echo json_encode(array("message" => "El nombre de la obra social es obligatorio."));
        }
        break;

    case 'PUT':
        // Editar Obra Social
        if(!empty($data->id) && !empty($data->nombre)) {
            $query = "UPDATE obras_sociales SET nombre = :nombre WHERE id = :id";
            $stmt = $db->prepare($query);
            $stmt->bindParam(":nombre", $data->nombre);
            $stmt->bindParam(":id", $data->id);
            if($stmt->execute()) {
                echo json_encode(array("message" => "Obra Social actualizada."));
            } else {
                http_response_code(503);
                echo json_encode(array("message" => "No se pudo actualizar."));
            }
        }
        break;

    case 'DELETE':
        // Borrar Obra Social
        if(!empty($data->id)) {
            $query = "DELETE FROM obras_sociales WHERE id = :id";
            $stmt = $db->prepare($query);
            $stmt->bindParam(":id", $data->id);
            if($stmt->execute()) {
                echo json_encode(array("message" => "Obra Social eliminada."));
            } else {
                http_response_code(503);
                echo json_encode(array("message" => "No se pudo eliminar. Puede que esté en uso."));
            }
        }
        break;
}
?>
