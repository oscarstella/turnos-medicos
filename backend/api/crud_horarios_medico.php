<?php
require_once __DIR__ . '/_auth.php';
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../config/database.php';

if (!isset($_SESSION['user_id']) || !in_array($_SESSION['rol'], ['superadmin', 'admin', 'recepcionista'])) {
    http_response_code(403);
    echo json_encode(["message" => "Acceso denegado."]);
    exit();
}

$database = new Database();
$db = $database->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch($method) {
    case 'GET':
        $medico_id = $_GET['medico_id'] ?? null;
        if(!$medico_id) {
            http_response_code(400);
            echo json_encode(["message" => "medico_id requerido."]);
            exit();
        }
        $query = "
            SELECT h.id, h.dia_semana, h.hora_inicio, h.hora_fin, h.duracion_turno_minutos,
                   h.unidad_id, u.nombre as unidad_nombre
            FROM horarios_medicos h
            LEFT JOIN unidades_atencion u ON h.unidad_id = u.id
            WHERE h.medico_id = :medico_id
            ORDER BY FIELD(h.dia_semana, 'Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo')
        ";
        $stmt = $db->prepare($query);
        $stmt->bindParam(":medico_id", $medico_id);
        $stmt->execute();
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        break;

    case 'POST':
        $data = json_decode(file_get_contents("php://input"));
        if(empty($data->medico_id) || !isset($data->horarios)) {
            http_response_code(400);
            echo json_encode(["message" => "medico_id y horarios son requeridos."]);
            exit();
        }

        if (!is_array($data->horarios)) { http_response_code(400); echo json_encode(['message'=>'La lista de horarios no es válida.']); exit(); }
        $days = ['Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo'];
        $blocks = [];
        foreach ($data->horarios as $h) {
            if (empty($h->dia_semana) || empty($h->hora_inicio) || empty($h->hora_fin)) continue;
            $startText = substr((string)$h->hora_inicio,0,5); $endText = substr((string)$h->hora_fin,0,5);
            if (!in_array($h->dia_semana,$days,true) || !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/',$startText) || !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/',$endText)) {
                http_response_code(400); echo json_encode(['message'=>'Revisá los días y horarios ingresados.']); exit();
            }
            $start=(int)substr($startText,0,2)*60+(int)substr($startText,3,2);
            $end=(int)substr($endText,0,2)*60+(int)substr($endText,3,2);
            $duration=filter_var($h->duracion_turno_minutos ?? 30,FILTER_VALIDATE_INT,['options'=>['min_range'=>5,'max_range'=>240]]);
            $unitId=filter_var($h->unidad_id ?? null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
            if ($start >= $end || !$duration || !$unitId) { http_response_code(400); echo json_encode(['message'=>'Cada bloque debe tener rango, duración y sede válidos.']); exit(); }
            $unitCheck=$db->prepare('SELECT 1 FROM unidades_atencion WHERE id=:id AND activa=1'); $unitCheck->execute([':id'=>$unitId]);
            if (!$unitCheck->fetchColumn()) { http_response_code(400); echo json_encode(['message'=>'Seleccioná una sede activa para cada bloque.']); exit(); }
            foreach ($blocks as $existing) {
                if ($existing['dia'] === $h->dia_semana && $start < $existing['end'] && $end > $existing['start']) {
                    http_response_code(400); echo json_encode(['message'=>'Hay horarios superpuestos para ese profesional.']); exit();
                }
            }
            $blocks[]=['dia'=>$h->dia_semana,'inicio'=>$startText.':00','fin'=>$endText.':00','duracion'=>$duration,'unidad_id'=>$unitId,'start'=>$start,'end'=>$end];
        }
        $doctorCheck=$db->prepare("SELECT id FROM usuarios WHERE id=:id AND rol='medico'"); $doctorCheck->execute([':id'=>$data->medico_id]);
        if (!$doctorCheck->fetchColumn()) { http_response_code(400); echo json_encode(['message'=>'El profesional seleccionado no es válido.']); exit(); }

        try {
            $db->beginTransaction();

            // Borrar horarios anteriores del médico
            $del = $db->prepare("DELETE FROM horarios_medicos WHERE medico_id = :medico_id");
            $del->bindParam(":medico_id", $data->medico_id);
            $del->execute();

            // Insertar los nuevos
            foreach($blocks as $h) {
                $ins = $db->prepare("
                    INSERT INTO horarios_medicos (medico_id, dia_semana, hora_inicio, hora_fin, duracion_turno_minutos, unidad_id)
                    VALUES (:medico_id, :dia, :inicio, :fin, :duracion, :unidad_id)
                ");
                $duracion = $h['duracion'];
                $unidad_id = $h['unidad_id'];
                $ins->bindParam(":medico_id", $data->medico_id);
                $ins->bindParam(":dia", $h['dia']);
                $ins->bindParam(":inicio", $h['inicio']);
                $ins->bindParam(":fin", $h['fin']);
                $ins->bindParam(":duracion", $duracion);
                $ins->bindParam(":unidad_id", $unidad_id);
                $ins->execute();
            }

            $db->commit();
            echo json_encode(["message" => "Horarios guardados exitosamente."]);
        } catch(PDOException $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(["message" => "No se pudieron guardar los horarios. Revisá los datos e intentá nuevamente."]);
        }
        break;
}
?>
