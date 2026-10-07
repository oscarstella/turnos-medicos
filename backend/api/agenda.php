<?php
require_once __DIR__ . '/_auth.php';
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();
$method = $_SERVER['REQUEST_METHOD'];
$data = json_decode(file_get_contents("php://input"));

// Acción solicitada por POST o GET action
$action = isset($_GET['action']) ? $_GET['action'] : (isset($data->action) ? $data->action : '');

switch($action) {
    case 'get_config':
        // Obtener configuración de horario de un médico
        $medico_id = isset($_GET['medico_id']) ? $_GET['medico_id'] : null;
        if($medico_id) {
            $query = "SELECT * FROM horarios_medicos WHERE medico_id = :id";
            $stmt = $db->prepare($query);
            $stmt->bindParam(":id", $medico_id);
            $stmt->execute();
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        }
        break;

    case 'save_config':
        http_response_code(410);
        echo json_encode(['message'=>'Este endpoint fue reemplazado por crud_horarios_medico.php, que valida horarios y sedes.']);
        break;

    case 'generar_slots':
        http_response_code(410);
        echo json_encode(['message'=>'Ya no se generan slots almacenados. Consultá get_disponibilidad.php para obtener disponibilidad actual.']);
        break;

    case 'get_turnos_libres':
        http_response_code(410);
        echo json_encode(['message'=>'Consultá get_disponibilidad.php para ver turnos libres en tiempo real.']);
        break;

    default:
        http_response_code(400);
        echo json_encode(array("message" => "Acción inválida."));
}
?>
