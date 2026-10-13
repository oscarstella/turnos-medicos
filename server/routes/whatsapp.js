const express = require('express');
const router = express.Router();
const pool = require('../db');
const {
  normalizeDni,
  getMedicoDetalle,
  getDisponibilidad,
  getPlanes,
  crearTurno,
  calcularProximasFechas,
  formatearFechaCorta,
  ServiceError
} = require('../services/turnosService');

// Memoria temporal de sesiones de conversación por número de WhatsApp
const userSessions = new Map();

/**
 * Obtiene una plantilla de mensaje desde la tabla bot_respuestas o usa el fallback
 */
async function getBotMessage(clave, fallback, variables = {}) {
  try {
    const [rows] = await pool.query(
      'SELECT mensaje FROM bot_respuestas WHERE clave = ? AND activo = 1 LIMIT 1',
      [clave]
    );
    let text = (rows.length > 0 && rows[0].mensaje) ? rows[0].mensaje : fallback;
    for (const [k, v] of Object.entries(variables)) {
      text = text.replaceAll(`{${k}}`, v || '');
    }
    return text;
  } catch (err) {
    console.warn('Error leyendo bot_respuestas para clave:', clave, err.message);
    let text = fallback;
    for (const [k, v] of Object.entries(variables)) {
      text = text.replaceAll(`{${k}}`, v || '');
    }
    return text;
  }
}

/**
 * Verifica si el texto del usuario coincide con algún disparador de FAQ personalizado
 */
async function checkCustomTrigger(userText) {
  try {
    const [rows] = await pool.query(
      'SELECT mensaje FROM bot_respuestas WHERE activo = 1 AND disparador IS NOT NULL AND disparador != ""'
    );
    const lower = userText.toLowerCase().trim();
    for (const r of rows) {
      const keywords = r.disparador.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      if (keywords.some(k => lower === k || lower.includes(k))) {
        return r.mensaje;
      }
    }
  } catch (err) {
    console.warn('Error en checkCustomTrigger:', err.message);
  }
  return null;
}

/**
 * Envía un mensaje de texto a través de WhatsApp Cloud API
 */
async function sendWhatsAppMessage(toPhone, messageText) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1354333314430195';
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!token) {
    console.error('❌ Falta WHATSAPP_ACCESS_TOKEN en las variables de entorno');
    return false;
  }

  // Manejo de números de Argentina (con o sin el prefijo móvil 9)
  let targetPhones = [toPhone];
  const digits = String(toPhone).replace(/\D/g, '');
  if (digits.startsWith('549') && digits.length === 13) {
    const withoutNine = '54' + digits.slice(3);
    targetPhones = [withoutNine, toPhone];
  } else if (digits.startsWith('54') && digits.length === 12) {
    const withNine = '549' + digits.slice(2);
    targetPhones = [digits, withNine];
  }

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  for (const phone of targetPhones) {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: {
        preview_url: false,
        body: messageText
      }
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        console.log(`✅ Mensaje enviado con éxito a ${phone} (ID: ${data?.messages?.[0]?.id})`);
        return true;
      }
      console.warn(`⚠️ Intento a ${phone} falló:`, JSON.stringify(data?.error?.message || data));
    } catch (err) {
      console.error('❌ Error de red en sendWhatsAppMessage:', err.message);
    }
  }

  return false;
}

/**
 * 1. Verificación del Webhook por parte de Meta (GET)
 */
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'oscarsoft_turnos_wa_token_2026';

  if (mode && token) {
    if (mode === 'subscribe' && token === expectedToken) {
      console.log('✅ Webhook de WhatsApp verificado exitosamente por Meta');
      return res.status(200).send(challenge);
    } else {
      console.warn('⚠️ Fallo de verificación de Webhook: token incorrecto');
      return res.sendStatus(403);
    }
  }
  return res.sendStatus(400);
});

/**
 * 2. Recepción de mensajes entrantes desde WhatsApp (POST)
 */
router.post('/webhook', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') {
      return;
    }

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value;
        if (!value || !value.messages || value.messages.length === 0) {
          continue;
        }

        const message = value.messages[0];
        const from = message.from;
        const messageType = message.type;

        let userText = '';
        if (messageType === 'text') {
          userText = (message.text?.body || '').trim();
        } else if (messageType === 'interactive') {
          userText = message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || '';
        }

        if (!userText) {
          continue;
        }

        console.log(`📩 [WHATSAPP ENTRANTE] De: ${from} | Texto: "${userText}"`);
        await handleIncomingUserMessage(from, userText);
      }
    }
  } catch (err) {
    console.error('❌ Error procesando webhook de WhatsApp:', err);
  }
});

/**
 * Flujo conversacional interactivo completo
 */
