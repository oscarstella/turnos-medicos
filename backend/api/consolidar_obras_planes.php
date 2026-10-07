<?php
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=UTF-8');

if (!isset($_SESSION['user_id']) || !in_array($_SESSION['rol'] ?? '', ['superadmin','admin'], true)) {
    http_response_code(403); echo json_encode(['status'=>'error','message'=>'Acceso denegado.']); exit;
}

$database = new Database();
$db = $database->getConnection();

if (!$db) {
    echo json_encode(["status" => "error", "message" => "Sin conexion BD"]);
    exit;
}

try {
    $db->beginTransaction();

    // Prefijos principales que agrupan planes
    $gruposDef = [
        'Swiss Medical Group' => [
            'alias' => ['Swiss Medical Group', 'Swiss Medical', 'SMG'],
            'nombre_oficial' => 'Swiss Medical Group'
        ],
        'OSDE' => [
            'alias' => ['OSDE', 'O.S.D.E.', 'Osde'],
            'nombre_oficial' => 'OSDE'
        ],
        'Galeno' => [
            'alias' => ['Galeno'],
            'nombre_oficial' => 'Galeno'
        ],
        'Sancor Salud' => [
            'alias' => ['Sancor Salud', 'Sancor'],
            'nombre_oficial' => 'Sancor Salud'
        ],
        'Medifé' => [
            'alias' => ['Medifé', 'Medife'],
            'nombre_oficial' => 'Medifé'
        ],
        'OMINT' => [
            'alias' => ['OMINT', 'Omint'],
            'nombre_oficial' => 'OMINT'
        ]
    ];

    $totalConsolidados = 0;
    $planesCreados = 0;

    foreach ($gruposDef as $clave => $def) {
        $nombreOficial = $def['nombre_oficial'];
        
        // 1. Obtener o crear la Obra Social canónica principal
        $stmtPrincipal = $db->prepare("SELECT id FROM obras_sociales WHERE nombre = :nombre LIMIT 1");
        $stmtPrincipal->execute([':nombre' => $nombreOficial]);
        $principalId = $stmtPrincipal->fetchColumn();

        if (!$principalId) {
            // Buscar si existe alguna que empiece exactamente con ese nombre
            $stmtP2 = $db->prepare("SELECT id FROM obras_sociales WHERE nombre LIKE :nom ORDER BY LENGTH(nombre) ASC, id ASC LIMIT 1");
            $stmtP2->execute([':nom' => $nombreOficial . '%']);
            $principalId = $stmtP2->fetchColumn();

            if ($principalId) {
                // Renombrarla exactamente al nombre oficial limpio
                $updNom = $db->prepare("UPDATE obras_sociales SET nombre = :nom WHERE id = :id");
                $updNom->execute([':nom' => $nombreOficial, ':id' => $principalId]);
            } else {
                // Crear nueva
                $insOS = $db->prepare("INSERT INTO obras_sociales (nombre) VALUES (:nom)");
                $insOS->execute([':nom' => $nombreOficial]);
                $principalId = $db->lastInsertId();
            }
        }

        // 2. Buscar todas las demás filas de obras_sociales que sean variantes de este grupo
        $conds = [];
        $params = [':pid' => $principalId];
        foreach ($def['alias'] as $idx => $alias) {
            $paramKey = ':al_' . $idx;
            $conds[] = "nombre LIKE $paramKey";
            $params[$paramKey] = $alias . '%';
        }
        $sqlVariantes = "SELECT id, nombre FROM obras_sociales WHERE id != :pid AND (" . implode(' OR ', $conds) . ")";
        $stmtVariantes = $db->prepare($sqlVariantes);
        $stmtVariantes->execute($params);
        $variantes = $stmtVariantes->fetchAll(PDO::FETCH_ASSOC);

        foreach ($variantes as $v) {
            $vId = intval($v['id']);
            $vNom = trim($v['nombre']);

            // Extraer nombre del plan
            $planNom = $vNom;
            foreach ($def['alias'] as $al) {
                if (stripos($planNom, $al) === 0) {
                    $planNom = trim(substr($planNom, strlen($al)));
                    break;
                }
            }
            $planNom = trim(ltrim($planNom, '-/ '));
            if ($planNom === '' || strtolower($planNom) === strtolower($nombreOficial)) {
                $planNom = 'Plan General';
            }

            // Si empieza con "Plan ", dejarlo limpio
            if (stripos($planNom, 'Plan ') !== 0 && !is_numeric($planNom)) {
                $planNom = 'Plan ' . $planNom;
            } elseif (is_numeric($planNom)) {
                $planNom = 'Plan ' . $planNom;
            }

            // 3. Crear el plan en planes_obras_sociales bajo la OS principal si no existe
            $stmtChkPl = $db->prepare("SELECT id FROM planes_obras_sociales WHERE obra_social_id = :os_id AND nombre = :pnom LIMIT 1");
            $stmtChkPl->execute([':os_id' => $principalId, ':pnom' => $planNom]);
            $planId = $stmtChkPl->fetchColumn();

            if (!$planId) {
                $stmtInsPl = $db->prepare("INSERT INTO planes_obras_sociales (obra_social_id, nombre) VALUES (:os_id, :pnom)");
                $stmtInsPl->execute([':os_id' => $principalId, ':pnom' => $planNom]);
                $planId = $db->lastInsertId();
                $planesCreados++;
            }

            // 4. Mover cualquier plan existente que estuviera asociado a la variante $vId hacia $principalId
            $updPlanesViejos = $db->prepare("UPDATE planes_obras_sociales SET obra_social_id = :pid WHERE obra_social_id = :vid");
            $updPlanesViejos->execute([':pid' => $principalId, ':vid' => $vId]);

            // 5. Mover los turnos asociados a $vId hacia $principalId y asignarles el plan
            $updTurnos = $db->prepare("UPDATE turnos SET obra_social_id = :pid, plan_id = COALESCE(plan_id, :plid) WHERE obra_social_id = :vid");
            $updTurnos->execute([':pid' => $principalId, ':plid' => $planId, ':vid' => $vId]);

            // 6. Mover medicos_obras_sociales: si el médico tenía asignada la variante, asignarle la principal y el plan
            $stmtMed = $db->prepare("SELECT usuario_id FROM medicos_obras_sociales WHERE obra_social_id = :vid");
            $stmtMed->execute([':vid' => $vId]);
            $medicosConVariante = $stmtMed->fetchAll(PDO::FETCH_COLUMN);

            foreach ($medicosConVariante as $medUid) {
                // Asignar OS principal al médico
                $stmtInsMedOS = $db->prepare("INSERT IGNORE INTO medicos_obras_sociales (usuario_id, obra_social_id) VALUES (:uid, :pid)");
                $stmtInsMedOS->execute([':uid' => $medUid, ':pid' => $principalId]);

                // Asignar el plan al médico en medicos_planes si existe la tabla
                try {
                    $stmtInsMedPl = $db->prepare("INSERT IGNORE INTO medicos_planes (usuario_id, plan_id) VALUES (:uid, :plid)");
                    $stmtInsMedPl->execute([':uid' => $medUid, ':plid' => $planId]);
                } catch (Throwable $e) {}
            }

            // Borrar la asignación vieja en medicos_obras_sociales
            $stmtDelMOS = $db->prepare("DELETE FROM medicos_obras_sociales WHERE obra_social_id = :vid");
            $stmtDelMOS->execute([':vid' => $vId]);

            // 7. Borrar la fila duplicada de obras_sociales
            $stmtDelOS = $db->prepare("DELETE FROM obras_sociales WHERE id = :vid");
            $stmtDelOS->execute([':vid' => $vId]);

            $totalConsolidados++;
        }
    }

    // 8. Asegurar que los médicos tengan en medicos_obras_sociales las obras correspondientes a sus planes
    try {
        $db->exec("
            INSERT IGNORE INTO medicos_obras_sociales (usuario_id, obra_social_id)
            SELECT mp.usuario_id, p.obra_social_id
            FROM medicos_planes mp
            JOIN planes_obras_sociales p ON mp.plan_id = p.id
        ");
    } catch(Throwable $e) {}

    $db->commit();

    echo json_encode([
        "status" => "success",
        "variantes_consolidadas" => $totalConsolidados,
        "planes_creados" => $planesCreados,
        "message" => "Obras sociales y planes consolidados exitosamente."
    ]);
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    echo json_encode([
        "status" => "error",
        "message" => "No se pudo completar la consolidación."
    ]);
}
