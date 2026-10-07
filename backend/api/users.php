<?php
require_once __DIR__ . '/_auth.php';
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../config/database.php';

// Verificar permisos (solo superadmin o recepcionista pueden ver todos los usuarios)
if (!isset($_SESSION['rol']) || !in_array($_SESSION['rol'], ['superadmin', 'admin', 'recepcionista'])) {
    http_response_code(403);
    echo json_encode(array("message" => "Acceso denegado. No tienes permisos suficientes."));
    exit();
}

$database = new Database();
$db = $database->getConnection();

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // Leer usuarios (solo pacientes/usuarios comunes, excluyendo médicos ya que tienen su propia sección)
        $filtroRol = isset($_GET['rol']) ? trim($_GET['rol']) : 'paciente';
        if ($filtroRol === 'todos') {
            $query = "SELECT id, email, nombre, apellido, rol, telefono, creado_en FROM usuarios WHERE rol != 'medico' ORDER BY nombre ASC";
            $stmt = $db->prepare($query);
        } else {
            $query = "SELECT id, email, nombre, apellido, rol, telefono, creado_en FROM usuarios WHERE rol = :rol ORDER BY nombre ASC";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':rol', $filtroRol);
        }
        $stmt->execute();
        
        $usuarios = array();
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)){
            array_push($usuarios, $row);
        }
        echo json_encode($usuarios);
        break;

    case 'POST':
        // Crear nuevo paciente desde admin
        $data = json_decode(file_get_contents("php://input"));
        if (!empty($data->nombre) && !empty($data->email)) {
            $nombre = trim($data->nombre);
            $apellido = !empty($data->apellido) ? trim($data->apellido) : '';
            $email = trim($data->email);
            $dni = normalize_dni($data->dni ?? '');
            if (!valid_dni($dni)) { http_response_code(400); echo json_encode(['message'=>'El DNI debe tener 7 u 8 números.']); exit(); }
            $fecha_nacimiento = !empty($data->fecha_nacimiento) ? trim($data->fecha_nacimiento) : null;
            $telefono = !empty($data->telefono) ? trim($data->telefono) : null;
            $obra_social_id = (!empty($data->obra_social_id) && is_numeric($data->obra_social_id)) ? intval($data->obra_social_id) : null;
            $plan_id = (!empty($data->plan_id) && is_numeric($data->plan_id)) ? intval($data->plan_id) : null;
            $rol = 'paciente';
            $fuid = 'admin_created_' . time() . '_' . rand(100, 999);

            // Verificar si el email ya existe
            $chk = $db->prepare("SELECT id FROM usuarios WHERE email = :email");
            $chk->execute([':email' => $email]);
            if ($chk->rowCount() > 0) {
                http_response_code(400);
                echo json_encode(["message" => "Ya existe un usuario con este correo electrónico."]);
                exit();
            }
            $chkDni = $db->prepare("SELECT id FROM usuarios WHERE REGEXP_REPLACE(dni, '[^0-9]', '') = :dni");
            $chkDni->execute([':dni'=>$dni]);
            if ($chkDni->fetchColumn()) { http_response_code(409); echo json_encode(['message'=>'Ya existe una ficha con ese DNI.']); exit(); }

            $tiene_whatsapp = isset($data->tiene_whatsapp) ? ($data->tiene_whatsapp ? 1 : 0) : 1;

            $query = "INSERT INTO usuarios (firebase_uid, nombre, apellido, email, dni, fecha_nacimiento, telefono, tiene_whatsapp, obra_social_id, plan_id, rol)
                      VALUES (:fuid, :nombre, :apellido, :email, :dni, :fecha_nac, :tel, :tiene_whatsapp, :os_id, :pl_id, :rol)";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':fuid', $fuid);
            $stmt->bindParam(':nombre', $nombre);
            $stmt->bindParam(':apellido', $apellido);
            $stmt->bindParam(':email', $email);
            $stmt->bindParam(':dni', $dni);
            $stmt->bindParam(':fecha_nac', $fecha_nacimiento);
            $stmt->bindParam(':tel', $telefono);
            $stmt->bindParam(':tiene_whatsapp', $tiene_whatsapp, PDO::PARAM_INT);
            $stmt->bindParam(':os_id', $obra_social_id);
            $stmt->bindParam(':pl_id', $plan_id);
            $stmt->bindParam(':rol', $rol);

            if ($stmt->execute()) {
                http_response_code(201);
                echo json_encode(["message" => "Paciente registrado exitosamente.", "id" => $db->lastInsertId()]);
            } else {
                http_response_code(503);
                echo json_encode(["message" => "No se pudo registrar el paciente."]);
            }
        } else {
            http_response_code(400);
            echo json_encode(["message" => "Nombre y email son requeridos."]);
        }
        break;

    case 'PUT':
        // Actualizar datos del usuario
        $data = json_decode(file_get_contents("php://input"));
        
        if (!empty($data->id)) {
            // Si solo vino 'rol' (compatibilidad con select inline anterior)
            if (isset($data->rol) && !isset($data->nombre)) {
                if ($_SESSION['rol'] !== 'superadmin' || !in_array($data->rol, ['superadmin','admin','recepcionista','medico','paciente'], true)) {
                    http_response_code(403);
                    echo json_encode(array("message" => "Solo un superadmin puede cambiar roles y debe elegir un rol válido."));
                    exit();
                }
                $query = "UPDATE usuarios SET rol = :rol WHERE id = :id";
                $stmt = $db->prepare($query);
                $stmt->bindParam(':rol', $data->rol);
                $stmt->bindParam(':id', $data->id);
                if($stmt->execute()) {
                    echo json_encode(array("message" => "Rol actualizado exitosamente."));
                } else {
                    http_response_code(503);
                    echo json_encode(array("message" => "Error al actualizar rol."));
                }
                break;
            }

            // Actualización completa de datos del paciente
            $nombre = trim($data->nombre ?? '');
            $apellido = trim($data->apellido ?? '');
            $dni = normalize_dni($data->dni ?? '');
            if (!valid_dni($dni)) { http_response_code(400); echo json_encode(['message'=>'El DNI debe tener 7 u 8 números.']); exit(); }
            $fecha_nacimiento = !empty($data->fecha_nacimiento) ? trim($data->fecha_nacimiento) : null;
            $telefono = !empty($data->telefono) ? trim($data->telefono) : null;
            $email = trim($data->email ?? '');
            $obra_social_id = (!empty($data->obra_social_id) && is_numeric($data->obra_social_id)) ? intval($data->obra_social_id) : null;
            $plan_id = (!empty($data->plan_id) && is_numeric($data->plan_id)) ? intval($data->plan_id) : null;

            $dup = $db->prepare("SELECT id FROM usuarios WHERE REGEXP_REPLACE(dni, '[^0-9]', '') = :dni AND id <> :id LIMIT 1");
            $dup->execute([':dni'=>$dni, ':id'=>$data->id]);
            if ($dup->fetchColumn()) { http_response_code(409); echo json_encode(['message'=>'Ya existe otra ficha con ese DNI.']); exit(); }

            $tiene_whatsapp = isset($data->tiene_whatsapp) ? ($data->tiene_whatsapp ? 1 : 0) : 1;

            $query = "UPDATE usuarios 
                      SET nombre = :nombre, 
                          apellido = :apellido, 
                          dni = :dni, 
                          fecha_nacimiento = :fecha_nac, 
                          telefono = :tel, 
                          tiene_whatsapp = :tiene_whatsapp,
                          email = :email, 
                          obra_social_id = :os_id, 
                          plan_id = :pl_id 
                      WHERE id = :id";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':nombre', $nombre);
            $stmt->bindParam(':apellido', $apellido);
            $stmt->bindParam(':dni', $dni);
            $stmt->bindParam(':fecha_nac', $fecha_nacimiento);
            $stmt->bindParam(':tel', $telefono);
            $stmt->bindParam(':tiene_whatsapp', $tiene_whatsapp, PDO::PARAM_INT);
            $stmt->bindParam(':email', $email);
            $stmt->bindParam(':os_id', $obra_social_id);
            $stmt->bindParam(':pl_id', $plan_id);
            $stmt->bindParam(':id', $data->id);
            
            if($stmt->execute()) {
                echo json_encode(array("message" => "Datos de usuario actualizados exitosamente."));
            } else {
                http_response_code(503);
                echo json_encode(array("message" => "Error al actualizar datos."));
            }
        } else {
            http_response_code(400);
            echo json_encode(array("message" => "Se requiere ID de usuario."));
        }
        break;

    case 'DELETE':
        $data = json_decode(file_get_contents("php://input"));
        $id = $data->id ?? ($_GET['id'] ?? null);
        if(!empty($id)) {
            $del = $db->prepare("DELETE FROM usuarios WHERE id = :id AND rol = 'paciente'");
            $del->bindParam(':id', $id);
            if ($del->execute()) {
                echo json_encode(["message" => "Usuario eliminado exitosamente."]);
            } else {
                http_response_code(503);
                echo json_encode(["message" => "No se pudo eliminar el usuario."]);
            }
        } else {
            http_response_code(400);
            echo json_encode(["message" => "ID de usuario requerido."]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(array("message" => "Método no permitido"));
        break;
}
?>
