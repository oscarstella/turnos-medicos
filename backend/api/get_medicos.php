<?php
require_once __DIR__ . '/_auth.php';
header("Content-Type: application/json; charset=UTF-8");

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$especialidad_id = isset($_GET['especialidad_id']) ? $_GET['especialidad_id'] : null;

// Obtener médicos, filtrando por especialidad si se provee
$query = "
    SELECT u.id, u.nombre, u.apellido 
    FROM usuarios u
";

if ($especialidad_id) {
    $query .= "
        INNER JOIN medicos_especialidades me ON u.id = me.usuario_id
        WHERE u.rol = 'medico' AND me.especialidad_id = :esp_id
    ";
} else {
    $query .= " WHERE u.rol = 'medico'";
}

$query .= " ORDER BY u.nombre ASC";

$stmt = $db->prepare($query);

if ($especialidad_id) {
    $stmt->bindParam(":esp_id", $especialidad_id);
}

$stmt->execute();
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
