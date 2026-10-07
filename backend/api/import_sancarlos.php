<?php
require_once __DIR__ . '/_auth.php';
require_once '../config/database.php';

header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id']) || ($_SESSION['rol'] ?? '') !== 'superadmin') {
    http_response_code(403); echo json_encode(['status'=>'error','message'=>'Acceso denegado.']); exit;
}

try {
    // Definir la ruta del archivo SQL (en la raíz del proyecto)
    $sql_file = __DIR__ . '/../../sancarlos_medicos.sql';

    if (!file_exists($sql_file)) {
        throw new Exception("El archivo sancarlos_medicos.sql no fue encontrado en la raíz del proyecto.");
    }

    $sql = file_get_contents($sql_file);

    // Habilitar simulación de sentencias preparadas para multi-query
    $db->setAttribute(PDO::ATTR_EMULATE_PREPARES, true);

    // Ejecutar todas las sentencias
    $db->exec($sql);

    echo json_encode([
        'status' => 'success',
        'message' => 'Los médicos de San Carlos fueron importados y actualizados exitosamente en la base de datos.'
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'No se pudo completar la importación.'
    ]);
}
?>
