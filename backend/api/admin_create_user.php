<?php
require_once __DIR__ . '/_auth.php';
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../config/database.php';

// Verificar permisos (solo superadmin o admin pueden crear usuarios)
if (!isset($_SESSION['user_id']) || !in_array($_SESSION['rol'], ['superadmin', 'admin'])) {
    http_response_code(403);
    echo json_encode(array("message" => "Acceso denegado. Se requiere nivel de administrador."));
    exit();
}

$database = new Database();
$db = $database->getConnection();
$data = json_decode(file_get_contents("php://input"));

if(
    !empty($data->email) &&
    !empty($data->nombre) &&
    !empty($data->rol)
) {
    try {
        // En este sistema, Firebase Auth maneja las contraseñas.
        // Pero para el CRUD de admin, podemos guardar el usuario en la DB local primero
        // y generar un firebase_uid falso o indicar que debe crearlo en Firebase.
        // Lo ideal es que el admin llame a la Admin SDK de Firebase en NodeJS, pero en PHP
        // guardaremos un "firebase_uid" temporal y cuando el usuario inicie sesión por 
        // primera vez, se actualice, o simplemente usar un email.
        
        $email = $data->email;
        $nombre = $data->nombre;
        $apellido = !empty($data->apellido) ? $data->apellido : "";
        $dni = !empty($data->dni) ? $data->dni : null;
        $rol = $data->rol;
        $rolesPermitidos = ['paciente','medico','recepcionista','admin','superadmin'];
        if (!in_array($rol, $rolesPermitidos, true) || (in_array($rol, ['admin','superadmin'], true) && $_SESSION['rol'] !== 'superadmin')) {
            http_response_code(403);
            echo json_encode(['message'=>'No tenés permisos para asignar ese rol.']);
            exit();
        }
        if ($rol === 'paciente') {
            $dni = preg_replace('/\D+/', '', (string)$dni);
            if (!preg_match('/^\d{7,8}$/', $dni)) { http_response_code(400); echo json_encode(['message'=>'El DNI debe tener 7 u 8 números.']); exit(); }
            $checkDni = $db->prepare("SELECT id FROM usuarios WHERE REGEXP_REPLACE(dni, '[^0-9]', '') = :dni LIMIT 1");
            $checkDni->execute([':dni'=>$dni]);
            if ($checkDni->fetchColumn()) { http_response_code(409); echo json_encode(['message'=>'Ya existe una ficha con ese DNI.']); exit(); }
        }
        
        $contrasena = null;
        if (!empty($data->password)) {
            $contrasena = password_hash($data->password, PASSWORD_BCRYPT);
        }

        // Generar un UID temporal único
        $temp_uid = "local_" . uniqid();

        $query = "INSERT INTO usuarios (firebase_uid, email, nombre, apellido, dni, rol, contrasena) VALUES (:uid, :email, :nombre, :apellido, :dni, :rol, :contrasena)";
        $stmt = $db->prepare($query);
        $stmt->bindParam(":uid", $temp_uid);
        $stmt->bindParam(":email", $email);
        $stmt->bindParam(":nombre", $nombre);
        $stmt->bindParam(":apellido", $apellido);
        $stmt->bindParam(":dni", $dni);
        $stmt->bindParam(":rol", $rol);
        $stmt->bindParam(":contrasena", $contrasena);

        if($stmt->execute()) {
            http_response_code(201);
            echo json_encode(array("message" => "Usuario creado exitosamente en la base de datos local. Nota: Debe registrarse en Firebase con el mismo email para acceder."));
        } else {
            http_response_code(503);
            echo json_encode(array("message" => "No se pudo crear el usuario. Verifique si el email ya existe."));
        }
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(array("message" => "No se pudo crear el usuario. Verificá los datos e intentá nuevamente."));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Datos incompletos. Se requiere email, nombre y rol."));
}
?>