async function handleIncomingUserMessage(phone, text) {
  const cleanInput = text.trim();
  const lowerInput = cleanInput.toLowerCase();

  let session = userSessions.get(phone);
  if (!session) {
    session = { step: 'INIT' };
    userSessions.set(phone, session);
  }

  // Comandos globales de reinicio o vuelta al menú
  if (['menu', 'inicio', 'hola', 'buenas', 'reiniciar', 'volver'].includes(lowerInput)) {
    session.step = 'INIT';
    return await sendMainMenu(phone, session.paciente);
  }

  // Si está en el menú y escribe "cancelar" o "cancelar turno", o "anular", va a la opción de cancelar
  if (session.step === 'INIT' && (lowerInput.includes('cancelar') || lowerInput.includes('anular') || cleanInput === '5')) {
    return await iniciarFlujoCancelacion(phone, session);
  }

  // Si está a mitad de un paso y escribe "cancelar", cancela la operación actual y vuelve al menú
  if (session.step !== 'INIT' && (lowerInput === 'cancelar' || lowerInput === 'salir')) {
    session.step = 'INIT';
    return await sendWhatsAppMessage(phone, '❌ Operación cancelada.\n\nEscribí *menu* cuando desees volver a comenzar.');
  }

  // =========================================================================
  // 1. ESTADO INICIAL / MENÚ PRINCIPAL
  // =========================================================================
  if (session.step === 'INIT') {
    // Verificar si coincide con algún disparador de FAQ personalizado
    const customFaq = await checkCustomTrigger(cleanInput);
    if (customFaq) {
      return await sendWhatsAppMessage(phone, `${customFaq}\n\n_Escribí *menu* para volver al menú de opciones._`);
    }

    if (cleanInput === '1') {
      session.step = 'AWAIT_MEDICO_SEARCH';
      const prompt = await getBotMessage(
        'buscar_medico_prompt',
        '🔍 *Búsqueda de Turno por Médico*\n\nPor favor, escribí el *nombre o apellido* del profesional que estás buscando (ej: _Bocian_, _Carlos_):\n\n_O escribí *menu* para volver._'
      );
      return await sendWhatsAppMessage(phone, prompt);
    }

    if (cleanInput === '2') {
      try {
        const [espRows] = await pool.query('SELECT id, nombre FROM especialidades ORDER BY nombre ASC');
        if (espRows.length === 0) {
          return await sendWhatsAppMessage(phone, '⚠️ No hay especialidades registradas en este momento.\n\nEscribí *menu* para volver.');
        }

        session.step = 'AWAIT_ESPECIALIDAD_SELECTION';
        session.especialidades = espRows;

        let msg = `🩺 *Especialidades Médicas Disponibles:*\n\nRespondé con el *número* de la especialidad:\n\n`;
        espRows.forEach((esp, idx) => {
          msg += `*${idx + 1}* - ${esp.nombre}\n`;
        });
        msg += `\n_O escribí *menu* para volver al menú principal._`;

        return await sendWhatsAppMessage(phone, msg);
      } catch (e) {
        console.error(e);
        return await sendWhatsAppMessage(phone, 'Hubo un error consultando las especialidades. Escribí *menu* para reiniciar.');
      }
    }

    if (cleanInput === '3') {
      const msgSedes = await getBotMessage(
        'sedes_info',
`🏥 *Nuestras Sedes de Atención en Bariloche*

📍 *Sede Central:*
Pasaje Gutiérrez 980
⏰ _Lunes a Viernes: 08:00 a 20:00 hs_

📍 *Consultorios Mitre:*
Mitre 124
⏰ _Lunes a Viernes: 08:00 a 20:00 hs_

📍 *Centro Frey:*
Frey 111
⏰ _Lunes a Viernes: 08:00 a 20:00 hs_

🌐 Podés ver ubicaciones y mapas en:
https://oscarsoft.com.ar/turnos/

_Escribí *menu* para volver al menú de opciones._`
      );
      return await sendWhatsAppMessage(phone, msgSedes);
    }

    if (cleanInput === '4') {
      session.step = 'AWAIT_PACIENTE_DNI_CONSULTA';
      return await sendWhatsAppMessage(
        phone,
        `📋 *Consultar Mis Turnos Agendados*\n\nPor favor, escribí tu número de *DNI* (solo números, sin puntos):\n\n_O escribí *menu* para volver._`
      );
    }

    if (cleanInput === '5') {
      return await iniciarFlujoCancelacion(phone, session);
    }

    return await sendMainMenu(phone, session.paciente);
  }

  // =========================================================================
  // 2. BUSCAR MÉDICO POR NOMBRE
  // =========================================================================
  if (session.step === 'AWAIT_MEDICO_SEARCH') {
    try {
      const searchTerm = `%${cleanInput}%`;
      const [medicos] = await pool.query(
        `SELECT u.id, u.nombre, u.apellido, u.matricula, u.slug, u.acepta_particular, u.honorarios_particular, u.mostrar_honorarios,
                GROUP_CONCAT(DISTINCT e.nombre SEPARATOR ', ') as especialidades
         FROM usuarios u
         LEFT JOIN medicos_especialidades me ON u.id = me.usuario_id
         LEFT JOIN especialidades e ON me.especialidad_id = e.id
         WHERE u.rol = 'medico' AND (u.nombre LIKE ? OR u.apellido LIKE ?)
         GROUP BY u.id
         LIMIT 6`,
        [searchTerm, searchTerm]
      );

      if (medicos.length === 0) {
        return await sendWhatsAppMessage(
          phone,
          `❌ No encontramos profesionales con el término *"${cleanInput}"*.\n\nIntentá escribirlo de otra forma o escribí *menu* para volver al inicio:`
        );
      }

      session.medicosList = medicos;
      session.step = 'AWAIT_MEDICO_PICK';

      let resp = `👨‍⚕️ *Profesionales encontrados:*\n\n`;
      medicos.forEach((m, idx) => {
        resp += `*${idx + 1}* - *Dr. ${m.nombre} ${m.apellido}*\n`;
        if (m.especialidades) resp += `     Especialidad: ${m.especialidades}\n`;
        if (m.matricula) resp += `     Matrícula: ${m.matricula}\n`;
      });
      resp += `\n_Respondé con el *número* del profesional para agendar tu turno (o *menu* para cancelar):_`;

      return await sendWhatsAppMessage(phone, resp);
    } catch (e) {
      console.error(e);
      session.step = 'INIT';
      return await sendWhatsAppMessage(phone, 'Ocurrió un error en la búsqueda. Escribí *menu* para volver a empezar.');
    }
  }

  // =========================================================================
  // 3. SELECCIÓN DE ESPECIALIDAD
  // =========================================================================
  if (session.step === 'AWAIT_ESPECIALIDAD_SELECTION') {
    const idx = parseInt(cleanInput, 10) - 1;
    if (isNaN(idx) || !session.especialidades || !session.especialidades[idx]) {
      return await sendWhatsAppMessage(
        phone,
        '⚠️ Opción no válida. Por favor ingresá el número de la especialidad deseada o escribí *menu* para reiniciar:'
      );
    }

    const especialidadElegida = session.especialidades[idx];
    try {
      const [medicos] = await pool.query(
        `SELECT u.id, u.nombre, u.apellido, u.matricula, u.slug, u.acepta_particular, u.honorarios_particular, u.mostrar_honorarios,
                '${especialidadElegida.nombre}' as especialidades
         FROM usuarios u
         JOIN medicos_especialidades me ON u.id = me.usuario_id
         WHERE me.especialidad_id = ? AND u.rol = 'medico'`,
        [especialidadElegida.id]
      );

      if (medicos.length === 0) {
        session.step = 'INIT';
        return await sendWhatsAppMessage(
          phone,
          `ℹ️ No hay médicos disponibles actualmente para *${especialidadElegida.nombre}*.\n\nEscribí *menu* para consultar otra especialidad.`
        );
      }

      session.medicosList = medicos;
      session.step = 'AWAIT_MEDICO_PICK';

      let resp = `🩺 *Médicos en ${especialidadElegida.nombre}:*\n\n`;
      medicos.forEach((m, i) => {
        resp += `*${i + 1}* - *Dr. ${m.nombre} ${m.apellido}*\n`;
        if (m.matricula) resp += `     Matrícula: ${m.matricula}\n`;
      });
      resp += `\n_Respondé con el *número* del médico para continuar (o *menu* para volver):_`;

      return await sendWhatsAppMessage(phone, resp);
    } catch (e) {
      console.error(e);
      session.step = 'INIT';
      return await sendWhatsAppMessage(phone, 'Error al consultar médicos. Escribí *menu* para reiniciar.');
    }
  }

  // =========================================================================
  // 4. ELEGIR PROFESIONAL PARA RESERVA
  // =========================================================================
  if (session.step === 'AWAIT_MEDICO_PICK') {
    const idx = parseInt(cleanInput, 10) - 1;
    if (isNaN(idx) || !session.medicosList || !session.medicosList[idx]) {
      return await sendWhatsAppMessage(
        phone,
        '⚠️ Selección no válida. Por favor respondé con el número del médico o escribí *menu* para cancelar:'
      );
    }

    const chosenMed = session.medicosList[idx];
    const medicoDetalle = await getMedicoDetalle(chosenMed.id);
    if (!medicoDetalle) {
      session.step = 'INIT';
      return await sendWhatsAppMessage(phone, 'No se pudo cargar la información del médico. Escribí *menu* para reiniciar.');
    }

    session.medico = medicoDetalle;

    // Si el paciente ya fue identificado en esta sesión, vamos directo a fechas
    if (session.paciente) {
      return await iniciarSeleccionFecha(phone, session);
    }

    // Si aún no está identificado, le solicitamos el DNI
    session.step = 'AWAIT_BOOKING_DNI';
    const pedirDniMsg = await getBotMessage(
      'pedir_dni_paciente',
      `📋 *Identificación de Paciente*\n\nPara agendar tu turno con el *Dr. {medico_nombre}*, por favor ingresá tu número de *DNI* (solo números, sin puntos):`,
      { medico_nombre: `${medicoDetalle.nombre} ${medicoDetalle.apellido}` }
    );
    return await sendWhatsAppMessage(phone, pedirDniMsg);
  }

  // =========================================================================
  // 5. VALIDACIÓN DE REGISTRO POR DNI
  // =========================================================================
  if (session.step === 'AWAIT_BOOKING_DNI') {
    const cleanDni = normalizeDni(cleanInput);
    if (!cleanDni) {
      return await sendWhatsAppMessage(
        phone,
        '⚠️ Formato de DNI no válido. Por favor ingresá solo los números (entre 7 y 9 dígitos, ej: 35123456):'
      );
    }

    try {
      const [pacRows] = await pool.query(
        `SELECT id, nombre, apellido, dni, email, telefono, obra_social_id, plan_id, rol 
         FROM usuarios 
         WHERE dni = ? LIMIT 1`,
        [cleanDni]
      );

      // SI NO ESTÁ REGISTRADO -> NO AGENDAR Y ENVIAR LINK DE REGISTRO
      if (pacRows.length === 0) {
        session.step = 'INIT';
        const msgNoReg = await getBotMessage(
          'dni_no_registrado',
`❌ *DNI no registrado*

No encontramos ninguna cuenta registrada con el DNI *{dni}* en nuestro sistema.

Para poder agendar tu turno, primero debés registrarte en nuestra plataforma web:
🔗 https://oscarsoft.com.ar/turnos/login?registro=1

_Luego de completar tu registro, regresá a este chat y escribí *menu* o *hola* para continuar con tu reserva._`,
          { dni: cleanDni }
        );

        return await sendWhatsAppMessage(phone, msgNoReg);
      }

      // SI ESTÁ REGISTRADO -> IDENTIFICAR Y CONTINUAR
      session.paciente = pacRows[0];

      await sendWhatsAppMessage(
        phone,
        `✅ ¡Hola *${session.paciente.nombre} ${session.paciente.apellido}*!\nTe identificamos correctamente en el sistema.`
      );

      return await iniciarSeleccionFecha(phone, session);
    } catch (e) {
      console.error('Error verificando paciente por DNI:', e);
      session.step = 'INIT';
      return await sendWhatsAppMessage(phone, 'Ocurrió un error verificando tus datos. Escribí *menu* para reiniciar.');
    }
  }

  // =========================================================================
  // 6. SELECCIÓN DE FECHA
  // =========================================================================
  if (session.step === 'AWAIT_DATE_SELECTION') {
    const idx = parseInt(cleanInput, 10) - 1;
    if (isNaN(idx) || !session.fechas || !session.fechas[idx]) {
      return await sendWhatsAppMessage(
        phone,
        '⚠️ Opción de fecha no válida. Por favor respondé con el número de la fecha deseada o escribí *menu*:'
      );
    }

    const selectedFecha = session.fechas[idx];
    session.selectedFecha = selectedFecha;

    try {
      const disp = await getDisponibilidad(session.medico.id, selectedFecha.fecha);
      const slotsDisponibles = (disp.slots || []).filter(s => s.disponible);

      if (slotsDisponibles.length === 0) {
        return await sendWhatsAppMessage(
          phone,
          `⚠️ No quedan horarios disponibles para el *${selectedFecha.fechaTexto}* (${formatearFechaCorta(selectedFecha.fecha)}).\n\nPor favor, seleccioná otra de las fechas anteriores o escribí *menu* para volver.`
        );
      }

      session.slots = slotsDisponibles;
      session.step = 'AWAIT_SLOT_SELECTION';

      let msgSlots = `⏰ *Horarios disponibles para el ${selectedFecha.fechaTexto} (${formatearFechaCorta(selectedFecha.fecha)}):*\n\n`;
      slotsDisponibles.forEach((s, i) => {
        msgSlots += `*${i + 1}* - ${s.hora_inicio.substring(0, 5)} hs\n`;
      });

      const sedeTxt = slotsDisponibles[0].unidad_nombre 
        ? `\n📍 *Sede:* ${slotsDisponibles[0].unidad_nombre}${slotsDisponibles[0].direccion ? ` (${slotsDisponibles[0].direccion})` : ''}\n`
        : '';

      msgSlots += `${sedeTxt}\n_Respondé con el *número del horario* que preferís (o *menu* para cancelar):_`;

      return await sendWhatsAppMessage(phone, msgSlots);
    } catch (e) {
      console.error(e);
      session.step = 'INIT';
      return await sendWhatsAppMessage(phone, 'Error consultando disponibilidad. Escribí *menu* para reiniciar.');
    }
  }

  // =========================================================================
  // 7. SELECCIÓN DE HORARIO (SLOT)
  // =========================================================================
  if (session.step === 'AWAIT_SLOT_SELECTION') {
    const idx = parseInt(cleanInput, 10) - 1;
    if (isNaN(idx) || !session.slots || !session.slots[idx]) {
      return await sendWhatsAppMessage(
        phone,
        '⚠️ Horario no válido. Por favor respondé con el número del horario deseado o escribí *menu*:'
      );
    }

    session.selectedSlot = session.slots[idx];
    return await iniciarSeleccionCobertura(phone, session);
  }

  // =========================================================================
  // 8. TIPO DE COBERTURA (PARTICULAR U OBRA SOCIAL)
  // =========================================================================
  if (session.step === 'AWAIT_COVERAGE_SELECTION') {
    if (cleanInput === '1') {
      session.cobertura = {
        tipo: 'particular',
        obra_social_id: null,
        plan_id: null,
        nombre: 'Particular'
      };
      return await solicitarMotivoConsulta(phone, session);
    }

    if (cleanInput === '2' && session.pacienteObraNombre) {
      session.cobertura = {
        tipo: 'obra_social',
        obra_social_id: session.paciente.obra_social_id,
        plan_id: session.paciente.plan_id || null,
        nombre: session.pacienteObraNombre
      };

      if (session.paciente.plan_id) {
        return await solicitarMotivoConsulta(phone, session);
      } else {
        return await iniciarSeleccionPlan(phone, session, session.paciente.obra_social_id, session.pacienteObraNombre);
      }
    }

    if ((cleanInput === '2' && !session.pacienteObraNombre) || cleanInput === '3') {
      session.step = 'AWAIT_OS_SEARCH';
      return await sendWhatsAppMessage(
        phone,
        `🔎 *Búsqueda de Obra Social o Prepaga*\n\nPor favor, escribí el *nombre* de tu mutual o prepaga (ej: _OSDE_, _Swiss Medical_, _PAMI_, _IOMA_):\n\n_O escribí *particular* si preferís atención particular._`
      );
    }

    return await sendWhatsAppMessage(
      phone,
      '⚠️ Opción no válida. Por favor respondé con el número correspondiente a tu cobertura:'
    );
  }

  // =========================================================================
  // 9. BÚSQUEDA DE OBRA SOCIAL POR TEXTO
  // =========================================================================
  if (session.step === 'AWAIT_OS_SEARCH') {
    if (lowerInput === 'particular' || lowerInput === '1') {
      session.cobertura = { tipo: 'particular', obra_social_id: null, plan_id: null, nombre: 'Particular' };
      return await solicitarMotivoConsulta(phone, session);
    }

    try {
      const [obras] = await pool.query(
        'SELECT id, nombre FROM obras_sociales WHERE LOWER(nombre) LIKE ? ORDER BY nombre ASC LIMIT 8',
        [`%${cleanInput.toLowerCase()}%`]
      );

      if (obras.length === 0) {
        return await sendWhatsAppMessage(
          phone,
          `❌ No encontramos obras sociales con *"${cleanInput}"*.\n\nIntentá escribirlo de otra forma, o escribí *particular* para atención particular:`
        );
      }

      session.obrasList = obras;
      session.step = 'AWAIT_OS_PICK';

      let msgOS = `💳 *Obras Sociales encontradas:*\n\nRespondé con el número de tu obra social:\n\n`;
      obras.forEach((os, idx) => {
        msgOS += `*${idx + 1}* - ${os.nombre}\n`;
      });
      msgOS += `\n_O escribí *particular* para atención particular._`;

      return await sendWhatsAppMessage(phone, msgOS);
    } catch (e) {
      console.error(e);
      return await sendWhatsAppMessage(phone, 'Error buscando obras sociales. Escribí *menu* para reiniciar.');
    }
  }

  // =========================================================================
  // 10. ELEGIR OBRA SOCIAL DE LA LISTA
  // =========================================================================
  if (session.step === 'AWAIT_OS_PICK') {
    if (lowerInput === 'particular') {
      session.cobertura = { tipo: 'particular', obra_social_id: null, plan_id: null, nombre: 'Particular' };
      return await solicitarMotivoConsulta(phone, session);
    }

    const idx = parseInt(cleanInput, 10) - 1;
    if (isNaN(idx) || !session.obrasList || !session.obrasList[idx]) {
      return await sendWhatsAppMessage(
        phone,
        '⚠️ Selección no válida. Respondé con el número de la obra social o escribí *particular*:'
      );
    }

    const chosenOS = session.obrasList[idx];
    return await iniciarSeleccionPlan(phone, session, chosenOS.id, chosenOS.nombre);
  }

  // =========================================================================
  // 11. ELEGIR PLAN DE LA OBRA SOCIAL
  // =========================================================================
  if (session.step === 'AWAIT_PLAN_SELECTION') {
    const idx = parseInt(cleanInput, 10) - 1;
    if (isNaN(idx) || !session.planesList || !session.planesList[idx]) {
      return await sendWhatsAppMessage(
        phone,
        '⚠️ Plan no válido. Por favor respondé con el número del plan o escribí *menu* para cancelar:'
      );
    }

    const chosenPlan = session.planesList[idx];
    session.cobertura = {
      tipo: 'obra_social',
      obra_social_id: session.selectedOSId,
      plan_id: chosenPlan.id || null,
      nombre: `${session.selectedOSNombre} (${chosenPlan.nombre})`
    };

    return await solicitarMotivoConsulta(phone, session);
  }

  // =========================================================================
  // 12. MOTIVO DE CONSULTA / NOTAS
  // =========================================================================
  if (session.step === 'AWAIT_MOTIVO') {
    const esOmitido = ['0', 'no', 'ninguno', '-', 'omitir', 'ninguna'].includes(lowerInput);
    session.notas = esOmitido ? null : cleanInput;

    return await mostrarResumenConfirmacion(phone, session);
  }

  // =========================================================================
  // 13. CONFIRMACIÓN FINAL Y GUARDADO EN BBDD
  // =========================================================================
  if (session.step === 'AWAIT_FINAL_CONFIRMATION') {
    if (cleanInput === '1') {
      try {
        const isPart = session.cobertura.tipo === 'particular';

        const turnoData = {
          medico_id: session.medico.id,
          especialidad_id: session.medico.especialidades?.[0]?.id || null,
          obra_social_id: isPart ? null : session.cobertura.obra_social_id,
          plan_id: isPart ? null : session.cobertura.plan_id,
          unidad_id: session.selectedSlot.unidad_id || null,
          fecha: session.selectedFecha.fecha,
          hora_inicio: session.selectedSlot.hora_inicio,
          hora_fin: session.selectedSlot.hora_fin,
          notas: session.notas || (isPart ? 'Consulta Particular (WhatsApp)' : 'Consulta WhatsApp'),
          paciente: {
            nombre: session.paciente.nombre,
            apellido: session.paciente.apellido,
            dni: session.paciente.dni,
            email: session.paciente.email,
            telefono: session.paciente.telefono || phone,
            tiene_whatsapp: true
          }
        };

        const nuevoTurno = await crearTurno(turnoData, session.paciente.id);

        session.step = 'INIT';

        const fechaCorta = formatearFechaCorta(session.selectedFecha.fecha);
        const msgExito = await getBotMessage(
          'turno_confirmado_exito',
`🎉 *¡Turno confirmado con éxito!*

🔖 *Comprobante de Turno:* #{turno_id}
👨‍⚕️ *Profesional:* Dr. {medico_nombre}
🗓 *Fecha:* {fecha}
⏰ *Horario:* {hora} hs
📍 *Lugar:* {sede}
👤 *Paciente:* {paciente_nombre}
💳 *Cobertura:* {cobertura}

⚠️ *Información importante:*
Por favor presentate 10 minutos antes con tu DNI y carnet de cobertura.

Podés consultar tus turnos agendados en cualquier momento escribiendo *4*.

_¡Muchas gracias por confiar en OscarSoft Turnos!_`,
          {
            turno_id: nuevoTurno.id,
            medico_nombre: `${nuevoTurno.medico_nombre} ${nuevoTurno.medico_apellido}`,
            fecha: `${session.selectedFecha.fechaTexto} (${fechaCorta})`,
            hora: nuevoTurno.hora_inicio.substring(0, 5),
            sede: `${nuevoTurno.unidad_nombre || 'Consultorio'}${nuevoTurno.calle ? ` (${nuevoTurno.calle} ${nuevoTurno.numero || ''})` : ''}`,
            paciente_nombre: `${nuevoTurno.paciente_nombre} ${nuevoTurno.paciente_apellido}`,
            cobertura: session.cobertura.nombre
          }
        );

        return await sendWhatsAppMessage(phone, msgExito);
      } catch (err) {
        console.error('Error al agendar turno vía WhatsApp:', err);
        session.step = 'INIT';
        return await sendWhatsAppMessage(
          phone,
          `❌ No se pudo completar la reserva: ${err.message || 'Error inesperado'}.\n\nEscribí *menu* para volver a intentarlo.`
        );
      }
    }

    if (cleanInput === '2' || ['cancelar', 'no'].includes(lowerInput)) {
      session.step = 'INIT';
      return await sendWhatsAppMessage(
        phone,
        '❌ Reserva cancelada. Escribí *menu* cuando desees volver a comenzar.'
      );
    }

    return await sendWhatsAppMessage(
      phone,
      '⚠️ Por favor respondé *1* para confirmar el turno o *2* para cancelar:'
    );
  }

  // =========================================================================
  // 14. CONSULTAR TURNOS ACTIVOS (OPCIÓN 4 DEL MENÚ)
  // =========================================================================
  if (session.step === 'AWAIT_PACIENTE_DNI_CONSULTA') {
    const cleanDni = normalizeDni(cleanInput);
    if (!cleanDni) {
      return await sendWhatsAppMessage(
        phone,
        '⚠️ El DNI ingresado no es válido. Por favor ingresá un DNI numérico (ej: 32145678):'
      );
    }

    try {
      const [users] = await pool.query(
        'SELECT id, nombre, apellido, dni, email, telefono, obra_social_id, plan_id FROM usuarios WHERE dni = ? LIMIT 1',
        [cleanDni]
      );

      if (users.length === 0) {
        session.step = 'INIT';
        return await sendWhatsAppMessage(
          phone,
          `❌ *DNI no registrado*\n\nNo encontramos una cuenta con el DNI *${cleanDni}* en nuestro sistema.\n\nPara registrarte, ingresá en:\n🔗 https://oscarsoft.com.ar/turnos/login?registro=1\n\n_Escribí *menu* para volver al inicio._`
        );
      }

      session.paciente = users[0];

      const [turnos] = await pool.query(
        `SELECT t.id, t.fecha, t.hora_inicio, t.hora_fin, t.estado,
                m.nombre as medico_nombre, m.apellido as medico_apellido,
                ua.nombre as sede_nombre, ua.calle, ua.numero
         FROM turnos t
         JOIN usuarios m ON t.medico_id = m.id
         LEFT JOIN unidades_atencion ua ON t.unidad_id = ua.id
         WHERE t.paciente_id = ? AND t.fecha >= CURDATE() AND t.estado NOT IN ('cancelado')
         ORDER BY t.fecha ASC, t.hora_inicio ASC
         LIMIT 5`,
        [session.paciente.id]
      );

      session.step = 'INIT';

      if (turnos.length === 0) {
        return await sendWhatsAppMessage(
          phone,
          `ℹ️ Hola *${session.paciente.nombre}*. No registramos turnos próximos activos para tu DNI *${cleanDni}*.\n\nPodés agendar uno nuevo escribiendo *1* o ingresando en:\nhttps://oscarsoft.com.ar/turnos/\n\n_Escribí *menu* para volver._`
        );
      }

      let resp = `📅 *Tus próximos turnos agendados (${session.paciente.nombre} ${session.paciente.apellido}):*\n\n`;
      turnos.forEach((t, i) => {
        const fechaArg = formatearFechaCorta(t.fecha);
        resp += `${i + 1}️⃣ 🗓 *${fechaArg}* a las *${t.hora_inicio.substring(0, 5)} hs*\n`;
        resp += `    👨‍⚕️ Dr. ${t.medico_nombre} ${t.medico_apellido}\n`;
        if (t.sede_nombre) resp += `    📍 ${t.sede_nombre}${t.calle ? ` (${t.calle} ${t.numero || ''})` : ''}\n`;
        resp += `    📌 Estado: *${t.estado.toUpperCase()}*\n\n`;
      });

      resp += `_Para cancelar alguno de tus turnos, respondé con *5* o escribí *cancelar*._\n\n_Escribí *menu* para volver al inicio._`;
      return await sendWhatsAppMessage(phone, resp);
    } catch (e) {
      console.error(e);
      session.step = 'INIT';
      return await sendWhatsAppMessage(phone, 'Error al consultar turnos. Escribí *menu* para volver.');
    }
  }

  // =========================================================================
  // 15. CANCELAR TURNOS (OPCIÓN 5 DEL MENÚ O COMANDO CANCELAR)
  // =========================================================================
  if (session.step === 'AWAIT_CANCEL_DNI') {
    const cleanDni = normalizeDni(cleanInput);
    if (!cleanDni) {
      return await sendWhatsAppMessage(
        phone,
        '⚠️ El DNI ingresado no es válido. Por favor ingresá un DNI numérico (ej: 32145678):'
      );
    }

    try {
      const [users] = await pool.query(
        'SELECT id, nombre, apellido, dni FROM usuarios WHERE dni = ? LIMIT 1',
        [cleanDni]
      );

      if (users.length === 0) {
        session.step = 'INIT';
        return await sendWhatsAppMessage(
          phone,
          `❌ *DNI no registrado*\n\nNo encontramos pacientes registrados con el DNI *${cleanDni}*.\n\nEscribí *menu* para volver.`
        );
      }

      session.paciente = users[0];
      return await buscarYConfirmarCancelacion(phone, session);
    } catch (e) {
      console.error(e);
      session.step = 'INIT';
      return await sendWhatsAppMessage(phone, 'Error buscando turnos para cancelar. Escribí *menu* para reiniciar.');
    }
  }

  if (session.step === 'AWAIT_CANCEL_SELECTION') {
    const idx = parseInt(cleanInput, 10) - 1;
    if (isNaN(idx) || !session.turnosParaCancelar || !session.turnosParaCancelar[idx]) {
      return await sendWhatsAppMessage(
        phone,
        '⚠️ Opción no válida. Por favor respondé con el número del turno que deseas cancelar o escribí *menu*:'
      );
    }

    session.turnoSeleccionadoCancelar = session.turnosParaCancelar[idx];
    return await preguntarConfirmacionCancelacion(phone, session);
  }

  if (session.step === 'AWAIT_CANCEL_CONFIRMATION') {
    if (cleanInput === '1') {
      try {
        const turno = session.turnoSeleccionadoCancelar;
        await pool.query('UPDATE turnos SET estado = "cancelado" WHERE id = ?', [turno.id]);

        session.step = 'INIT';
        const fechaArg = formatearFechaCorta(turno.fecha);
        const msgCancelExito = await getBotMessage(
          'turno_cancelado_exito',
`✅ *¡Turno cancelado exitosamente!*

Tu turno #{turno_id} con el Dr. {medico_nombre} para el día {fecha} a las {hora} hs ha sido cancelado.

El horario ha quedado liberado en el sistema. Escribí *menu* para volver al inicio.`,
          {
            turno_id: turno.id,
            medico_nombre: `${turno.medico_nombre} ${turno.medico_apellido}`,
            fecha: fechaArg,
            hora: turno.hora_inicio.substring(0, 5)
          }
        );

        return await sendWhatsAppMessage(phone, msgCancelExito);
      } catch (err) {
        console.error('Error al cancelar turno:', err);
        session.step = 'INIT';
        return await sendWhatsAppMessage(phone, 'Error al procesar la cancelación. Escribí *menu* para volver a intentarlo.');
      }
    }

    if (cleanInput === '2' || ['no', 'conservar', 'volver'].includes(lowerInput)) {
      session.step = 'INIT';
      return await sendWhatsAppMessage(
        phone,
        '👍 Operación cancelada. Tu turno sigue activo y confirmado.\n\nEscribí *menu* cuando desees realizar otra consulta.'
      );
    }

    return await sendWhatsAppMessage(
      phone,
      '⚠️ Por favor respondé *1* para confirmar la cancelación o *2* para conservar tu turno:'
    );
  }

  // Fallback si no coincide ningún estado
  session.step = 'INIT';
  return await sendMainMenu(phone, session.paciente);
}

