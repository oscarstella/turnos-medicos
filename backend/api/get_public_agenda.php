<?php
header("Content-Type: application/json; charset=UTF-8");

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$search_nombre = isset($_GET['nombre']) ? trim($_GET['nombre']) : '';
$search_especialidad = isset($_GET['especialidad_id']) ? intval($_GET['especialidad_id']) : 0;
$search_obra_social = isset($_GET['obra_social_id']) ? intval($_GET['obra_social_id']) : 0;

try {
    // 1. Obtener la lista base de médicos (filtrada)
    $q_medicos = "
        SELECT u.id, u.nombre, u.apellido, u.foto_perfil, u.direccion, u.dias_antelacion_agenda, u.dia_apertura_agenda 
        FROM usuarios u
        WHERE u.rol = 'medico'
    ";
    
    $params = [];
    
    if ($search_nombre !== '') {
        $q_medicos .= " AND (u.nombre LIKE :nombre OR u.apellido LIKE :nombre) ";
        $params[':nombre'] = '%' . $search_nombre . '%';
    }
    
    if ($search_especialidad > 0) {
        $q_medicos .= " AND u.id IN (SELECT usuario_id FROM medicos_especialidades WHERE especialidad_id = :esp_id) ";
        $params[':esp_id'] = $search_especialidad;
    }
    
    if ($search_obra_social > 0) {
        $q_medicos .= " AND u.id IN (SELECT usuario_id FROM medicos_obras_sociales WHERE obra_social_id = :os_id) ";
        $params[':os_id'] = $search_obra_social;
    }
    
    $search_medico = isset($_GET['medico_id']) ? intval($_GET['medico_id']) : 0;
    if ($search_medico > 0) {
        $q_medicos .= " AND u.id = :medico_id ";
        $params[':medico_id'] = $search_medico;
    }

    $q_medicos .= " ORDER BY u.apellido ASC, u.nombre ASC";

    $stmt = $db->prepare($q_medicos);
    foreach($params as $key => &$val) {
        $stmt->bindParam($key, $val);
    }
    $stmt->execute();
    $medicos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Si no hay médicos, salir rápido
    if (count($medicos) === 0) {
        echo json_encode([]);
        exit();
    }

    $medicos_ids = array_column($medicos, 'id');
    $ids_placeholder = implode(',', array_fill(0, count($medicos_ids), '?'));

    // 2. Obtener especialidades de los médicos filtrados
    $q_esp = "
        SELECT me.usuario_id, e.id as especialidad_id, e.nombre 
        FROM medicos_especialidades me
        JOIN especialidades e ON me.especialidad_id = e.id
        WHERE me.usuario_id IN ($ids_placeholder)
    ";
    $stmt_esp = $db->prepare($q_esp);
    $stmt_esp->execute($medicos_ids);
    $especialidades_raw = $stmt_esp->fetchAll(PDO::FETCH_ASSOC);

    // 3. Obtener obras sociales de los médicos filtrados
    $q_os = "
        SELECT mos.usuario_id, os.id as obra_social_id, os.nombre 
        FROM medicos_obras_sociales mos
        JOIN obras_sociales os ON mos.obra_social_id = os.id
        WHERE mos.usuario_id IN ($ids_placeholder)
    ";
    $stmt_os = $db->prepare($q_os);
    $stmt_os->execute($medicos_ids);
    $obras_sociales_raw = $stmt_os->fetchAll(PDO::FETCH_ASSOC);

    // 4. Obtener horarios de los médicos filtrados con su sede
    $q_horarios = "
        SELECT h.medico_id, h.dia_semana, h.hora_inicio, h.hora_fin, h.duracion_turno_minutos,
               h.unidad_id, ua.nombre as unidad_nombre, ua.calle as unidad_calle, ua.numero as unidad_numero, ua.localidad as unidad_localidad,
               ua.latitud as unidad_latitud, ua.longitud as unidad_longitud
        FROM horarios_medicos h
        LEFT JOIN unidades_atencion ua ON h.unidad_id = ua.id
        WHERE h.medico_id IN ($ids_placeholder)
        ORDER BY FIELD(h.dia_semana, 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'), h.hora_inicio ASC
    ";
    $stmt_horarios = $db->prepare($q_horarios);
    $stmt_horarios->execute($medicos_ids);
    $horarios_raw = $stmt_horarios->fetchAll(PDO::FETCH_ASSOC);

    // 5. Ensamblar los datos y sanitizar nombres/apellidos
    $resultado = [];

    foreach ($medicos as $medico) {
        $id = $medico['id'];
        
        // Sanitizar apellido y nombre (remover direcciones entre paréntesis)
        if (strpos($medico['apellido'], '(') !== false) {
            $medico['apellido'] = trim(preg_replace('/\s*\(.*?\)/u', '', $medico['apellido']));
            $medico['apellido'] = trim(preg_replace('/\s*–\s*\d+.*$/u', '', $medico['apellido']));
        }
        if (strpos($medico['nombre'], '(') !== false) {
            $medico['nombre'] = trim(preg_replace('/\s*\(.*?\)/u', '', $medico['nombre']));
        }
        
        $medico['especialidades'] = array_values(array_filter($especialidades_raw, function($e) use ($id) {
            return $e['usuario_id'] == $id;
        }));
        
        $medico['obras_sociales'] = array_values(array_filter($obras_sociales_raw, function($o) use ($id) {
            return $o['usuario_id'] == $id;
        }));
        
        $medico['horarios'] = array_values(array_filter($horarios_raw, function($h) use ($id) {
            return $h['medico_id'] == $id;
        }));

        $medico['foto_url'] = $medico['foto_perfil'] ?? null;

        $resultado[] = $medico;
    }

    echo json_encode($resultado);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'No se pudo obtener la agenda.']);
}
?>
