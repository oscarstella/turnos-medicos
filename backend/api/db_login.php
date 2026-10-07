<?php
header('Content-Type: application/json; charset=UTF-8');
http_response_code(410);
echo json_encode(['status'=>'error','message'=>'El inicio de sesión local fue deshabilitado. Usá Firebase con email o DNI.']);
?>
