<?php
require_once __DIR__ . '/_auth.php';
header("Content-Type: text/html; charset=UTF-8");

include_once '../config/database.php';

// Verificar permisos básicos (solo para seguridad)
if (!isset($_SESSION['user_id']) || !in_array($_SESSION['rol'], ['superadmin', 'admin'])) {
    echo "<h1>Error: Acceso denegado.</h1><p>Debes iniciar sesión como administrador en el dashboard primero.</p>";
    exit();
}

echo "<h1>Migración de Obras Sociales y Planes</h1>";

$database = new Database();
$db = $database->getConnection();

// Prefijos comunes para extraer la Obra Social
$prefixes = [
    'Swiss Medical Group - Docthos',
    'Swiss Medical Group',
    'Swiss Medical',
    'Accord salud',
    'Aca Salud',
    'OSDE',
    'Galeno',
    'Medicus',
    'Omint',
    'Sancor Salud',
    'Prevencion Salud',
    'A.M.B.A.R. (Asociación Mutual Bancarios Roca)',
    'Activa Salud',
    'Alianza Medica',
    'Bristol Medicine',
    'IOMA',
    'PAMI'
];

try {
    $db->beginTransaction();

    // 1. Obtener todas las obras sociales actuales
    $query = "SELECT id, nombre FROM obras_sociales";
    $stmt = $db->prepare($query);
    $stmt->execute();
    $registros = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $procesados = 0;
    
    echo "<ul>";
    
    foreach ($registros as $row) {
        $nombre_original = trim($row['nombre']);
        $os_nombre = '';
        $plan_nombre = '';
        $matched = false;

        // Intentar separar por prefijo conocido
        foreach ($prefixes as $prefix) {
            if (stripos($nombre_original, $prefix) === 0) {
                $os_nombre = $prefix;
                $plan_nombre = trim(substr($nombre_original, strlen($prefix)));
                if ($plan_nombre === '') $plan_nombre = 'Plan Único';
                $matched = true;
                break;
            }
        }

        // Si no hubo coincidencia con prefijos, buscar la palabra "Plan" o "Planes"
        if (!$matched) {
            if (stripos($nombre_original, ' Plan ') !== false) {
                $parts = preg_split('/(?= Plan )/i', $nombre_original, 2);
                $os_nombre = trim($parts[0]);
                $plan_nombre = trim($parts[1]);
            } else {
                // Si no se puede separar, asumimos que es solo la Obra Social
                $os_nombre = $nombre_original;
                $plan_nombre = 'Plan Único';
            }
        }

        // 2. Insertar o recuperar la Obra Social limpia
        $q_os = "SELECT id FROM obras_sociales WHERE nombre = :nombre LIMIT 1";
        $stmt_os = $db->prepare($q_os);
        $stmt_os->bindParam(':nombre', $os_nombre);
        $stmt_os->execute();
        
        $os_id = null;
        if ($stmt_os->rowCount() > 0) {
            $os_id = $stmt_os->fetch(PDO::FETCH_ASSOC)['id'];
        } else {
            // Crear nueva OS limpia
            $q_insert_os = "INSERT INTO obras_sociales (nombre) VALUES (:nombre)";
            $stmt_insert_os = $db->prepare($q_insert_os);
            $stmt_insert_os->bindParam(':nombre', $os_nombre);
            $stmt_insert_os->execute();
            $os_id = $db->lastInsertId();
            echo "<li>Nueva Obra Social separada: <strong>$os_nombre</strong></li>";
        }

        // 3. Insertar el Plan asociado a esta Obra Social limpia
        $q_plan = "SELECT id FROM planes_obras_sociales WHERE obra_social_id = :os_id AND nombre = :plan_nombre";
        $stmt_plan = $db->prepare($q_plan);
        $stmt_plan->bindParam(':os_id', $os_id);
        $stmt_plan->bindParam(':plan_nombre', $plan_nombre);
        $stmt_plan->execute();
        
        if ($stmt_plan->rowCount() == 0) {
            $q_insert_plan = "INSERT INTO planes_obras_sociales (obra_social_id, nombre) VALUES (:os_id, :plan_nombre)";
            $stmt_insert_plan = $db->prepare($q_insert_plan);
            $stmt_insert_plan->bindParam(':os_id', $os_id);
            $stmt_insert_plan->bindParam(':plan_nombre', $plan_nombre);
            $stmt_insert_plan->execute();
            echo "<li>Nuevo Plan extraído: <em>$plan_nombre</em> (Para OS: $os_nombre)</li>";
        }

        // 4. Actualizar turnos y eliminar el registro original si hubo separación
        if ($nombre_original !== $os_nombre && $row['id'] != $os_id) {
            // Obtener ID del plan (existente o recién creado)
            $stmt_plan->execute();
            $plan_id = $stmt_plan->fetch(PDO::FETCH_ASSOC)['id'];
            
            // Actualizar referencias en turnos
            $q_update_turnos = "UPDATE turnos SET obra_social_id = :nuevo_os_id, plan_id = :nuevo_plan_id WHERE obra_social_id = :viejo_os_id";
            $stmt_upd = $db->prepare($q_update_turnos);
            $stmt_upd->bindParam(':nuevo_os_id', $os_id);
            $stmt_upd->bindParam(':nuevo_plan_id', $plan_id);
            $stmt_upd->bindParam(':viejo_os_id', $row['id']);
            $stmt_upd->execute();

            // Borrar registro combinado original
            $q_delete_viejo = "DELETE FROM obras_sociales WHERE id = :viejo_id";
            $stmt_del = $db->prepare($q_delete_viejo);
            $stmt_del->bindParam(':viejo_id', $row['id']);
            $stmt_del->execute();
        }
        
        $procesados++;
    }
    
    echo "</ul>";

    $db->commit();
    echo "<h3>Migración completada exitosamente. Registros analizados y procesados: $procesados</h3>";
    echo "<p><a href='../../dashboard.php'>Volver al Dashboard para verificar</a></p>";

} catch (Exception $e) {
    $db->rollBack();
    error_log('Falló la migración manual de coberturas.');
    echo "<h3>No se pudo completar la migración.</h3>";
}
?>
