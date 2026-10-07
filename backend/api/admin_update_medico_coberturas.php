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
$data = json_decode(file_get_contents("php://input"));

if(!empty($data->usuario_id)) {
    $db->beginTransaction();
    
    try {
        // 1. Eliminar coberturas anteriores (planes)
        $q_del = "DELETE FROM medicos_planes WHERE usuario_id = :id";
        $stmt_del = $db->prepare($q_del);
        $stmt_del->bindParam(":id", $data->usuario_id);
        $stmt_del->execute();
        
        // 2. Eliminar obras sociales anteriores
        $q_del_os = "DELETE FROM medicos_obras_sociales WHERE usuario_id = :id";
        $stmt_del_os = $db->prepare($q_del_os);
        $stmt_del_os->bindParam(":id", $data->usuario_id);
        $stmt_del_os->execute();
        
        $obras_sociales_map = [];

        // Obras sociales directas
        if (!empty($data->obras_sociales) && is_array($data->obras_sociales)) {
            foreach($data->obras_sociales as $osid) {
                $osidInt = intval($osid);
                if ($osidInt > 0) {
                    $obras_sociales_map[$osidInt] = true;
                }
            }
        }

        // Planes y sus obras sociales
        if (!empty($data->planes) && is_array($data->planes)) {
            $q_ins = "INSERT INTO medicos_planes (usuario_id, plan_id) VALUES (:uid, :pid)";
            $stmt_ins = $db->prepare($q_ins);
            
            $q_os = "SELECT obra_social_id FROM planes_obras_sociales WHERE id = :pid";
            $stmt_os = $db->prepare($q_os);

            foreach($data->planes as $pid) {
                $pidInt = intval($pid);
                if ($pidInt > 0) {
                    $stmt_ins->execute([':uid' => $data->usuario_id, ':pid' => $pidInt]);
                    
                    $stmt_os->execute([':pid' => $pidInt]);
                    $os_id = $stmt_os->fetchColumn();
                    if ($os_id) {
                        $obras_sociales_map[intval($os_id)] = true;
                    }
                }
            }
        }

        // Insertar en medicos_obras_sociales
        if (count($obras_sociales_map) > 0) {
            $q_ins_os = "INSERT IGNORE INTO medicos_obras_sociales (usuario_id, obra_social_id) VALUES (:uid, :os_id)";
            $stmt_ins_os = $db->prepare($q_ins_os);
            foreach(array_keys($obras_sociales_map) as $osid) {
                $stmt_ins_os->execute([':uid' => $data->usuario_id, ':os_id' => $osid]);
            }
        }
        
        $db->commit();
        echo json_encode(array("message" => "Coberturas actualizadas correctamente."));
    } catch(Exception $e) {
        $db->rollBack();
        http_response_code(503);
        echo json_encode(array("message" => "No se pudieron actualizar las coberturas."));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Datos incompletos."));
}
?>
