<?php
require_once __DIR__ . '/_auth.php';
header("Content-Type: application/json; charset=UTF-8");

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$obra_social_id = isset($_GET['obra_social_id']) ? $_GET['obra_social_id'] : null;

if (!$obra_social_id) {
    echo json_encode([]);
    exit;
}

$query = "SELECT id, nombre FROM planes_obras_sociales WHERE obra_social_id = :os_id ORDER BY nombre ASC";
$stmt = $db->prepare($query);
$stmt->bindParam(":os_id", $obra_social_id);
$stmt->execute();

echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
