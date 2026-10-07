<?php
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
require_once '_auth.php';
require_once '../config/database.php';
$db = (new Database())->getConnection();

// Asegurar que el ENUM de estado en turnos contemple 'asignado'
try {
    $colState = $db->query("SHOW COLUMNS FROM turnos LIKE 'estado'")->fetch(PDO::FETCH_ASSOC);
    if ($colState && isset($colState['Type']) && strpos($colState['Type'], "'asignado'") === false) {
        $db->exec("ALTER TABLE turnos MODIFY COLUMN estado ENUM('libre','pendiente','confirmado','asignado','asistio','ausente','cancelado') NOT NULL DEFAULT 'asignado'");
    }
} catch (Exception $e) {}

$data = json_decode((string)file_get_contents('php://input'));

try {
    if (!is_object($data)) { http_response_code(400); throw new RuntimeException('Solicitud inválida.'); }
    $patient = require_firebase_user($db);
    if ($patient['rol'] !== 'paciente') throw new RuntimeException('Solo los pacientes pueden reservar turnos.');
    $doctorId = filter_var($data->medico_id ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $dateText = trim((string)($data->fecha ?? ''));
    $timeText = trim((string)($data->hora ?? ''));
    $tz = new DateTimeZone('America/Argentina/Buenos_Aires');
    $date = DateTime::createFromFormat('!Y-m-d', $dateText, $tz);
    if (!$doctorId || !$date || $date->format('Y-m-d') !== $dateText || $date < new DateTime('today', $tz)) {
        http_response_code(400); throw new RuntimeException('Seleccioná un profesional y una fecha futura válida.');
    }
    // Verificar límite de agenda del médico o global del sistema
    $docLimitQuery = $db->prepare("SELECT id, dias_antelacion_agenda FROM usuarios WHERE id = :id AND rol = 'medico' LIMIT 1");
    $docLimitQuery->execute([':id' => $doctorId]);
    $doctorRow = $docLimitQuery->fetch(PDO::FETCH_ASSOC);
    if (!$doctorRow) { http_response_code(400); throw new RuntimeException('El profesional seleccionado no está disponible.'); }

    if (!empty($doctorRow['dias_antelacion_agenda']) && (int)$doctorRow['dias_antelacion_agenda'] > 0) {
        $daysAhead = (int)$doctorRow['dias_antelacion_agenda'];
        $lastBookableDate = (new DateTime('today', $tz))->modify('+' . $daysAhead . ' days');
    } else {
        $agendaConfig = $db->prepare("SELECT valor FROM configuracion WHERE clave = 'meses_agenda' LIMIT 1");
        $agendaConfig->execute();
        $monthsAhead = max(1, min(12, (int)($agendaConfig->fetchColumn() ?: 3)));
        $lastBookableDate = (new DateTime('today', $tz))->modify('+' . $monthsAhead . ' months');
    }

    if ($date > $lastBookableDate) { http_response_code(400); throw new RuntimeException('La fecha está fuera del período habilitado para reservar.'); }
    if (!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $timeText)) {
        http_response_code(400); throw new RuntimeException('El horario seleccionado no es válido.');
    }

    $dayNames = [1=>'Lunes',2=>'Martes',3=>'Miercoles',4=>'Jueves',5=>'Viernes',6=>'Sabado',7=>'Domingo'];
    $dayName = $dayNames[(int)$date->format('N')];
    $schedules = $db->prepare('SELECT hora_inicio, hora_fin, duracion_turno_minutos, unidad_id FROM horarios_medicos WHERE medico_id = :id AND dia_semana = :dia ORDER BY hora_inicio');
    $schedules->execute([':id' => $doctorId, ':dia' => $dayName]);
    $minute = ((int)substr($timeText,0,2))*60 + (int)substr($timeText,3,2);
    $schedule = null;
    foreach ($schedules->fetchAll(PDO::FETCH_ASSOC) as $block) {
        $start = ((int)substr($block['hora_inicio'],0,2))*60 + (int)substr($block['hora_inicio'],3,2);
        $end = ((int)substr($block['hora_fin'],0,2))*60 + (int)substr($block['hora_fin'],3,2);
        $duration = (int)$block['duracion_turno_minutos'];
        if ($duration > 0 && $minute >= $start && $minute + $duration <= $end && (($minute - $start) % $duration) === 0) {
            $schedule = $block; break;
        }
    }
    if (!$schedule) { http_response_code(409); throw new RuntimeException('Ese horario no coincide con la agenda del profesional. Actualizá la página y elegí otro.'); }
    $unitId = (int)($schedule['unidad_id'] ?? 0);
    if ($unitId < 1 || !empty($data->unidad_id) && (int)$data->unidad_id !== $unitId) {
        http_response_code(409); throw new RuntimeException('La sede de ese horario cambió. Actualizá la página y volvé a elegir.');
    }
    $unit = $db->prepare('SELECT 1 FROM unidades_atencion WHERE id = :id AND activa = 1');
    $unit->execute([':id'=>$unitId]);
    if (!$unit->fetchColumn()) { http_response_code(409); throw new RuntimeException('La sede de ese horario ya no está activa.'); }
    $specialtyId = filter_var($data->especialidad_id ?? null, FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]]) ?: null;
    if (!$specialtyId) {
        $specialty = $db->prepare('SELECT especialidad_id FROM medicos_especialidades WHERE usuario_id = :id ORDER BY especialidad_id LIMIT 1');
        $specialty->execute([':id'=>$doctorId]); $specialtyId = (int)$specialty->fetchColumn() ?: null;
    }
    if ($specialtyId) {
        $checkSpecialty = $db->prepare('SELECT 1 FROM medicos_especialidades WHERE usuario_id = :doctor AND especialidad_id = :specialty');
        $checkSpecialty->execute([':doctor'=>$doctorId, ':specialty'=>$specialtyId]);
        if (!$checkSpecialty->fetchColumn()) { http_response_code(400); throw new RuntimeException('La especialidad no corresponde al profesional.'); }
    }

    $coverageId = filter_var($data->cobertura_id ?? null, FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]]) ?: null;
    $planId = filter_var($data->plan_id ?? null, FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]]) ?: null;
    if ($coverageId) {
        $coverage = $db->prepare('SELECT 1 FROM medicos_obras_sociales WHERE usuario_id = :doctor AND obra_social_id = :coverage');
        $coverage->execute([':doctor'=>$doctorId, ':coverage'=>$coverageId]);
        if (!$coverage->fetchColumn()) { http_response_code(400); throw new RuntimeException('El profesional no tiene registrada esa cobertura.'); }
    }
    if ($planId) {
        $plan = $db->prepare('SELECT obra_social_id FROM planes_obras_sociales WHERE id = :plan');
        $plan->execute([':plan'=>$planId]); $planCoverage = (int)$plan->fetchColumn();
        if (!$planCoverage || ($coverageId && $planCoverage !== $coverageId)) { http_response_code(400); throw new RuntimeException('El plan seleccionado no corresponde a la cobertura.'); }
        if (!$coverageId) $coverageId = $planCoverage;
        $allowed = $db->prepare('SELECT COUNT(*) FROM medicos_planes WHERE usuario_id = :doctor AND plan_id = :plan');
        $allowed->execute([':doctor'=>$doctorId, ':plan'=>$planId]);
        if ((int)$allowed->fetchColumn() === 0) { http_response_code(400); throw new RuntimeException('El profesional no tiene registrado ese plan.'); }
    }

    $startAt = $timeText . ':00';
    $finishMinute = $minute + (int)$schedule['duracion_turno_minutos'];
    $endAt = sprintf('%02d:%02d:00', intdiv($finishMinute,60), $finishMinute%60);
    $db->beginTransaction();
    // Serialize booking attempts for this doctor. This also prevents different-start overlapping slots.
    $lock = $db->prepare('SELECT id FROM usuarios WHERE id = :id FOR UPDATE');
    $lock->execute([':id'=>$doctorId]);
    $conflict = $db->prepare("SELECT id FROM turnos WHERE medico_id = :doctor AND fecha = :date AND estado IN ('asignado','pendiente','confirmado','asistio') AND hora_inicio < :end_time AND hora_fin > :start_time LIMIT 1");
    $conflict->execute([':doctor'=>$doctorId, ':date'=>$dateText, ':end_time'=>$endAt, ':start_time'=>$startAt]);
    if ($conflict->fetchColumn()) {
        $db->rollBack(); http_response_code(409); throw new RuntimeException('Ese horario acaba de ser reservado. Elegí otro horario disponible.');
    }
    $insert = $db->prepare("INSERT INTO turnos (medico_id,paciente_id,especialidad_id,obra_social_id,plan_id,unidad_id,fecha,hora_inicio,hora_fin,estado) VALUES (:doctor,:patient,:specialty,:coverage,:plan,:unit,:date,:start,:end,'asignado')");
    $insert->execute([':doctor'=>$doctorId, ':patient'=>$patient['id'], ':specialty'=>$specialtyId, ':coverage'=>$coverageId,
        ':plan'=>$planId, ':unit'=>$unitId, ':date'=>$dateText, ':start'=>$startAt, ':end'=>$endAt]);
    $turnoId = (int)$db->lastInsertId();
    $db->commit();
    http_response_code(201);
    echo json_encode(['status'=>'success','message'=>'Turno reservado exitosamente.','turno_id'=>$turnoId]);
} catch (Throwable $e) {
    if ($db->inTransaction()) $db->rollBack();
    if (http_response_code() < 400) http_response_code($e instanceof PDOException ? 500 : 401);
    $message = $e instanceof PDOException ? 'No se pudo reservar el turno. Actualizá la disponibilidad e intentá nuevamente.' : $e->getMessage();
    echo json_encode(['status'=>'error','message'=>$message]);
}
?>
