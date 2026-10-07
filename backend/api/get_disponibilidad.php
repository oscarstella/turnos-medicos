<?php
header('Content-Type: application/json; charset=UTF-8');
require_once '../config/database.php';
$db = (new Database())->getConnection();
$doctorId = filter_var($_GET['medico_id'] ?? null, FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]]);
$fromText = $_GET['desde'] ?? date('Y-m-d', strtotime('+1 day'));
$toText = $_GET['hasta'] ?? date('Y-m-d', strtotime('+90 days'));
$tz = new DateTimeZone('America/Argentina/Buenos_Aires');
$from = DateTime::createFromFormat('!Y-m-d', $fromText, $tz);
$to = DateTime::createFromFormat('!Y-m-d', $toText, $tz);
if (!$doctorId || !$from || !$to || $from->format('Y-m-d') !== $fromText || $to->format('Y-m-d') !== $toText || $to < $from || $from->diff($to)->days > 730) {
    http_response_code(400); echo json_encode(['message'=>'Parámetros de disponibilidad inválidos.']); exit;
}
try {
    // Verificar si el médico tiene un límite propio de días o usar la configuración general
    $doctorQuery = $db->prepare("SELECT id, dias_antelacion_agenda FROM usuarios WHERE id = :id AND rol = 'medico'");
    $doctorQuery->execute([':id'=>$doctorId]);
    $doctorData = $doctorQuery->fetch(PDO::FETCH_ASSOC);
    if (!$doctorData) { echo json_encode([]); exit; }

    if (!empty($doctorData['dias_antelacion_agenda']) && (int)$doctorData['dias_antelacion_agenda'] > 0) {
        $daysAhead = (int)$doctorData['dias_antelacion_agenda'];
        $maxDate = (new DateTime('today', $tz))->modify('+' . $daysAhead . ' days');
    } else {
        $agendaConfig = $db->prepare("SELECT valor FROM configuracion WHERE clave = 'meses_agenda' LIMIT 1");
        $agendaConfig->execute();
        $monthsAhead = max(1, min(12, (int)($agendaConfig->fetchColumn() ?: 3)));
        $maxDate = (new DateTime('today', $tz))->modify('+' . $monthsAhead . ' months');
    }

    if ($to > $maxDate) $to = $maxDate;
    if ($from > $maxDate) { echo json_encode([]); exit; }
    $scheduleQuery = $db->prepare('SELECT h.dia_semana,h.hora_inicio,h.hora_fin,h.duracion_turno_minutos,h.unidad_id FROM horarios_medicos h JOIN unidades_atencion u ON u.id = h.unidad_id AND u.activa = 1 WHERE h.medico_id = :id ORDER BY h.hora_inicio');
    $scheduleQuery->execute([':id'=>$doctorId]);
    $schedules = $scheduleQuery->fetchAll(PDO::FETCH_ASSOC);
    $busyQuery = $db->prepare("SELECT fecha,hora_inicio,hora_fin FROM turnos WHERE medico_id = :id AND fecha BETWEEN :from_date AND :to_date AND estado IN ('asignado','pendiente','confirmado','asistio')");
    $busyQuery->execute([':id'=>$doctorId,':from_date'=>$fromText,':to_date'=>$toText]);
    $busyByDate = [];
    foreach ($busyQuery->fetchAll(PDO::FETCH_ASSOC) as $busy) $busyByDate[$busy['fecha']][] = $busy;
    $dayNames = [1=>'Lunes',2=>'Martes',3=>'Miercoles',4=>'Jueves',5=>'Viernes',6=>'Sabado',7=>'Domingo'];
    $slots=[];
    for ($day=clone $from; $day <= $to; $day->modify('+1 day')) {
        if ($day < new DateTime('today',$tz)) continue;
        $date=$day->format('Y-m-d'); $dayName=$dayNames[(int)$day->format('N')];
        foreach ($schedules as $schedule) {
            if ($schedule['dia_semana'] !== $dayName) continue;
            $duration=(int)$schedule['duracion_turno_minutos']; if ($duration<1 || empty($schedule['unidad_id'])) continue;
            $start=(int)substr($schedule['hora_inicio'],0,2)*60+(int)substr($schedule['hora_inicio'],3,2);
            $end=(int)substr($schedule['hora_fin'],0,2)*60+(int)substr($schedule['hora_fin'],3,2);
            for($minute=$start; $minute+$duration <= $end; $minute += $duration) {
                $startTime=sprintf('%02d:%02d:00',intdiv($minute,60),$minute%60);
                $endMinute=$minute+$duration; $endTime=sprintf('%02d:%02d:00',intdiv($endMinute,60),$endMinute%60);
                $isBusy=false;
                foreach ($busyByDate[$date] ?? [] as $busy) {
                    if ($busy['hora_inicio'] < $endTime && $busy['hora_fin'] > $startTime) { $isBusy=true; break; }
                }
                if (!$isBusy) $slots[]=['fecha'=>$date,'hora_inicio'=>substr($startTime,0,5),'hora_fin'=>substr($endTime,0,5),'unidad_id'=>(int)$schedule['unidad_id']];
            }
        }
    }
    echo json_encode($slots);
} catch (Throwable $e) {
    http_response_code(500); echo json_encode(['message'=>'No se pudo consultar la disponibilidad.']);
}
?>