/**
 * Inicia el flujo de cancelación de turno
 */
async function iniciarFlujoCancelacion(phone, session) {
  if (session.paciente) {
    return await buscarYConfirmarCancelacion(phone, session);
  }

  session.step = 'AWAIT_CANCEL_DNI';
  return await sendWhatsAppMessage(
    phone,
    `❌ *Cancelar Turno Agendado*\n\nPor favor, ingresá tu número de *DNI* para buscar tus turnos pendientes (solo números, sin puntos):\n\n_O escribí *menu* para volver._`
  );
}

/**
 * Busca los turnos activos del paciente para cancelación
 */
async function buscarYConfirmarCancelacion(phone, session) {
  try {
    const [turnos] = await pool.query(
      `SELECT t.id, t.fecha, t.hora_inicio, t.hora_fin, t.estado,
              m.nombre as medico_nombre, m.apellido as medico_apellido,
              ua.nombre as sede_nombre, e.nombre as especialidad_nombre
       FROM turnos t
       JOIN usuarios m ON t.medico_id = m.id
       LEFT JOIN unidades_atencion ua ON t.unidad_id = ua.id
       LEFT JOIN especialidades e ON t.especialidad_id = e.id
       WHERE t.paciente_id = ? AND t.fecha >= CURDATE() AND t.estado NOT IN ('cancelado')
       ORDER BY t.fecha ASC, t.hora_inicio ASC`,
      [session.paciente.id]
    );

    if (turnos.length === 0) {
      session.step = 'INIT';
      return await sendWhatsAppMessage(
        phone,
        `ℹ️ Hola *${session.paciente.nombre}*. No registramos turnos activos pendientes de cancelación para tu DNI.\n\nEscribí *menu* para volver.`
      );
    }

    if (turnos.length === 1) {
      session.turnoSeleccionadoCancelar = turnos[0];
      return await preguntarConfirmacionCancelacion(phone, session);
    }

    // Si tiene más de un turno activo, le preguntamos cuál quiere cancelar
    session.turnosParaCancelar = turnos;
    session.step = 'AWAIT_CANCEL_SELECTION';

    let msgList = `📋 *Seleccioná cuál de tus turnos deseas cancelar:*\n\n`;
    turnos.forEach((t, i) => {
      const fechaArg = formatearFechaCorta(t.fecha);
      msgList += `*${i + 1}* - Dr. ${t.medico_nombre} ${t.medico_apellido} (🗓 ${fechaArg} a las ⏰ ${t.hora_inicio.substring(0, 5)} hs)\n`;
    });
    msgList += `\n_Respondé con el número del turno que deseas cancelar (o *menu* para volver):_`;

    return await sendWhatsAppMessage(phone, msgList);
  } catch (err) {
    console.error(err);
    session.step = 'INIT';
    return await sendWhatsAppMessage(phone, 'Error buscando turnos para cancelar. Escribí *menu* para reiniciar.');
  }
}

