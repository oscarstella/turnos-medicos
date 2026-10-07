<?php
require_once __DIR__ . '/_auth.php';
header("Content-Type: application/json; charset=UTF-8");

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();
try {
    $admin = require_firebase_user($db);
    if (!in_array($admin['rol'], ['superadmin', 'admin', 'recepcionista'], true)) {
        http_response_code(403); echo json_encode(['message'=>'Acceso denegado.']); exit();
    }
} catch (Throwable $e) {
    http_response_code(401); echo json_encode(['message'=>'Iniciá sesión con una cuenta autorizada.']); exit();
}

try {
    $filtroRol = isset($_GET['rol']) ? trim($_GET['rol']) : 'paciente';
    
    // Por defecto y para separar médicos de usuarios, traemos únicamente los pacientes (usuarios que sacan turnos)
    $whereRol = "WHERE u.rol = 'paciente'";
    if ($filtroRol === 'todos') {
        $whereRol = "WHERE u.rol != 'medico'"; // Médicos tienen su propia sección ('Gestión de Médicos')
    } elseif ($filtroRol !== '' && $filtroRol !== 'paciente') {
        $whereRol = "WHERE u.rol = :rol";
    }

    $query = "
        SELECT u.id, u.nombre, u.apellido, u.dni, u.fecha_nacimiento, u.email, u.telefono, u.rol, u.creado_en,
               u.obra_social_id, os.nombre as obra_social_nombre,
               u.plan_id, p.nombre as plan_nombre
        FROM usuarios u
        LEFT JOIN obras_sociales os ON u.obra_social_id = os.id
        LEFT JOIN planes_obras_sociales p ON u.plan_id = p.id
        {$whereRol}
        ORDER BY u.creado_en DESC, u.id DESC
    ";
    $stmt = $db->prepare($query);
    if ($filtroRol !== 'todos' && $filtroRol !== '' && $filtroRol !== 'paciente') {
        $stmt->bindParam(":rol", $filtroRol);
    }
    $stmt->execute();
    
    $usuarios = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(["usuarios" => $usuarios]);
} catch(PDOException $e) {
    http_response_code(500);
    echo json_encode(["message" => "No se pudo obtener la lista de pacientes."]);
}
?>
