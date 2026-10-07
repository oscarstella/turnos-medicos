<?php
require_once __DIR__ . '/_auth.php';
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$query = "SELECT id, nombre FROM obras_sociales ORDER BY nombre ASC";
$stmt = $db->prepare($query);
$stmt->execute();
$obras = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach($obras as &$obra) {
    $q_planes = "SELECT id, nombre FROM planes_obras_sociales WHERE obra_social_id = :os_id ORDER BY nombre ASC";
    $s_planes = $db->prepare($q_planes);
    $s_planes->bindParam(":os_id", $obra['id']);
    $s_planes->execute();
    $obra['planes'] = $s_planes->fetchAll(PDO::FETCH_ASSOC);
}

echo json_encode($obras);
?>