/**
 * Pregunta confirmación explícita para cancelar el turno
 */
async function preguntarConfirmacionCancelacion(phone, session) {
  session.step = 'AWAIT_CANCEL_CONFIRMATION';
  const t = session.turnoSeleccionadoCancelar;
  const fechaArg = formatearFechaCorta(t.fecha);

  const confirmMsg = await getBotMessage(
    'confirmar_cancelacion_prompt',
`⚠️ *¿Confirmás la cancelación de este turno?*

🔖 *Turno:* #{turno_id}
👨‍⚕️ *Profesional:* Dr. {medico_nombre}
🗓 *Fecha:* {fecha} ({hora} hs)
📍 *Sede:* {sede}

Respondé:
*1* - ✅ Sí, cancelar este turno
*2* - ❌ No, conservar mi turno`,
    {
      turno_id: t.id,
      medico_nombre: `${t.medico_nombre} ${t.medico_apellido}`,
      fecha: fechaArg,
      hora: t.hora_inicio.substring(0, 5),
      sede: t.sede_nombre || 'Consultorio'
    }
  );

  return await sendWhatsAppMessage(phone, confirmMsg);
}

/**
 * Inicia la selección de fechas disponibles para el médico
 */
async function iniciarSeleccionFecha(phone, session) {
  try {
    const fechas = await calcularProximasFechas(session.medico.id, 6);
    if (fechas.length === 0) {
      session.step = 'INIT';
      return await sendWhatsAppMessage(
        phone,
        `⚠️ El Dr. ${session.medico.nombre} ${session.medico.apellido} no tiene fechas habilitadas para turnos en este momento.\n\nEscribí *menu* para consultar otro profesional.`
      );
    }

    session.fechas = fechas;
    session.step = 'AWAIT_DATE_SELECTION';

    let msg = `📅 *Fechas disponibles para Dr. ${session.medico.nombre} ${session.medico.apellido}:*\n\nRespondé con el *número de la fecha* que prefieras:\n\n`;
    fechas.forEach((f, idx) => {
      msg += `*${idx + 1}* - ${f.fechaTexto} (${formatearFechaCorta(f.fecha)})\n`;
    });
    msg += `\n_O escribí *menu* para cancelar._`;

    return await sendWhatsAppMessage(phone, msg);
  } catch (err) {
    console.error(err);
    session.step = 'INIT';
    return await sendWhatsAppMessage(phone, 'Error obteniendo fechas de atención. Escribí *menu* para reiniciar.');
  }
}

