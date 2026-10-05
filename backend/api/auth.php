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

// Recibir los datos JSON del frontend
$data = json_decode(file_get_contents("php://input"));

if(!empty($data->firebase_uid) && !empty($data->email)) {
    $uid = $data->firebase_uid;
    $email = $data->email;
    $nombre = !empty($data->nombre) ? $data->nombre : "Usuario";

    try {
        // Verificar si el usuario ya existe en la base de datos por DNI (si se proporcionó) o por email
        $dniVal = !empty($data->dni) ? trim($data->dni) : null;
        if (!empty($dniVal)) {
            $query = "SELECT id, rol, nombre, firebase_uid, email, dni FROM usuarios WHERE dni = :dni OR email = :email LIMIT 1";
            $stmt = $db->prepare($query);
            $stmt->bindParam(":dni", $dniVal);
            $stmt->bindParam(":email", $email);
        } else {
            $query = "SELECT id, rol, nombre, firebase_uid, email, dni FROM usuarios WHERE email = :email LIMIT 1";
            $stmt = $db->prepare($query);
            $stmt->bindParam(":email", $email);
        }
        $stmt->execute();
        
        if($stmt->rowCount() > 0) {
            // Usuario existe, obtener sus datos
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Si el UID de firebase guardado es un temp (creado por admin) o nulo, actualizarlo
            if ($row['firebase_uid'] !== $uid) {
                $update_query = "UPDATE usuarios SET firebase_uid = :uid WHERE id = :id";
                $update_stmt = $db->prepare($update_query);
                $update_stmt->bindParam(":uid", $uid);
                $update_stmt->bindParam(":id", $row['id']);
                $update_stmt->execute();
            }
            
            // Actualizar datos del usuario si vinieron datos adicionales y no estaban en la BD
            $updFields = [];
            $updParams = [':id' => $row['id']];
            if (!empty($data->dni)) { $updFields[] = "dni = COALESCE(dni, :dni)"; $updParams[':dni'] = $data->dni; }
            if (!empty($data->fecha_nacimiento)) { $updFields[] = "fecha_nacimiento = COALESCE(fecha_nacimiento, :fnac)"; $updParams[':fnac'] = $data->fecha_nacimiento; }
            if (!empty($data->telefono)) { $updFields[] = "telefono = COALESCE(telefono, :tel)"; $updParams[':tel'] = $data->telefono; }
            if (!empty($data->obra_social_id) && is_numeric($data->obra_social_id)) { $updFields[] = "obra_social_id = COALESCE(obra_social_id, :os_id)"; $updParams[':os_id'] = intval($data->obra_social_id); }
            if (!empty($data->plan_id) && is_numeric($data->plan_id)) { $updFields[] = "plan_id = COALESCE(plan_id, :pl_id)"; $updParams[':pl_id'] = intval($data->plan_id); }
            if (!empty($updFields)) {
                try {
                    $q_upd_extra = "UPDATE usuarios SET " . implode(", ", $updFields) . " WHERE id = :id";
                    $s_upd_extra = $db->prepare($q_upd_extra);
                    $s_upd_extra->execute($updParams);
                } catch(Throwable $e) {}
            }

            // Iniciar sesión en PHP
            $_SESSION['user_id'] = $row['id'];
            $_SESSION['rol'] = $row['rol'];
            $_SESSION['nombre'] = $row['nombre'];

            // Contar turnos pendientes del paciente
            $stmt_pend = $db->prepare("SELECT COUNT(*) FROM turnos WHERE paciente_id = :pid AND estado = 'pendiente' AND fecha >= CURDATE()");
            $stmt_pend->execute([':pid' => $row['id']]);
            $turnosPendientes = intval($stmt_pend->fetchColumn());

            http_response_code(200);
            echo json_encode(array(
                "message" => "Login exitoso.",
                "user" => array(
                    "id" => $row['id'],
                    "nombre" => $row['nombre'],
                    "rol" => $row['rol'],
                    "turnos_pendientes" => $turnosPendientes
                )
            ));
        } else {
            // Capturar datos extras si vienen
            $apellido = !empty($data->apellido) ? $data->apellido : "";
            $dni = !empty($data->dni) ? $data->dni : null;
            $fecha_nacimiento = !empty($data->fecha_nacimiento) ? $data->fecha_nacimiento : null;
            $telefono = !empty($data->telefono) ? $data->telefono : null;
            $obra_social_id = (!empty($data->obra_social_id) && is_numeric($data->obra_social_id)) ? intval($data->obra_social_id) : null;
            $plan_id = (!empty($data->plan_id) && is_numeric($data->plan_id)) ? intval($data->plan_id) : null;

            // Usuario NO existe, lo registramos por primera vez (como paciente por defecto)
            $query = "INSERT INTO usuarios (firebase_uid, email, nombre, apellido, dni, fecha_nacimiento, telefono, obra_social_id, plan_id, rol) 
                      VALUES (:uid, :email, :nombre, :apellido, :dni, :fecha_nacimiento, :telefono, :os_id, :pl_id, 'paciente')";
            $stmt = $db->prepare($query);
            $stmt->bindParam(":uid", $uid);
            $stmt->bindParam(":email", $email);
            $stmt->bindParam(":nombre", $nombre);
            $stmt->bindParam(":apellido", $apellido);
            $stmt->bindParam(":dni", $dni);
            $stmt->bindParam(":fecha_nacimiento", $fecha_nacimiento);
            $stmt->bindParam(":telefono", $telefono);
            $stmt->bindParam(":os_id", $obra_social_id);
            $stmt->bindParam(":pl_id", $plan_id);

            if($stmt->execute()) {
                $new_id = $db->lastInsertId();
                
                $_SESSION['user_id'] = $new_id;
                $_SESSION['rol'] = 'paciente';
                $_SESSION['nombre'] = $nombre;

                http_response_code(201);
                echo json_encode(array(
                    "message" => "Usuario registrado e inició sesión exitosamente.",
                    "user" => array(
                        "id" => $new_id,
                        "nombre" => $nombre,
                        "rol" => 'paciente',
                        "turnos_pendientes" => 0
                    )
                ));
            } else {
                http_response_code(503);
                echo json_encode(array("message" => "No se pudo registrar el usuario."));
            }
        }
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(array("message" => "Error de base de datos: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Datos incompletos. Se requiere firebase_uid y email."));
}
?>
