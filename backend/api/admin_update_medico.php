<?php
require_once __DIR__ . '/_auth.php';
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../config/database.php';

if (!isset($_SESSION['user_id']) || !in_array($_SESSION['rol'], ['superadmin', 'admin'])) {
    http_response_code(403);
    echo json_encode(array("message" => "Acceso denegado."));
    exit();
}

$database = new Database();
$db = $database->getConnection();

// Asegurar existencia de columna dia_apertura_agenda en usuarios
try {
    $colApertura = $db->query("SHOW COLUMNS FROM usuarios LIKE 'dia_apertura_agenda'")->fetchAll();
    if (empty($colApertura)) {
        $db->exec("ALTER TABLE usuarios ADD COLUMN dia_apertura_agenda INT NULL DEFAULT NULL");
    }
} catch (Exception $e) {}

$data = json_decode(file_get_contents("php://input"));

if(!empty($data->id)) {
    $query = "UPDATE usuarios SET ";
    $params = [];
    $updates = [];
    
    if(isset($data->nombre) && trim($data->nombre) !== '') {
        $updates[] = "nombre = :nombre";
        $params[':nombre'] = trim($data->nombre);
    }
    if(isset($data->apellido) && trim($data->apellido) !== '') {
        $updates[] = "apellido = :apellido";
        $params[':apellido'] = trim($data->apellido);
    }
    if(isset($data->biografia)) {
        $updates[] = "biografia = :biografia";
        $params[':biografia'] = $data->biografia;
    }
    if(isset($data->direccion)) {
        $updates[] = "direccion = :direccion";
        $params[':direccion'] = $data->direccion;
    }
    if(isset($data->matricula)) {
        $updates[] = "matricula = :matricula";
        $params[':matricula'] = $data->matricula;
    }
    if(isset($data->foto_perfil)) {
        $updates[] = "foto_perfil = :foto_perfil";
        $params[':foto_perfil'] = $data->foto_perfil;
    }
    if(property_exists($data, 'dias_antelacion_agenda')) {
        $diasVal = ($data->dias_antelacion_agenda !== null && $data->dias_antelacion_agenda !== '') 
            ? max(1, min(730, intval($data->dias_antelacion_agenda))) 
            : null;
        $updates[] = "dias_antelacion_agenda = :dias_antelacion_agenda";
        $params[':dias_antelacion_agenda'] = $diasVal;
    }
    if(property_exists($data, 'dia_apertura_agenda')) {
        $diaAperturaVal = ($data->dia_apertura_agenda !== null && $data->dia_apertura_agenda !== '') 
            ? max(1, min(31, intval($data->dia_apertura_agenda))) 
            : null;
        $updates[] = "dia_apertura_agenda = :dia_apertura_agenda";
        $params[':dia_apertura_agenda'] = $diaAperturaVal;
    }
    
    if(count($updates) > 0) {
        $query .= implode(", ", $updates) . " WHERE id = :id AND rol = 'medico'";
        $params[':id'] = $data->id;
        
        $stmt = $db->prepare($query);
        foreach($params as $key => &$val) {
            $stmt->bindParam($key, $val);
        }
        $stmt->execute();
    }

    // Actualizar especialidades si se enviaron
    if(isset($data->especialidades) && is_array($data->especialidades)) {
        $del = $db->prepare("DELETE FROM medicos_especialidades WHERE usuario_id = :uid");
        $del->execute([':uid' => $data->id]);
        
        $ins = $db->prepare("INSERT INTO medicos_especialidades (usuario_id, especialidad_id) VALUES (:uid, :eid)");
        foreach($data->especialidades as $eid) {
            $eidInt = intval($eid);
            if($eidInt > 0) {
                $ins->execute([':uid' => $data->id, ':eid' => $eidInt]);
            }
        }
    }

    echo json_encode(array("message" => "Médico actualizado exitosamente."));
} else {
    http_response_code(400);
    echo json_encode(array("message" => "ID de médico requerido."));
}
?>
