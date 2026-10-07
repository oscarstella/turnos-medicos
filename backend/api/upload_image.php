<?php
require_once __DIR__ . '/_auth.php';
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

if (!isset($_SESSION['user_id']) || !in_array($_SESSION['rol'] ?? '', ['superadmin', 'admin'], true)) {
    http_response_code(403);
    echo json_encode(array("message" => "Acceso denegado."));
    exit();
}

$target_dir = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'img' . DIRECTORY_SEPARATOR . 'medicos' . DIRECTORY_SEPARATOR;

// Create directory if it does not exist
if (!is_dir($target_dir)) {
    mkdir($target_dir, 0755, true);
}

if (!isset($_FILES["image"])) {
    http_response_code(400);
    echo json_encode(array("message" => "No se envió ninguna imagen."));
    exit();
}

if (($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    http_response_code(400); echo json_encode(['message'=>'La carga del archivo no se completó.']); exit();
}

// Check if image file is a actual image or fake image
$check = getimagesize($_FILES["image"]["tmp_name"]);
if($check === false) {
    http_response_code(400);
    echo json_encode(array("message" => "El archivo no es una imagen."));
    exit();
}

$mime = (new finfo(FILEINFO_MIME_TYPE))->file($_FILES['image']['tmp_name']);
$mimeExtensions = ['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'];
if (!isset($mimeExtensions[$mime]) || $check[0] > 6000 || $check[1] > 6000) {
    http_response_code(400); echo json_encode(['message'=>'La imagen debe ser JPG, PNG o WEBP y no superar 6000 px por lado.']); exit();
}

// Limit size to 5MB
if ($_FILES["image"]["size"] > 5000000) {
    http_response_code(400);
    echo json_encode(array("message" => "El archivo es demasiado grande (máx 5MB)."));
    exit();
}

// Generate unique name
$new_filename = bin2hex(random_bytes(16)) . '.' . $mimeExtensions[$mime];
$target_file = $target_dir . $new_filename;

if (move_uploaded_file($_FILES["image"]["tmp_name"], $target_file)) {
    echo json_encode(array(
        "message" => "Archivo subido exitosamente.",
        "url" => "img/medicos/" . $new_filename
    ));
} else {
    http_response_code(500);
    echo json_encode(array("message" => "Ocurrió un error al subir el archivo."));
}
?>
