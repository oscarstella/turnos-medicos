<?php
require_once __DIR__ . '/_auth.php';
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Cualquiera puede leer la configuración pública (ej. meses_agenda para mostrar)
    $query = "SELECT clave, valor FROM configuracion";
    $stmt = $db->prepare($query);
    $stmt->execute();
    
    $config = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $config[$row['clave']] = $row['valor'];
    }
    
    // Fallbacks if not present
    if (!isset($config['meses_agenda'])) {
        $config['meses_agenda'] = 3;
    }
    
    echo json_encode($config);
} elseif ($method === 'POST') {
    // Solo superadmin/admin pueden cambiar la configuración
    if (!isset($_SESSION['user_id']) || !in_array($_SESSION['rol'], ['superadmin', 'admin'])) {
        http_response_code(403);
        echo json_encode(array("message" => "Acceso denegado."));
        exit();
    }
    
    $data = json_decode(file_get_contents("php://input"), true);
    
    if (is_array($data)) {
        $db->beginTransaction();
        try {
            $query = "INSERT INTO configuracion (clave, valor) VALUES (:clave, :valor) 
                      ON DUPLICATE KEY UPDATE valor = :valor";
            $stmt = $db->prepare($query);
            
            foreach ($data as $clave => $valor) {
                $stmt->bindParam(":clave", $clave);
                $stmt->bindParam(":valor", $valor);
                $stmt->execute();
            }
            $db->commit();
            echo json_encode(array("message" => "Configuración guardada exitosamente."));
        } catch(PDOException $e) {
            $db->rollBack();
            http_response_code(503);
            echo json_encode(array("message" => "No se pudo guardar la configuración."));
        }
    } else {
        http_response_code(400);
        echo json_encode(array("message" => "Datos inválidos."));
    }
}
?>
