<?php
header('Content-Type: application/json; charset=UTF-8');
require_once '_auth.php';
require_once '../config/database.php';
$db = (new Database())->getConnection();

// Asegurar que el ENUM contenga 'asignado' y migrar turnos históricos en 'confirmado' a 'asignado'
try {
    $colState = $db->query("SHOW COLUMNS FROM turnos LIKE 'estado'")->fetch(PDO::FETCH_ASSOC);
    if ($colState && isset($colState['Type']) && strpos($colState['Type'], "'asignado'") === false) {
        $db->exec("ALTER TABLE turnos MODIFY COLUMN estado ENUM('libre','pendiente','confirmado','asignado','asistio','ausente','cancelado') NOT NULL DEFAULT 'asignado'");
    }
    // Convertir turnos creados previamente que tenían 'confirmado' por defecto al nuevo estatus 'asignado'
    $db->exec("UPDATE turnos SET estado = 'asignado' WHERE estado = 'confirmado'");
} catch (Exception $e) {}

try {
    $user = require_firebase_user($db);
    $isAdmin = in_array($user['rol'], ['superadmin','admin','recepcionista'], true);
    $sql = "SELECT t.id, t.fecha, t.hora_inicio, t.hora_fin, t.estado, t.creado_en, t.medico_id,
                   u.nombre AS medico_nombre, u.apellido AS medico_apellido, u.telefono AS medico_telefono,
                   COALESCE(e.nombre,'Consulta General') AS especialidad_nombre,
                   o.nombre AS obra_social_nombre, p.nombre AS plan_nombre,
                   pac.id AS paciente_id, pac.nombre AS paciente_nombre, pac.apellido AS paciente_apellido,
                   pac.telefono AS paciente_telefono, pac.email AS paciente_email, pac.dni AS paciente_dni,
                   uat.nombre AS sede_nombre, uat.calle AS sede_calle, uat.numero AS sede_numero 
            FROM turnos t 
            LEFT JOIN usuarios u ON t.medico_id=u.id 
            LEFT JOIN especialidades e ON t.especialidad_id=e.id 
            LEFT JOIN obras_sociales o ON t.obra_social_id=o.id 
            LEFT JOIN planes_obras_sociales p ON t.plan_id=p.id 
            LEFT JOIN usuarios pac ON t.paciente_id=pac.id 
            LEFT JOIN unidades_atencion uat ON t.unidad_id=uat.id";
    if (!$isAdmin) $sql .= ' WHERE t.paciente_id = :user_id';
    $sql .= ' ORDER BY t.fecha DESC, t.hora_inicio DESC';
    $stmt=$db->prepare($sql);
    if (!$isAdmin) $stmt->bindValue(':user_id',(int)$user['id'],PDO::PARAM_INT);
    $stmt->execute();
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
} catch (Throwable $e) {
    http_response_code(401); echo json_encode(['error'=>'unauthorized','message'=>'Iniciá sesión para consultar los turnos.']);
}
?>
