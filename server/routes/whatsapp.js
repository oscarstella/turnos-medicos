const express = require('express');
const router = express.Router();
const pool = require('../db');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  normalizeDni,
  getMedicoDetalle,
  getDisponibilidad,
  getPlanes,
  crearTurno,
  calcularProximasFechas,
  formatearFechaCorta,
  formatearFechaTexto,
  formatearHora24,
  formatearTurnoCompleto,
  normalizarFechaYMD,
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
      'SELECT disparador, mensaje FROM bot_respuestas WHERE activo = 1 AND disparador IS NOT NULL AND disparador != ""'
    );
    const lower = (userText || '').toLowerCase().trim();
    for (const r of rows) {
      if (!r.disparador) continue;
      const dispStr = typeof r.disparador === 'string' ? r.disparador : String(r.disparador || '');
      const keywords = dispStr.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
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
 * Descarga y transcribe un mensaje de voz o audio de WhatsApp usando Whisper local
 */
async function procesarAudioWhatsApp(mediaId) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    console.error('❌ Falta WHATSAPP_ACCESS_TOKEN para descargar audio');
    return '';
  }

  try {
    // 1. Obtener URL de descarga desde Meta Graph API
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!metaRes.ok) {
      console.warn('⚠️ No se pudo obtener la URL del audio desde Meta:', await metaRes.text());
      return '';
    }
    const metaData = await metaRes.json();
    const downloadUrl = metaData.url;
    if (!downloadUrl) return '';

    // 2. Descargar el archivo binario del audio (.ogg)
    const audioRes = await fetch(downloadUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!audioRes.ok) {
      console.warn('⚠️ No se pudo descargar el binario del audio desde Meta');
      return '';
    }

    const arrayBuffer = await audioRes.arrayBuffer();
    const tempOgg = path.join('/tmp', `wa_voice_${Date.now()}_${Math.random().toString(36).substring(7)}.ogg`);
    fs.writeFileSync(tempOgg, Buffer.from(arrayBuffer));

    // 3. Ejecutar transcribe.sh con whisper.cpp
    const scriptPath = fs.existsSync('/opt/whisper.cpp/transcribe.sh') ? '/opt/whisper.cpp/transcribe.sh' : null;
    if (!scriptPath) {
      console.warn('⚠️ transcribe.sh no encontrado en /opt/whisper.cpp/transcribe.sh');
      try { fs.unlinkSync(tempOgg); } catch (e) {}
      return '';
    }

    const text = await new Promise((resolve) => {
      execFile('/bin/bash', [scriptPath, tempOgg], (err, stdout, stderr) => {
        try { fs.unlinkSync(tempOgg); } catch (e) {}
        if (err) {
          console.error('❌ Error ejecutando Whisper:', err.message);
          return resolve('');
        }
        resolve((stdout || '').trim());
      });
    });

    return text;
  } catch (err) {
    console.error('❌ Error en procesarAudioWhatsApp:', err.message);
    return '';
  }
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
 * Normaliza texto eliminando acentos, puntuación y homogeneizando fonemas comunes del español
 */
function normalizarFonetica(texto) {
  if (!texto) return '';
  let s = String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quita tildes y diéresis
    .replace(/[^a-z0-9]/g, '');      // Solo caracteres alfanuméricos

  // Reemplazos fonéticos del español
  s = s.replace(/v/g, 'b');
  s = s.replace(/ce|ci/g, 'se');
  s = s.replace(/z/g, 's');
  s = s.replace(/ge|gi/g, 'je');
  s = s.replace(/qu/g, 'k');
  s = s.replace(/c(?=[aou])/g, 'k');
  s = s.replace(/c(?=[^seiaou]|$)/g, 'k'); // c final o ante consonante (ej: Labencki -> labenki)
  s = s.replace(/ck/g, 'k');
  s = s.replace(/y(?=[aeiou])/g, 'y');
  s = s.replace(/y(?![aeiou])/g, 'i');
  s = s.replace(/ll/g, 'y');
  s = s.replace(/h/g, ''); // h muda
  // Reducir letras dobles repetidas (ej: bb -> b, ss -> s)
  s = s.replace(/(.)\1+/g, '$1');

  return s;
}

/**
 * Calcula la distancia de Levenshtein entre dos cadenas
 */
function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // eliminación
        dp[i][j - 1] + 1,      // inserción
        dp[i - 1][j - 1] + cost // sustitución
      );
    }
  }
  return dp[m][n];
}

/**
 * Calcula el porcentaje de similitud (0.0 a 1.0) entre dos cadenas usando Levenshtein + fonética + subsecuencias
 */
