<?php
require_once __DIR__ . '/_auth.php';
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    if (!isset($_SESSION['user_id']) || !in_array($_SESSION['rol'], ['superadmin', 'admin'])) {
        http_response_code(403);
        echo json_encode(["message" => "Acceso denegado."]);
        exit();
    }
}

$database = new Database();
$db = $database->getConnection();

$data = json_decode(file_get_contents("php://input"));

switch($method) {
    case 'GET':
        $query = "SELECT id, nombre, calle, numero, localidad, latitud, longitud, activa FROM unidades_atencion ORDER BY nombre ASC";
        $stmt = $db->prepare($query);
        $stmt->execute();
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        break;

    case 'POST':
        if(!empty($data->nombre)) {
            $calle = $data->calle ?? null;
            $numero = $data->numero ?? null;
            $localidad = $data->localidad ?? null;
            $latitud = !empty($data->latitud) ? floatval($data->latitud) : null;
            $longitud = !empty($data->longitud) ? floatval($data->longitud) : null;

            // Auto-geocodificación si no se enviaron coordenadas explícitas
            if (($latitud === null || $longitud === null) && (!empty($calle) || !empty($data->nombre))) {
                $queryGeo = trim(($calle ?? '') . ' ' . ($numero ?? '') . ' ' . ($localidad ?? 'San Carlos de Bariloche') . ' Argentina');
                if (!empty($queryGeo)) {
                    $ctx = stream_context_create(['http' => ['timeout' => 3, 'user_agent' => 'TurnosMedicosApp/1.0']]);
                    $geoJson = @file_get_contents('https://photon.komoot.io/api/?q=' . urlencode($queryGeo) . '&limit=1', false, $ctx);
                    if ($geoJson) {
                        $geoData = json_decode($geoJson, true);
                        if (!empty($geoData['features'][0]['geometry']['coordinates'])) {
                            $longitud = floatval($geoData['features'][0]['geometry']['coordinates'][0]);
                            $latitud = floatval($geoData['features'][0]['geometry']['coordinates'][1]);
                        }
                    }
                }
            }

            if(!empty($data->id)) {
                // UPDATE
                $query = "UPDATE unidades_atencion SET nombre=:nombre, calle=:calle, numero=:numero, localidad=:localidad, latitud=:latitud, longitud=:longitud WHERE id=:id";
                $stmt = $db->prepare($query);
                $stmt->bindParam(":id", $data->id);
            } else {
                // INSERT
                $query = "INSERT INTO unidades_atencion (nombre, calle, numero, localidad, latitud, longitud) VALUES (:nombre, :calle, :numero, :localidad, :latitud, :longitud)";
                $stmt = $db->prepare($query);
            }
            $stmt->bindParam(":nombre", $data->nombre);
            $stmt->bindParam(":calle", $calle);
            $stmt->bindParam(":numero", $numero);
            $stmt->bindParam(":localidad", $localidad);
            $stmt->bindParam(":latitud", $latitud);
            $stmt->bindParam(":longitud", $longitud);

            if($stmt->execute()) {
                $id = !empty($data->id) ? $data->id : $db->lastInsertId();
                http_response_code(!empty($data->id) ? 200 : 201);
                echo json_encode(["message" => "Sede guardada exitosamente.", "id" => $id, "latitud" => $latitud, "longitud" => $longitud]);
            } else {
                http_response_code(503);
                echo json_encode(["message" => "No se pudo guardar la sede."]);
            }
        } else {
            http_response_code(400);
            echo json_encode(["message" => "El nombre es obligatorio."]);
        }
        break;

    case 'DELETE':
        if(!empty($data->id)) {
            $query = "DELETE FROM unidades_atencion WHERE id = :id";
            $stmt = $db->prepare($query);
            $stmt->bindParam(":id", $data->id);
            if($stmt->execute()) {
                echo json_encode(["message" => "Sede eliminada."]);
            } else {
                http_response_code(503);
                echo json_encode(["message" => "No se pudo eliminar. Puede que esté en uso."]);
            }
        } else {
            http_response_code(400);
            echo json_encode(["message" => "ID requerido."]);
        }
        break;
}
?>