/**
 * Pregunta el tipo de cobertura médica
 */
async function iniciarSeleccionCobertura(phone, session) {
  session.step = 'AWAIT_COVERAGE_SELECTION';

  const acceptsParticular = session.medico.acepta_particular !== 0;
  const honorariosMonto = (session.medico.mostrar_honorarios && session.medico.honorarios_particular)
    ? Number(session.medico.honorarios_particular)
    : null;
  const partText = honorariosMonto ? `Particular (Honorarios: $${honorariosMonto.toLocaleString('es-AR')})` : 'Particular';

  let pacienteObraNombre = null;
  if (session.paciente?.obra_social_id) {
    try {
      const [osRows] = await pool.query('SELECT nombre FROM obras_sociales WHERE id = ?', [session.paciente.obra_social_id]);
      if (osRows.length > 0) {
        pacienteObraNombre = osRows[0].nombre;
      }
    } catch (e) {
      console.warn(e);
    }
  }

  session.pacienteObraNombre = pacienteObraNombre;

  let msg = `💳 *Cobertura médica para la consulta:*\n\nRespondé con una opción:\n\n*1* - ${partText}\n`;
  if (pacienteObraNombre) {
    msg += `*2* - Mi obra social registrada: *${pacienteObraNombre}*\n`;
    msg += `*3* - Otra obra social o prepaga\n`;
  } else {
    msg += `*2* - Con Obra Social o Prepaga\n`;
  }
  msg += `\n_O escribí *menu* para cancelar._`;

  return await sendWhatsAppMessage(phone, msg);
}

