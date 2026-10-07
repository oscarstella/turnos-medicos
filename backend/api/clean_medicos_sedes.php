<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/_auth.php';

function ejecutarLimpiezaMedicosSedes($db) {
    // 1. Asegurar tabla unidades_atencion
    $db->exec("CREATE TABLE IF NOT EXISTS unidades_atencion (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        calle VARCHAR(150) NULL,
        numero VARCHAR(20) NULL,
        localidad VARCHAR(100) NULL,
        activa TINYINT(1) DEFAULT 1,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    // Asegurar columna localidad si no existiera
    $cols = $db->query("SHOW COLUMNS FROM unidades_atencion LIKE 'localidad'")->fetchAll();
    if (empty($cols)) {
        $db->exec("ALTER TABLE unidades_atencion ADD COLUMN localidad VARCHAR(100) NULL AFTER numero");
    }

    // Asegurar columnas latitud y longitud
    $colsLat = $db->query("SHOW COLUMNS FROM unidades_atencion LIKE 'latitud'")->fetchAll();
    if (empty($colsLat)) {
        $db->exec("ALTER TABLE unidades_atencion ADD COLUMN latitud DECIMAL(10,8) NULL AFTER localidad");
    }
    $colsLng = $db->query("SHOW COLUMNS FROM unidades_atencion LIKE 'longitud'")->fetchAll();
    if (empty($colsLng)) {
        $db->exec("ALTER TABLE unidades_atencion ADD COLUMN longitud DECIMAL(11,8) NULL AFTER latitud");
    }

    // Asegurar columna unidad_id en horarios_medicos
    $colsH = $db->query("SHOW COLUMNS FROM horarios_medicos LIKE 'unidad_id'")->fetchAll();
    if (empty($colsH)) {
        $db->exec("ALTER TABLE horarios_medicos ADD COLUMN unidad_id INT NULL");
    }

    // 2. Insertar / Actualizar las sedes principales de San Carlos de Bariloche con coordenadas exactas
    $sedesIniciales = [
        [
            'nombre' => 'Pasaje Gutiérrez',
            'calle' => 'Pasaje Gutiérrez',
            'numero' => '980',
            'localidad' => 'San Carlos de Bariloche',
            'latitud' => -41.1415571,
            'longitud' => -71.3132086
        ],
        [
            'nombre' => 'Mitre 124 (4to Piso)',
            'calle' => 'Bartolomé Mitre',
            'numero' => '124',
            'localidad' => 'San Carlos de Bariloche',
            'latitud' => -41.1336564,
            'longitud' => -71.3078764
        ],
        [
            'nombre' => 'Mitre 124 (3er Piso)',
            'calle' => 'Bartolomé Mitre',
            'numero' => '124',
            'localidad' => 'San Carlos de Bariloche',
            'latitud' => -41.1336564,
            'longitud' => -71.3078764
        ],
        [
            'nombre' => 'Frey 111',
            'calle' => 'Frey',
            'numero' => '111',
            'localidad' => 'San Carlos de Bariloche',
            'latitud' => -41.1345200,
            'longitud' => -71.3055300
        ],
        [
            'nombre' => 'Km 1 (Av. Bustillo)',
            'calle' => 'Av. Exequiel Bustillo',
            'numero' => '1000',
            'localidad' => 'San Carlos de Bariloche',
            'latitud' => -41.1310000,
            'longitud' => -71.3250000
        ]
    ];

    $stmtCheckSede = $db->prepare("SELECT id FROM unidades_atencion WHERE nombre = :nombre OR (calle = :calle AND numero = :numero)");
    $stmtInsertSede = $db->prepare("INSERT INTO unidades_atencion (nombre, calle, numero, localidad, latitud, longitud) VALUES (:nombre, :calle, :numero, :localidad, :latitud, :longitud)");
    $stmtUpdateSede = $db->prepare("UPDATE unidades_atencion SET calle = :calle, numero = :numero, localidad = :localidad, latitud = :latitud, longitud = :longitud WHERE id = :id");

    $sedesMap = []; // 'pasaje gutierrez' => id, etc.

    foreach ($sedesIniciales as $si) {
        $stmtCheckSede->execute([':nombre' => $si['nombre'], ':calle' => $si['calle'], ':numero' => $si['numero']]);
        $row = $stmtCheckSede->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $stmtUpdateSede->execute([
                ':calle' => $si['calle'],
                ':numero' => $si['numero'],
                ':localidad' => $si['localidad'],
                ':latitud' => $si['latitud'],
                ':longitud' => $si['longitud'],
                ':id' => $row['id']
            ]);
            $sedesMap[mb_strtolower($si['nombre'], 'UTF-8')] = $row['id'];
        } else {
            $stmtInsertSede->execute([
                ':nombre' => $si['nombre'],
                ':calle' => $si['calle'],
                ':numero' => $si['numero'],
                ':localidad' => $si['localidad'],
                ':latitud' => $si['latitud'],
                ':longitud' => $si['longitud']
            ]);
            $sedesMap[mb_strtolower($si['nombre'], 'UTF-8')] = $db->lastInsertId();
        }
    }

    // 3. Limpiar los apellidos de los médicos en la tabla usuarios
    $stmtMedicos = $db->query("SELECT id, nombre, apellido, direccion FROM usuarios WHERE rol = 'medico'");
    $medicos = $stmtMedicos->fetchAll(PDO::FETCH_ASSOC);

    $stmtUpdMedico = $db->prepare("UPDATE usuarios SET apellido = :apellido, direccion = :direccion WHERE id = :id");
    $stmtUpdHorarioUnidad = $db->prepare("UPDATE horarios_medicos SET unidad_id = :unidad_id WHERE medico_id = :medico_id AND (unidad_id IS NULL OR unidad_id = 0)");

    $modificados = 0;

    foreach ($medicos as $m) {
        $apellidoOriginal = $m['apellido'];
        $direccionActual = $m['direccion'];
        $sedeIdAsignable = null;

        // Detectar si el apellido contiene dirección entre paréntesis
        if (preg_match('/\((.*?)\)/u', $apellidoOriginal, $matches)) {
            $sedeExtraida = trim($matches[1]);
            
            // Limpiar apellido removiendo cualquier texto entre paréntesis
            $apellidoLimpio = trim(preg_replace('/\s*\(.*?\)/u', '', $apellidoOriginal));
            $apellidoLimpio = trim(preg_replace('/\s*–\s*\d+.*$/u', '', $apellidoLimpio));

            // Si el médico no tenía dirección seteada, le asignamos la sede que figuraba
            $nuevaDireccion = (!empty($direccionActual) && $direccionActual !== '') ? $direccionActual : $sedeExtraida;

            $stmtUpdMedico->execute([
                ':apellido' => $apellidoLimpio,
                ':direccion' => $nuevaDireccion,
                ':id' => $m['id']
            ]);

            // Determinar qué unidad_id corresponde
            $sedeExtraidaLower = mb_strtolower($sedeExtraida, 'UTF-8');
            if (strpos($sedeExtraidaLower, 'gut') !== false) {
                $sedeIdAsignable = $sedesMap['pasaje gutiérrez'] ?? null;
            } elseif (strpos($sedeExtraidaLower, '4to') !== false || strpos($sedeExtraidaLower, '4 piso') !== false) {
                $sedeIdAsignable = $sedesMap['mitre 124 (4to piso)'] ?? null;
            } elseif (strpos($sedeExtraidaLower, '3er') !== false || strpos($sedeExtraidaLower, '3 piso') !== false) {
                $sedeIdAsignable = $sedesMap['mitre 124 (3er piso)'] ?? null;
            } elseif (strpos($sedeExtraidaLower, 'mitre') !== false) {
                $sedeIdAsignable = $sedesMap['mitre 124 (4to piso)'] ?? null;
            } elseif (strpos($sedeExtraidaLower, 'frey') !== false) {
                $sedeIdAsignable = $sedesMap['frey 111'] ?? null;
            } elseif (strpos($sedeExtraidaLower, 'km') !== false) {
                $sedeIdAsignable = $sedesMap['km 1 (av. bustillo)'] ?? null;
            }

            if ($sedeIdAsignable) {
                $stmtUpdHorarioUnidad->execute([
                    ':unidad_id' => $sedeIdAsignable,
                    ':medico_id' => $m['id']
                ]);
            }

            $modificados++;
        }
    }

    return $modificados;
}

// Si se ejecuta como endpoint directo vía HTTP:
if (isset($_SERVER['SCRIPT_FILENAME']) && realpath(__FILE__) === realpath($_SERVER['SCRIPT_FILENAME'])) {
    header('Content-Type: application/json; charset=utf-8');
    if (!isset($_SESSION['user_id']) || !in_array($_SESSION['rol'] ?? '', ['superadmin','admin'], true)) {
        http_response_code(403); echo json_encode(['status'=>'error','message'=>'Acceso denegado.']); exit;
    }
    try {
        $database = new Database();
        $db = $database->getConnection();
        if (!$db) throw new Exception("No se pudo conectar a la base de datos.");

        $modificados = ejecutarLimpiezaMedicosSedes($db);
        echo json_encode([
            'status' => 'success',
            'message' => "Limpieza completada con éxito. Se sanearon {$modificados} médicos.",
            'modificados' => $modificados
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        error_log('Falló la reparación manual de sedes.');
        echo json_encode(['status' => 'error', 'message' => 'No se pudo completar la reparación.']);
    }
}
