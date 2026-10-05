<?php
session_start();
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();
$data = json_decode(file_get_contents("php://input"));

$identifier = !empty($data->email) ? trim($data->email) : (!empty($data->dni) ? trim($data->dni) : (!empty($data->usuario) ? trim($data->usuario) : ''));

if (!empty($identifier) && !empty($data->password)) {
    $password = $data->password;

    $query = "SELECT id, firebase_uid, email, dni, nombre, apellido, rol, contrasena FROM usuarios WHERE email = :identifier OR dni = :identifier LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(":identifier", $identifier);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        // Si el usuario tiene contraseña local
        if (!empty($user['contrasena'])) {
            if (password_verify($password, $user['contrasena'])) {
                // Contraseña válida
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['rol'] = $user['rol'];
                $_SESSION['email'] = $user['email'];
                
                // Quitamos el hash antes de devolver
                unset($user['contrasena']);

                // Contar turnos pendientes futuros o en estado pendiente
                $stmt_pend = $db->prepare("SELECT COUNT(*) FROM turnos WHERE paciente_id = :pid AND estado = 'pendiente' AND fecha >= CURDATE()");
                $stmt_pend->execute([':pid' => $user['id']]);
                $turnosPendientes = intval($stmt_pend->fetchColumn());
                $user['turnos_pendientes'] = $turnosPendientes;

                http_response_code(200);
                echo json_encode(array(
                    "status" => "success",
                    "message" => "Inicio de sesión exitoso.",
                    "user" => $user
                ));
            } else {
                http_response_code(401);
                echo json_encode(array("status" => "error", "message" => "Contraseña incorrecta."));
            }
        } else {
            // El usuario existe pero no tiene contraseña local, por lo que debe loguearse con Firebase
            http_response_code(200);
            echo json_encode(array(
                "status" => "use_firebase",
                "email" => $user['email'],
                "message" => "Este usuario debe iniciar sesión con Firebase."
            ));
        }
    } else {
        // Usuario no existe en DB, puede que sea de Firebase
        http_response_code(200);
        echo json_encode(array("status" => "use_firebase", "email" => $identifier, "message" => "Usuario no encontrado localmente, intentando con Firebase."));
    }
} else {
    http_response_code(400);
    echo json_encode(array("status" => "error", "message" => "Datos incompletos. Faltan credenciales."));
}
?>