/**
 * Inicia la selección de planes de la obra social
 */
async function iniciarSeleccionPlan(phone, session, osId, osNombre) {
  session.selectedOSId = osId;
  session.selectedOSNombre = osNombre;

  try {
    const planes = await getPlanes(osId);
    if (!planes || planes.length <= 1) {
      session.cobertura = {
        tipo: 'obra_social',
        obra_social_id: osId,
        plan_id: planes?.[0]?.id || null,
        nombre: `${osNombre}${planes?.[0]?.nombre ? ` (${planes[0].nombre})` : ''}`
      };
      return await solicitarMotivoConsulta(phone, session);
    }

    session.planesList = planes;
    session.step = 'AWAIT_PLAN_SELECTION';

    let msg = `📋 *Planes de Cobertura para ${osNombre}:*\n\nRespondé con el número de tu plan:\n\n`;
    planes.forEach((p, idx) => {
      msg += `*${idx + 1}* - ${p.nombre}\n`;
    });
    msg += `\n_O escribí *menu* para cancelar._`;

    return await sendWhatsAppMessage(phone, msg);
  } catch (err) {
    console.error(err);
    session.cobertura = { tipo: 'obra_social', obra_social_id: osId, plan_id: null, nombre: osNombre };
    return await solicitarMotivoConsulta(phone, session);
  }
}

