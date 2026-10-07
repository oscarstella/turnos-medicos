<?php
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=UTF-8');

if (!isset($_SESSION['user_id']) || !in_array($_SESSION['rol'] ?? '', ['superadmin','admin'], true)) {
    http_response_code(403); echo json_encode(['status'=>'error','message'=>'Acceso denegado.']); exit;
}

$database = new Database();
$db = $database->getConnection();

if (!$db) {
    echo json_encode(["status" => "error", "message" => "Sin conexion BD"]);
    exit;
}

try {
    // 1. Obtener los últimos turnos registrados
    $stmt = $db->query("
        SELECT t.id, t.fecha, t.hora_inicio, t.medico_id, t.paciente_id, t.obra_social_id, t.plan_id,
               u.nombre as med_nombre, u.apellido as med_apellido,
               pac.nombre as pac_nombre, pac.apellido as pac_apellido, pac.email as pac_email
        FROM turnos t
        LEFT JOIN usuarios u ON t.medico_id = u.id
        LEFT JOIN usuarios pac ON t.paciente_id = pac.id
        ORDER BY t.id DESC
        LIMIT 10
    ");
    $turnos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 2. Buscar el id de Swiss Medical Group
    $stmt_sm = $db->query("SELECT id FROM obras_sociales WHERE nombre LIKE '%Swiss Medical%' LIMIT 1");
    $sm_id = $stmt_sm->fetchColumn() ?: 1863;

    // Buscar el primer plan de Swiss Medical o Plan Black si existe
    $stmt_pl = $db->prepare("SELECT id FROM planes_obras_sociales WHERE obra_social_id = :os_id ORDER BY id ASC LIMIT 1");
    $stmt_pl->execute([':os_id' => $sm_id]);
    $default_plan_id = $stmt_pl->fetchColumn() ?: null;

    $actualizados = 0;
    // Si los turnos recientes del paciente Oscar Stella tienen obra_social_id NULL, actualizarlos a Swiss Medical
    foreach ($turnos as $t) {
        if (empty($t['obra_social_id'])) {
            // Si el plan_id guardado coincide con la obra social (por el bug del plan.id = 1863)
            $plan_a_asignar = $default_plan_id;
            if (!empty($t['plan_id'])) {
                // Verificar si plan_id es un plan válido en planes_obras_sociales
                $check_plan = $db->prepare("SELECT obra_social_id FROM planes_obras_sociales WHERE id = :pid");
                $check_plan->execute([':pid' => $t['plan_id']]);
                $real_os = $check_plan->fetchColumn();
                if ($real_os) {
                    $sm_id = $real_os;
                    $plan_a_asignar = $t['plan_id'];
                }
            }

            $upd = $db->prepare("UPDATE turnos SET obra_social_id = :os_id, plan_id = :plan_id WHERE id = :id");
            $upd->execute([
                ':os_id' => $sm_id,
                ':plan_id' => $plan_a_asignar,
                ':id' => $t['id']
            ]);
            $actualizados++;
        }
    }

    echo json_encode([
        "status" => "success",
        "turnos_recientes" => $turnos,
        "turnos_actualizados" => $actualizados,
        "swiss_medical_id" => $sm_id
    ]);
} catch (Throwable $e) {
    echo json_encode(["status" => "error", "message" => "No se pudo completar la corrección de coberturas."]);
}
