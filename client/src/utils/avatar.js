// Utilidad para obtener el avatar oficial (doctor o doctora) según el nombre y género
export function obtenerAvatarDefault(nombre, apellido) {
  const texto = `${nombre || ''} ${apellido || ''}`.trim().toLowerCase();

  if (/\bdra\.?\b|\bdoctora\b/.test(texto)) {
    return '/turnos/assets/img/avatar_doctora.jpg';
  }
  if (/\bdr\.?\b|\bdoctor\b/.test(texto)) {
    return '/turnos/assets/img/avatar_doctor.jpg';
  }

  const primerNombre = (nombre || '')
    .trim()
    .split(' ')[0]
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const nombresFemeninos = new Set([
    'maria', 'ana', 'laura', 'paula', 'sofia', 'florencia', 'julieta', 'camila',
    'valentina', 'carolina', 'mariana', 'andrea', 'claudia', 'patricia', 'natalia',
    'daniela', 'luciana', 'cecilia', 'silvina', 'romina', 'marcela', 'gabriela',
    'silvia', 'veronica', 'monica', 'beatriz', 'mercedes', 'rosario', 'victoria',
    'elena', 'ines', 'teresa', 'susana', 'marta', 'graciela', 'lucia', 'guadalupe',
    'estefania', 'belen', 'micaela', 'agustina', 'antonella', 'valeria', 'sabrina',
    'giovanna', 'marina', 'alejandra', 'lorena', 'eugenia', 'noelia', 'yanina'
  ]);

  if (nombresFemeninos.has(primerNombre)) {
    return '/turnos/assets/img/avatar_doctora.jpg';
  }

  const excepcionesMasculinas = new Set(['luca', 'lucas', 'borja', 'bautista', 'sasha']);
  if (primerNombre.endsWith('a') && !excepcionesMasculinas.has(primerNombre)) {
    return '/turnos/assets/img/avatar_doctora.jpg';
  }

  return '/turnos/assets/img/avatar_doctor.jpg';
}