/**
 * Solicita el motivo de la consulta médica (opcional)
 */
async function solicitarMotivoConsulta(phone, session) {
  session.step = 'AWAIT_MOTIVO';
  const prompt = await getBotMessage(
    'motivo_consulta_prompt',
    `📝 *Motivo de Consulta (Opcional)*\n\nPor favor, escribí brevemente el motivo de tu consulta médica, o respondé *0* (o *no*) para omitir:\n\n_O escribí *menu* para cancelar._`
  );
  return await sendWhatsAppMessage(phone, prompt);
}

/**
 * Muestra el resumen completo antes de agendar
 */
async function mostrarResumenConfirmacion(phone, session) {
  session.step = 'AWAIT_FINAL_CONFIRMATION';

  const med = session.medico;
  const pac = session.paciente;
  const fec = session.selectedFecha;
  const slot = session.selectedSlot;
  const cob = session.cobertura;
  const not = session.notas ? session.notas : 'Consulta general';
  const esp = med.especialidades?.[0]?.nombre || 'Medicina General';
  const sede = slot.unidad_nombre ? `${slot.unidad_nombre}${slot.direccion ? ` (${slot.direccion})` : ''}` : 'Sede Central';
  const fechaCorta = formatearFechaCorta(fec.fecha);

  const resumen = 
`🔍 *Resumen de tu Turno Médico:*

👨‍⚕️ *Profesional:* Dr. ${med.nombre} ${med.apellido}
🩺 *Especialidad:* ${esp}
🗓 *Fecha:* ${fec.fechaTexto} (${fechaCorta})
⏰ *Horario:* ${slot.hora_inicio.substring(0, 5)} hs
📍 *Lugar:* ${sede}
👤 *Paciente:* ${pac.nombre} ${pac.apellido} (DNI ${pac.dni})
💳 *Cobertura:* ${cob.nombre}
📝 *Motivo:* ${not}

¿Confirmás la reserva de este turno?
*1* - ✅ Sí, confirmar turno
*2* - ❌ No, cancelar y volver al inicio`;

  return await sendWhatsAppMessage(phone, resumen);
}

/**
 * Menú Principal de Bienvenida
 */
async function sendMainMenu(phone, paciente = null) {
  const saludo = paciente ? `\n👤 Paciente identificado: *${paciente.nombre} ${paciente.apellido}*\n` : '';
  const fallback = 
`🏥 *Bienvenido al Sistema de Turnos de OscarSoft* 🏥
_Gestión digital de turnos médicos en San Carlos de Bariloche_{saludo_paciente}
Por favor, seleccioná una opción respondiendo con el número:

1️⃣ *Buscar turno por médico* (ej: Bocian, Carlos)
2️⃣ *Buscar médico por especialidad* (ej: Cardiología, Pediatría)
3️⃣ *Ver sedes y horarios de atención*
4️⃣ *Consultar mis turnos agendados*
5️⃣ *Cancelar un turno agendado*

_Respondé con el número (1, 2, 3, 4 o 5) para continuar._`;

  const menu = await getBotMessage('menu_principal', fallback, { saludo_paciente: saludo });
  return await sendWhatsAppMessage(phone, menu);
}

module.exports = router;