function calcularSimilitud(busqueda, objetivo) {
  if (!busqueda || !objetivo) return 0;
  const bRaw = busqueda.toLowerCase().trim();
  const oRaw = objetivo.toLowerCase().trim();

  // Coincidencia exacta o contenida directa
  if (bRaw === oRaw) return 1.0;
  if (oRaw.includes(bRaw) || bRaw.includes(oRaw)) {
    return 0.85 + (Math.min(bRaw.length, oRaw.length) / Math.max(bRaw.length, oRaw.length)) * 0.15;
  }

  const bFon = normalizarFonetica(busqueda);
  const oFon = normalizarFonetica(objetivo);

  if (bFon === oFon) return 0.95;
  if (oFon.includes(bFon) || bFon.includes(oFon)) {
    return 0.80 + (Math.min(bFon.length, oFon.length) / Math.max(bFon.length, oFon.length)) * 0.15;
  }

  // Levenshtein sobre cadenas fonéticas
  const maxLen = Math.max(bFon.length, oFon.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(bFon, oFon);
  const simFon = (maxLen - dist) / maxLen;

  // Levenshtein sobre cadenas limpias
  const maxRawLen = Math.max(bRaw.length, oRaw.length);
  const rawDist = levenshteinDistance(bRaw, oRaw);
  const simRaw = (maxRawLen - rawDist) / maxRawLen;

  return Math.max(simFon, simRaw);
}

/**
 * Evalúa la similitud de un médico contra el término de búsqueda ingresado
 */
function puntuarMedico(busqueda, medico) {
  const terminos = busqueda.toLowerCase().split(/\s+/).filter(Boolean);
  const nombre = medico.nombre || '';
  const apellido = medico.apellido || '';
  const nombreCompleto = `${nombre} ${apellido}`;
  const apellidoNombre = `${apellido} ${nombre}`;

  let mejorPuntaje = 0;
  mejorPuntaje = Math.max(mejorPuntaje, calcularSimilitud(busqueda, apellido));
  mejorPuntaje = Math.max(mejorPuntaje, calcularSimilitud(busqueda, nombre));
  mejorPuntaje = Math.max(mejorPuntaje, calcularSimilitud(busqueda, nombreCompleto));
  mejorPuntaje = Math.max(mejorPuntaje, calcularSimilitud(busqueda, apellidoNombre));

  // Si el usuario ingresó varias palabras (ej: "german olavenky")
  if (terminos.length > 1) {
    let suma = 0;
    for (const t of terminos) {
      const pNom = calcularSimilitud(t, nombre);
      const pApe = calcularSimilitud(t, apellido);
      suma += Math.max(pNom, pApe);
    }
    const prom = suma / terminos.length;
    mejorPuntaje = Math.max(mejorPuntaje, prom);
  }

  return mejorPuntaje;
}

/**
 * Notifica a los pacientes con turnos afectados por una suspensión médica
 * y configura la sesión de cada uno en AWAIT_RESCHEDULE_CHOICE para que puedan reprogramar.
 */
async function notificarSuspensionPacientes(afectados, motivo) {
  if (!afectados || afectados.length === 0) return;

  for (const t of afectados) {
    const rawTel = t.paciente_telefono;
    if (!rawTel) continue;

    const digits = String(rawTel).replace(/\D/g, '');
    if (digits.length < 8) continue;

    let cleanPhone = digits;
    if (cleanPhone.length === 10 && !cleanPhone.startsWith('54')) {
      cleanPhone = `549${cleanPhone}`;
    } else if (cleanPhone.startsWith('15') && cleanPhone.length === 10) {
      cleanPhone = `549294${cleanPhone.substring(2)}`;
    }

    // Configurar sesión conversacional para cuando el paciente responda
    userSessions.set(cleanPhone, {
      step: 'AWAIT_RESCHEDULE_CHOICE',
      turnoOriginalId: t.id,
      medico: { id: t.medico_id, nombre: t.medico_nombre, apellido: t.medico_apellido },
      paciente: {
        id: t.paciente_id,
        nombre: t.paciente_nombre,
        apellido: t.paciente_apellido,
        dni: t.paciente_dni,
        email: t.paciente_email,
        telefono: rawTel,
        obra_social_id: t.obra_social_id,
        plan_id: t.plan_id
      },
      especialidad_id: t.especialidad_id,
      obra_social_id: t.obra_social_id,
      plan_id: t.plan_id,
      unidad_id: t.unidad_id,
      motivoSuspension: motivo || 'Razones de fuerza mayor',
      fechaOriginal: t.fecha,
      horaOriginal: t.hora_inicio
    });

    const fechaCorta = formatearFechaCorta(t.fecha);
    const fechaTexto = formatearFechaTexto(t.fecha);
    const hora = formatearHora24(t.hora_inicio);

    const msg = await getBotMessage(
      'suspension_medico_aviso',
      `⚠️ *Aviso Importante de Atención Médica*\n\nHola *{paciente_nombre}*, te informamos que el *Dr. {medico_nombre}* no podrá atender el día *{fecha}* a las *{hora} hs* por: _{motivo}_.\n\nLamentamos las molestias ocasionadas. ¿Qué deseás hacer con tu turno?\n*1* - 🗓 Reprogramar mi turno para otra fecha disponible\n*2* - ❌ Dejar cancelado el turno definitivamente\n\n_Respondé con 1 o 2 para continuar._`,
      {
        paciente_nombre: `${t.paciente_nombre} ${t.paciente_apellido || ''}`.trim(),
        medico_nombre: `${t.medico_nombre} ${t.medico_apellido || ''}`.trim(),
        fecha: `${fechaTexto} (${fechaCorta})`,
        hora: hora,
        motivo: motivo || 'Fuerza mayor / Disposición del profesional'
      }
    );

    try {
      await sendWhatsAppMessage(cleanPhone, msg);
    } catch (err) {
      console.error(`Error enviando aviso de suspensión a ${cleanPhone}:`, err.message);
    }

    // Rate limiting: 800ms entre cada mensaje
    await new Promise(r => setTimeout(r, 800));
  }
}

/**
 * Muestra los horarios disponibles de una fecha en bloques de 5 para facilitar la navegación
 */
async function mostrarSlotsPaginados(phone, session, offset = 0) {
  const all = session.allSlots || [];
  const pageSize = 5;
  const currentSlots = all.slice(offset, offset + pageSize);
  session.currentSlots = currentSlots;
  session.slotOffset = offset;
  session.hasMoreSlots = offset + pageSize < all.length;
  session.step = 'AWAIT_SLOT_SELECTION';

  const selectedFecha = session.selectedFecha;
  let msgSlots = `⏰ *Horarios disponibles para el ${selectedFecha.fechaTexto} (${formatearFechaCorta(selectedFecha.fecha)}):*\n\n`;
  currentSlots.forEach((s, i) => {
    msgSlots += `*${i + 1}* - ${s.hora_inicio.substring(0, 5)} hs\n`;
  });

  const sedeTxt = currentSlots[0]?.unidad_nombre 
    ? `\n📍 *Sede:* ${currentSlots[0].unidad_nombre}${currentSlots[0].direccion ? ` (${currentSlots[0].direccion})` : ''}\n`
    : '';
  msgSlots += sedeTxt;

  if (session.hasMoreSlots) {
    msgSlots += `\n*6* - ⏩ Ver más horarios para este día`;
  }
  msgSlots += `\n*0* - ↩️ Cambiar de fecha\n\n_Respondé con el número del horario deseado (o *menu* para cancelar):_`;

  return await sendWhatsAppMessage(phone, msgSlots);
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
        } else if (messageType === 'audio' || messageType === 'voice') {
          const mediaId = message.audio?.id || message.voice?.id;
          if (mediaId) {
            console.log(`🎙️ [AUDIO ENTRANTE] De: ${from} | Procesando mensaje de voz ID: ${mediaId}...`);
            userText = await procesarAudioWhatsApp(mediaId);
            console.log(`📝 [AUDIO TRANSCRIPTO] Texto detectado: "${userText}"`);
          }
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
  let cleanInput = (text || '').trim();
  // Limpiar puntos o signos que a veces agrega la transcripción al final
  cleanInput = cleanInput.replace(/[.,;:!?]+$/, '').trim();
  let lowerInput = cleanInput.toLowerCase();

  // Mapeo automático de números hablados
  const wordsToNumbers = {
    'uno': '1', 'primero': '1', 'primera': '1',
    'dos': '2', 'segundo': '2', 'segunda': '2',
    'tres': '3', 'tercero': '3', 'tercera': '3',
    'cuatro': '4', 'cuarto': '4', 'cuarta': '4',
    'cinco': '5', 'quinto': '5', 'quinta': '5'
  };
  if (wordsToNumbers[lowerInput]) {
    cleanInput = wordsToNumbers[lowerInput];
    lowerInput = cleanInput;
  }

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
  // RESPUESTA A RECORDATORIO DE 48HS (1: Confirmar / 2: Cancelar)
  // =========================================================================
  if (session.step === 'AWAIT_REMINDER_CONFIRMATION') {
    if (cleanInput === '1') {
      try {
        await pool.query("UPDATE turnos SET estado = 'confirmado' WHERE id = ?", [session.turnoId]);
        session.step = 'INIT';
        const t = session.turno;
        const msgOk = await getBotMessage(
          'recordatorio_confirmado_exito',
          '✅ *¡Muchas gracias {paciente_nombre}!* Tu turno con el Dr. {medico_nombre} para el día *{fecha}* a las *{hora} hs* ha sido *confirmado exitosamente*.\n\n_¡Te esperamos! Podés escribir *menu* en cualquier momento para más opciones._',
          {
            paciente_nombre: session.paciente?.nombre || 'Paciente',
            medico_nombre: `${t?.medico_nombre || ''} ${t?.medico_apellido || ''}`.trim(),
            fecha: formatearFechaCorta(t?.fecha),
            hora: (t?.hora_inicio || '').substring(0, 5)
          }
        );
        return await sendWhatsAppMessage(phone, msgOk);
      } catch (err) {
        console.error('Error confirmando turno desde recordatorio:', err);
        session.step = 'INIT';
        return await sendWhatsAppMessage(phone, 'Ocurrió un error confirmando tu turno. Escribí *menu* para consultar tus turnos.');
      }
    }

    if (cleanInput === '2') {
      session.turnoSeleccionadoCancelar = session.turno;
      return await preguntarConfirmacionCancelacion(phone, session);
    }
  }

  // =========================================================================
  // RESPUESTA A RECORDATORIO DE 2HS (Aviso de retraso / demora del paciente)
  // =========================================================================
  if (session.step === 'AWAIT_2H_PATIENT_REPLY') {
    try {
      const avisoTexto = cleanInput.length > 250 ? cleanInput.substring(0, 250) : cleanInput;
      await pool.query("UPDATE turnos SET aviso_retraso = ? WHERE id = ?", [avisoTexto, session.turnoId]);
      session.step = 'INIT';
      const medicoNom = session.turno ? `${session.turno.medico_nombre || ''} ${session.turno.medico_apellido || ''}`.trim() : 'profesional';
      const respAviso = await getBotMessage(
        'aviso_retraso_recibido',
        '✅ *Aviso de demora recibido.*\n\nYa notificamos en la agenda del *Dr. {medico_nombre}* que te encontrás demorado con el siguiente mensaje:\n_\"{aviso}\"_\n\n_¡Muchas gracias por avisar!_',
        {
          medico_nombre: medicoNom,
          aviso: avisoTexto
        }
      );
      return await sendWhatsAppMessage(phone, respAviso);
    } catch (err) {
      console.error('Error guardando aviso de retraso del paciente:', err);
      session.step = 'INIT';
      return await sendWhatsAppMessage(phone, 'Recibido tu mensaje. Podés escribir *menu* para consultar opciones.');
    }
  }

  // =========================================================================
  // RESPUESTA A SUSPENSIÓN MÉDICA (1: Reprogramar / 2: Cancelar)
  // =========================================================================
  if (session.step === 'AWAIT_RESCHEDULE_CHOICE') {
    if (cleanInput === '1' || ['reprogramar', 'si', 'sí', 'cambiar'].includes(lowerInput)) {
      try {
        const medicoDetalle = await getMedicoDetalle(session.medico?.id);
        if (!medicoDetalle) {
          session.step = 'INIT';
          return await sendWhatsAppMessage(phone, 'No se pudo cargar la agenda del profesional. Escribí *menu* para reiniciar.');
        }
        session.medico = medicoDetalle;

        // Si el paciente no tiene todos sus datos cargados, completarlos desde DB
        if (session.paciente?.id && !session.paciente?.dni) {
          const [pRows] = await pool.query('SELECT * FROM usuarios WHERE id = ? LIMIT 1', [session.paciente.id]);
          if (pRows.length > 0) session.paciente = pRows[0];
        }

        await sendWhatsAppMessage(
          phone,
          `🗓 ¡Perfecto, *${session.paciente?.nombre || 'paciente'}*! Vamos a buscar una nueva fecha para reprogramar tu consulta con el *Dr. ${session.medico.nombre} ${session.medico.apellido}*:`
        );
        return await iniciarSeleccionFecha(phone, session, 0);
      } catch (err) {
        console.error('Error al iniciar reprogramación:', err);
        session.step = 'INIT';
        return await sendWhatsAppMessage(phone, 'Ocurrió un error. Escribí *menu* para reiniciar.');
      }
    }

    if (cleanInput === '2' || ['cancelar', 'no', 'dejar cancelado'].includes(lowerInput)) {
      session.step = 'INIT';
      const msgCancel = await getBotMessage(
        'suspension_cancelado_confirmado',
        '✅ Comprendido, tu turno ha quedado cancelado. Podés volver a escribirnos en cualquier momento cuando desees una nueva consulta. ¡Que tengas un excelente día!'
      );
      return await sendWhatsAppMessage(phone, msgCancel);
    }

    return await sendWhatsAppMessage(
      phone,
      '⚠️ Por favor respondé *1* para reprogramar tu turno para otra fecha disponible o *2* para dejarlo cancelado definitivamente:'
    );
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

      // Si no hay coincidencias exactas, activar Búsqueda Fonética y Difusa (Fuzzy Search)
      if (medicos.length === 0) {
        const [todosMedicos] = await pool.query(
          `SELECT u.id, u.nombre, u.apellido, u.matricula, u.slug, u.acepta_particular, u.honorarios_particular, u.mostrar_honorarios,
                  GROUP_CONCAT(DISTINCT e.nombre SEPARATOR ', ') as especialidades
           FROM usuarios u
           LEFT JOIN medicos_especialidades me ON u.id = me.usuario_id
           LEFT JOIN especialidades e ON me.especialidad_id = e.id
           WHERE u.rol = 'medico'
           GROUP BY u.id`
        );

        const puntuados = [];
        for (const m of todosMedicos) {
          const score = puntuarMedico(cleanInput, m);
          if (score >= 0.55) {
            puntuados.push({ ...m, score });
          }
        }

        puntuados.sort((a, b) => b.score - a.score);
        const sugeridos = puntuados.slice(0, 4);

        if (sugeridos.length > 0) {
          session.medicosList = sugeridos;
          session.step = 'AWAIT_MEDICO_PICK';

          let listaSugeridos = '';
          sugeridos.forEach((m, idx) => {
            listaSugeridos += `*${idx + 1}* - *Dr. ${m.nombre} ${m.apellido}*\n`;
            if (m.especialidades) listaSugeridos += `     Especialidad: ${m.especialidades}\n`;
            if (m.matricula) listaSugeridos += `     Matrícula: ${m.matricula}\n`;
          });

          const msgFuzzy = await getBotMessage(
            'sugerencia_medico_fuzzy',
            `🔎 No encontramos una coincidencia exacta para *"{busqueda}"*, pero encontramos estos profesionales:\n\n{lista_medicos}\n\n_Respondé con el *número* del profesional para agendar tu turno (o *menu* para volver):_`,
            { busqueda: cleanInput, lista_medicos: listaSugeridos.trim() }
          );

          return await sendWhatsAppMessage(phone, msgFuzzy);
        }

        const msgNoEnc = await getBotMessage(
          'medico_no_encontrado',
          `❌ No encontramos profesionales coincidentes con *"{busqueda}"*.\n\nIntentá escribir solo el apellido o parte del nombre, o escribí *menu* para volver al inicio:`,
          { busqueda: cleanInput }
        );
        return await sendWhatsAppMessage(phone, msgNoEnc);
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
  // 6. SELECCIÓN DE FECHA (CON PAGINACIÓN)
  // =========================================================================
  if (session.step === 'AWAIT_DATE_SELECTION') {
    // Opción 0 o volver
    if (cleanInput === '0' || lowerInput === 'volver') {
      session.step = 'INIT';
      return await sendMainMenu(phone, session.paciente);
    }

    // Opción 6 o "más" para avanzar en la paginación de agenda
    if (cleanInput === '6' || ['mas', 'más', 'ver mas', 'ver más', 'siguiente', 'posteriores'].includes(lowerInput)) {
      if (session.fechasHasMore) {
        return await iniciarSeleccionFecha(phone, session, (session.fechasOffset || 0) + 5);
      } else {
        const noMas = await getBotMessage(
          'no_mas_turnos_disponibles',
          'ℹ️ No hay más fechas disponibles dentro del período habilitado de agenda ({max_dias} días). Escribí el número de alguna de las fechas anteriores o *menu* para reiniciar.',
          { max_dias: session.medicoMaxDias || 30 }
        );
        return await sendWhatsAppMessage(phone, noMas);
      }
    }

    const idx = parseInt(cleanInput, 10) - 1;
    if (isNaN(idx) || !session.fechas || !session.fechas[idx]) {
      return await sendWhatsAppMessage(
        phone,
        '⚠️ Opción de fecha no válida. Respondé con el número de la fecha (1 a 5), *6* para ver más fechas o *0* para volver:'
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
          `⚠️ No quedan horarios disponibles para el *${selectedFecha.fechaTexto}* (${formatearFechaCorta(selectedFecha.fecha)}).\n\nPor favor, seleccioná otra de las fechas mostradas o escribí *6* para ver fechas posteriores:`
        );
      }

      session.allSlots = slotsDisponibles;
      return await mostrarSlotsPaginados(phone, session, 0);
    } catch (e) {
      console.error(e);
      session.step = 'INIT';
      return await sendWhatsAppMessage(phone, 'Error consultando disponibilidad. Escribí *menu* para reiniciar.');
    }
  }

  // =========================================================================
  // 7. SELECCIÓN DE HORARIO (SLOT CON PAGINACIÓN)
  // =========================================================================
  if (session.step === 'AWAIT_SLOT_SELECTION') {
    if (cleanInput === '0' || lowerInput === 'volver') {
      return await iniciarSeleccionFecha(phone, session, session.fechasOffset || 0);
    }

    if (cleanInput === '6' || ['mas', 'más', 'ver mas', 'ver más', 'horarios'].includes(lowerInput)) {
      if (session.hasMoreSlots) {
        return await mostrarSlotsPaginados(phone, session, (session.slotOffset || 0) + 5);
      }
    }

    const idx = parseInt(cleanInput, 10) - 1;
    if (isNaN(idx) || !session.currentSlots || !session.currentSlots[idx]) {
      return await sendWhatsAppMessage(
        phone,
        '⚠️ Horario no válido. Por favor respondé con el número del horario deseado, *6* para ver más horarios o *0* para cambiar de fecha:'
      );
    }

    session.selectedSlot = session.currentSlots[idx];
    return await iniciarSeleccionCobertura(phone, session);
  }

  // =========================================================================
  // 8. TIPO DE COBERTURA (PARTICULAR U OBRA SOCIAL DINÁMICA)
  // =========================================================================
  if (session.step === 'AWAIT_COVERAGE_SELECTION') {
    // CASO A: Paciente con obra social registrada por defecto
    if (session.pacienteObraNombre) {
      if (cleanInput === '1' || ['si', 'sí', 'continuar'].includes(lowerInput)) {
        session.cobertura = {
          tipo: 'obra_social',
          obra_social_id: session.paciente.obra_social_id,
          plan_id: session.paciente.plan_id || null,
          nombre: `${session.pacienteObraNombre}${session.pacientePlanNombre ? ` (${session.pacientePlanNombre})` : ''}`
        };

        if (session.paciente.plan_id) {
          return await solicitarMotivoConsulta(phone, session);
        } else {
          return await iniciarSeleccionPlan(phone, session, session.paciente.obra_social_id, session.pacienteObraNombre);
        }
      }

      if (cleanInput === '2' || ['cambiar', 'otra'].includes(lowerInput)) {
        session.step = 'AWAIT_OS_SEARCH';
        return await sendWhatsAppMessage(
          phone,
          `🔎 *Búsqueda de Nueva Obra Social o Prepaga*\n\nPor favor, escribí el *nombre* de tu nueva cobertura (ej: _OSDE_, _Swiss Medical_, _PAMI_, _IOMA_):\n\n_Tu elección quedará guardada como tu cobertura predeterminada._`
        );
      }

      if (cleanInput === '3' || ['particular', 'sin obra social'].includes(lowerInput)) {
        session.cobertura = {
          tipo: 'particular',
          obra_social_id: null,
          plan_id: null,
          nombre: 'Particular'
        };
        return await solicitarMotivoConsulta(phone, session);
      }

      return await sendWhatsAppMessage(
        phone,
        '⚠️ Opción no válida. Respondé *1* para continuar con tu cobertura registrada, *2* para cambiarla o *3* para Particular:'
      );
    }

    // CASO B: Paciente sin obra social registrada previamente
    if (cleanInput === '1') {
      session.step = 'AWAIT_OS_SEARCH';
      return await sendWhatsAppMessage(
        phone,
        `🔎 *Búsqueda de Obra Social o Prepaga*\n\nPor favor, escribí el *nombre* de tu mutual o prepaga (ej: _OSDE_, _Swiss Medical_, _PAMI_, _IOMA_):\n\n_Tu elección quedará guardada como tu cobertura predeterminada._`
      );
    }

    if (cleanInput === '2' || ['particular'].includes(lowerInput)) {
      session.cobertura = {
        tipo: 'particular',
        obra_social_id: null,
        plan_id: null,
        nombre: 'Particular'
      };
      return await solicitarMotivoConsulta(phone, session);
    }

    return await sendWhatsAppMessage(
      phone,
      '⚠️ Opción no válida. Por favor respondé *1* para Obra Social o *2* para Particular:'
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

    // Actualizar inmediatamente la cobertura predeterminada en el perfil del paciente
    if (session.paciente?.id) {
      try {
        await pool.query(
          'UPDATE usuarios SET obra_social_id = ?, plan_id = ? WHERE id = ?',
          [session.selectedOSId, chosenPlan.id || null, session.paciente.id]
        );
        session.paciente.obra_social_id = session.selectedOSId;
        session.paciente.plan_id = chosenPlan.id || null;
      } catch (err) {
        console.warn('Error actualizando obra social predeterminada en usuarios:', err.message);
      }
    }

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
        `SELECT t.id, DATE_FORMAT(t.fecha, '%Y-%m-%d') as fecha, t.hora_inicio, t.hora_fin, t.estado,
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
        const fechaHoraCompleta = formatearTurnoCompleto(t.fecha, t.hora_inicio);
        resp += `${i + 1}️⃣ 🗓 *${fechaHoraCompleta}*\n`;
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
        const fechaHoraCompleta = formatearTurnoCompleto(turno.fecha, turno.hora_inicio);
        const msgCancelExito = await getBotMessage(
          'turno_cancelado_exito',
`✅ *¡Turno cancelado exitosamente!*

Tu turno #{turno_id} con el Dr. {medico_nombre} para el {fecha} ha sido cancelado.

El horario ha quedado liberado en el sistema. Escribí *menu* para volver al inicio.`,
          {
            turno_id: turno.id,
            medico_nombre: `${turno.medico_nombre} ${turno.medico_apellido}`,
            fecha: fechaHoraCompleta,
            hora: formatearHora24(turno.hora_inicio)
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
      `SELECT t.id, DATE_FORMAT(t.fecha, '%Y-%m-%d') as fecha, t.hora_inicio, t.hora_fin, t.estado,
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
      const fechaHoraCompleta = formatearTurnoCompleto(t.fecha, t.hora_inicio);
      msgList += `*${i + 1}* - Dr. ${t.medico_nombre} ${t.medico_apellido} (🗓 *${fechaHoraCompleta}*)\n`;
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
  const fechaHoraCompleta = formatearTurnoCompleto(t.fecha, t.hora_inicio);

  const confirmMsg = await getBotMessage(
    'confirmar_cancelacion_prompt',
`⚠️ *¿Confirmás la cancelación de este turno?*

🔖 *Turno:* #{turno_id}
👨‍⚕️ *Profesional:* Dr. {medico_nombre}
🗓 *Fecha y Hora:* {fecha}
📍 *Sede:* {sede}

Respondé:
*1* - ✅ Sí, cancelar este turno
*2* - ❌ No, conservar mi turno`,
    {
      turno_id: t.id,
      medico_nombre: `${t.medico_nombre} ${t.medico_apellido}`,
      fecha: fechaHoraCompleta,
      hora: formatearHora24(t.hora_inicio),
      sede: t.sede_nombre || 'Consultorio'
    }
  );

  return await sendWhatsAppMessage(phone, confirmMsg);
}

/**
 * Inicia la selección de fechas disponibles para el médico con soporte de paginación
 */
async function iniciarSeleccionFecha(phone, session, offset = 0) {
  try {
    const fechas = await calcularProximasFechas(session.medico.id, 5, offset);
    session.fechasOffset = offset;
    session.fechasHasMore = Boolean(fechas.hasMore);
    session.medicoMaxDias = fechas.maxDias || 30;

    if (fechas.length === 0) {
      if (offset > 0) {
        const noMas = await getBotMessage(
          'no_mas_turnos_disponibles',
          'ℹ️ No hay más fechas disponibles dentro del período habilitado de agenda ({max_dias} días). Escribí el número de alguna de las fechas anteriores o *menu* para reiniciar.',
          { max_dias: session.medicoMaxDias }
        );
        return await sendWhatsAppMessage(phone, noMas);
      }

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

    msg += `\n¿Te sirve alguna de estas fechas o querés ver posteriores?`;
    if (session.fechasHasMore) {
      msg += `\n*6* - ⏩ Ver más fechas posteriores`;
    }
    msg += `\n*0* - ❌ Volver al menú principal\n_O escribí *menu* para reiniciar._`;

    return await sendWhatsAppMessage(phone, msg);
  } catch (err) {
    console.error(err);
    session.step = 'INIT';
    return await sendWhatsAppMessage(phone, 'Error obteniendo fechas de atención. Escribí *menu* para reiniciar.');
  }
}

/**
 * Pregunta el tipo de cobertura médica reconociendo la predeterminada del paciente
 */
async function iniciarSeleccionCobertura(phone, session) {
  session.step = 'AWAIT_COVERAGE_SELECTION';

  const acceptsParticular = session.medico.acepta_particular !== 0;
  const honorariosMonto = (session.medico.mostrar_honorarios && session.medico.honorarios_particular)
    ? Number(session.medico.honorarios_particular)
    : null;
  const partText = honorariosMonto ? `Particular (Honorarios: $${honorariosMonto.toLocaleString('es-AR')})` : 'Particular';

  let pacienteObraNombre = null;
  let pacientePlanNombre = null;

  if (session.paciente?.obra_social_id) {
    try {
      const [osRows] = await pool.query('SELECT nombre FROM obras_sociales WHERE id = ?', [session.paciente.obra_social_id]);
      if (osRows.length > 0) {
        pacienteObraNombre = osRows[0].nombre;
      }
      if (session.paciente.plan_id) {
        const [plRows] = await pool.query('SELECT nombre FROM planes_obras_sociales WHERE id = ?', [session.paciente.plan_id]);
        if (plRows.length > 0) {
          pacientePlanNombre = plRows[0].nombre;
        }
      }
    } catch (e) {
      console.warn(e);
    }
  }

  session.pacienteObraNombre = pacienteObraNombre;
  session.pacientePlanNombre = pacientePlanNombre;

  // Si ya tiene una obra social guardada en su perfil
  if (pacienteObraNombre) {
    const planInfo = pacientePlanNombre ? `(Plan: ${pacientePlanNombre})` : '';
    const prompt = await getBotMessage(
      'cobertura_predeterminada_prompt',
      `💳 *Cobertura médica para la consulta:*\n\nTu cobertura registrada es:\n👉 *{obra_social}* {plan_info}\n\n¿Deseás utilizar esta cobertura?\n*1* - ✅ Sí, continuar con {obra_social}\n*2* - 🔄 Cambiar por otra obra social o prepaga\n*3* - 💵 ${partText}\n\n_O escribí *menu* para cancelar._`,
      { obra_social: pacienteObraNombre, plan_info: planInfo }
    );
    return await sendWhatsAppMessage(phone, prompt);
  }

  // Si no tiene obra social previa
  let msg = `💳 *Cobertura médica para la consulta:*\n\nRespondé con una opción:\n\n*1* - Con Obra Social o Prepaga\n*2* - ${partText}\n\n_O escribí *menu* para cancelar._`;
  return await sendWhatsAppMessage(phone, msg);
}

/**
 * Inicia la selección de planes de la obra social y persiste la elección en el perfil
 */
async function iniciarSeleccionPlan(phone, session, osId, osNombre) {
  session.selectedOSId = osId;
  session.selectedOSNombre = osNombre;

  try {
    const planes = await getPlanes(osId);
    if (!planes || planes.length <= 1) {
      const chosenPlanId = planes?.[0]?.id || null;
      session.cobertura = {
        tipo: 'obra_social',
        obra_social_id: osId,
        plan_id: chosenPlanId,
        nombre: `${osNombre}${planes?.[0]?.nombre ? ` (${planes[0].nombre})` : ''}`
      };

      if (session.paciente?.id) {
        try {
          await pool.query(
            'UPDATE usuarios SET obra_social_id = ?, plan_id = ? WHERE id = ?',
            [osId, chosenPlanId, session.paciente.id]
          );
          session.paciente.obra_social_id = osId;
          session.paciente.plan_id = chosenPlanId;
        } catch (e) {
          console.warn('Error guardando obra social predeterminada:', e.message);
        }
      }

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
module.exports.sendWhatsAppMessage = sendWhatsAppMessage;
module.exports.getBotMessage = getBotMessage;
module.exports.userSessions = userSessions;
module.exports.notificarSuspensionPacientes = notificarSuspensionPacientes;
module.exports.normalizarFonetica = normalizarFonetica;
module.exports.calcularSimilitud = calcularSimilitud;
module.exports.puntuarMedico = puntuarMedico;
module.exports.mostrarSlotsPaginados = mostrarSlotsPaginados;
