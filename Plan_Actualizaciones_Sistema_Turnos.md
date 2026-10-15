# Plan Maestro de Actualizaciones y Mejoras: OscarSoft Turnos

> **Documento Consolidado Único**  
> *Recopilación integral de requerimientos, diseño técnico y próximas tareas para continuar el desarrollo.*

---

## 📌 Índice de Temas
1. [Estado Actual del Sistema en Producción](#1-estado-actual-del-sistema-en-producción)
2. [Requerimiento 1: Paginación y Navegación de Turnos Disponibles ("Ver más turnos")](#2-requerimiento-1-paginación-y-navegación-de-turnos-disponibles-ver-más-turnos)
3. [Requerimiento 2: Búsqueda Fonética y Aproximada de Médicos (Fuzzy Search)](#3-requerimiento-2-búsqueda-fonética-y-aproximada-de-médicos-fuzzy-search)
4. [Requerimiento 3: Aviso Automático ante Cancelación Médica con Reprogramación por WhatsApp](#4-requerimiento-3-aviso-automático-ante-cancelación-médica-con-reprogramación-por-whatsapp)
5. [Requerimiento 4: Actualización Dinámica de Obra Social Predeterminada](#5-requerimiento-4-actualización-dinámica-de-obra-social-predeterminada)
6. [Reglas Clave de Desarrollo (`AGENTS.md`)](#6-reglas-clave-de-desarrollo-agentsmd)

---

## 1. Estado Actual del Sistema en Producción

- **Infraestructura VPS (`62.84.179.78`)**:
  - `oscarsoft` (Gateway Nginx/Proxy inverso - puerto 5000)
  - `turnos-backend` (API Turnos y Webhook WhatsApp - puerto 5065)
  - `turnos-whatsapp-backend` (SaaS WhatsApp - puerto 5075)
- **WhatsApp Cloud API & Whisper STT**:
  - Webhooks oficiales validados (`/api/turnos/whatsapp/webhook`).
  - Motor de audio y mensajes de voz `whisper.cpp` con modelo en español instalado en `/opt/whisper.cpp/transcribe.sh`.
- **Cron Job de Recordatorios Automáticos** (activo cada 15 min):
  - **48 horas antes**: Se despacha **estrictamente entre las 11:00 y las 14:00 hs de Argentina (UTC-3)**. Solicita confirmación (`1: Sí, confirmar / 2: Cancelar`).
  - **2 horas antes**: Alerta puntual el mismo día del turno (sin restricción de franja horaria).
  - La base de datos es compartida entre la web (`React`), el panel administrativo y WhatsApp, por lo que **todo turno agendado desde cualquier canal recibe los recordatorios**.

---

## 2. Requerimiento 1: Paginación y Navegación de Turnos Disponibles ("Ver más turnos")

### 🎯 Objetivo
Evitar que el bot se detenga si al paciente no le sirven las 5 o 6 opciones iniciales. Permitir que el paciente avance a fechas u horarios posteriores hasta encontrar un turno conveniente, dentro de la ventana de agenda máxima que tenga configurada el profesional.

### 📐 Diseño Técnico
1. **Límite de Agenda por Médico (`dias_antelacion_agenda`)**:
   - Cada médico tiene en la tabla `usuarios` el campo `dias_antelacion_agenda` (ej. 30, 45, 60 días).
   - El bot calcula el rango válido: desde hoy hasta `hoy + dias_antelacion_agenda`.
2. **Paginación en Bloques (Batches de 5 a 6 turnos)**:
   - Al mostrar la lista de fechas o turnos disponibles:
     ```text
     🗓 *Turnos disponibles con el Dr. {medico}:*

     1 - Viernes 16/10 a las 10:00 hs (Sede Central)
     2 - Viernes 16/10 a las 11:30 hs (Sede Central)
     3 - Lunes 19/10 a las 09:00 hs (Sede Centro)
     4 - Lunes 19/10 a las 10:30 hs (Sede Centro)
     5 - Martes 20/10 a las 15:00 hs (Sede Central)

     ¿Te sirve alguno o querés ver fechas posteriores?
     *6* - ⏩ Ver más turnos posteriores
     *0* - ❌ Volver al menú principal
     ```
3. **Flujo de Navegación**:
   - Si el paciente elige `6` (o responde *"ver más"*, *"más"*):
     - El bot avanza el cursor de paginación (`session.pageOffset += 5`).
     - Consulta los siguientes turnos disponibles respetando el límite máximo de antelación.
     - Si se alcanza el límite máximo de agenda del médico:
       `ℹ️ No hay más turnos disponibles dentro del período habilitado de agenda ({max_dias} días). Escribí el número de los turnos anteriores o *menu* para reiniciar.`

---

## 3. Requerimiento 2: Búsqueda Fonética y Aproximada de Médicos (Fuzzy Search)

### 🎯 Objetivo
Permitir que el paciente encuentre al médico aunque no recuerde exactamente cómo se escribe su apellido (ej. buscar *"Olavenky"*, *"Labenski"* o *"Lavenky"* y encontrar al **Dr. German Labencki**).

### 📐 Diseño Técnico
1. **Normalización Fonética (Español)**:
   - Homogeneizar grafemas confusos:
     - `B` y `V` $\rightarrow$ `b`
     - `C`, `K`, `QU` $\rightarrow$ `k`
     - `S`, `Z`, `C (ante e/i)` $\rightarrow$ `s`
     - `Y`, `I` $\rightarrow$ `i`
     - Eliminación de tildes y diéresis.
2. **Distancia Levenshtein / Jaro-Winkler**:
   - Si la consulta SQL directa (`LIKE '%busqueda%'`) devuelve 0 resultados:
     - El backend compara la entrada del usuario contra la lista de médicos activos en memoria.
     - Calcula el coeficiente de similitud (0% a 100%).
3. **Sugerencias Inteligentes ("¿Quisiste decir...?")**:
   - Si encuentra candidatos con similitud $\ge 55\%$, el bot responde:
     ```text
     🔎 No encontramos coincidencia exacta para *"olavenky"*, pero encontramos estos profesionales:

     1️⃣ *Dr. German Labencki* (Traumatología)
     2️⃣ *Dr. Jorge Oliwa* (Oftalmología)

     Respondé con el número del médico para continuar (o *menu* para volver):
     ```

---

## 4. Requerimiento 3: Aviso Automático ante Cancelación Médica con Reprogramación por WhatsApp

### 🎯 Objetivo
Cuando un médico o la clínica suspende la atención en un rango de fechas desde su panel, notificar automáticamente a todos los pacientes con turnos en ese período y permitirles reprogramar directamente por WhatsApp.

### 📐 Diseño Técnico
1. **Disparador en Backend**:
   - En `POST /api/medico/suspensiones` (`server/routes/medico.js`):
     - Se identifican los turnos con pacientes (`afectados`).
     - Se pasan a estado `cancelado` con nota del motivo.
     - Se ejecuta una cola asíncrona de envíos por WhatsApp Cloud API con **pausa de 800 ms entre mensajes** (evita bloqueos por rate limit de Meta).
2. **Plantilla en `bot_respuestas` (`suspension_medico_aviso`)**:
   ```text
   ⚠️ *Aviso Importante de Turno Médico*

   Hola *{paciente_nombre}*, te informamos que el *Dr. {medico_nombre}* no podrá atender el día *{fecha}* a las *{hora} hs* por: _{motivo}_.

   Lamentamos las molestias. ¿Qué deseás hacer con tu turno?
   *1* - 🗓 Reprogramar para otra fecha disponible
   *2* - ❌ Dejar cancelado el turno
   ```
3. **Flujo de Respuesta**:
   - Si responde `1`: El bot pasa a estado `AWAIT_RESCHEDULE` y le ofrece las próximas fechas disponibles del mismo médico.
   - Si responde `2`: Se confirma la cancelación y se libera la sesión cordialmente.

---

## 5. Requerimiento 4: Actualización Dinámica de Obra Social Predeterminada

### 🎯 Objetivo
Que la última obra social seleccionada por el paciente en la web o en WhatsApp pase a ser su obra social actual/predeterminada registrada en la base de datos, recordándola para futuras consultas pero permitiéndole cambiarla siempre.

### 📐 Diseño Técnico
1. **Persistencia en BBDD**:
   - Al confirmar un turno (en `crearTurno` de `turnosService.js` o en el flujo WhatsApp), se ejecuta:
     ```sql
     UPDATE usuarios 
     SET obra_social_id = ?, plan_id = ? 
     WHERE id = ?;
     ```
2. **Comportamiento en WhatsApp**:
   - Al iniciar la reserva, el bot verifica si el paciente ya tiene una obra social guardada:
     ```text
     Tu obra social actual registrada es:
     💳 *{nombre_obra_social}* (Plan: {plan})

     ¿Deseás utilizar esta cobertura?
     *1* - ✅ Sí, continuar con esta cobertura
     *2* - 🔄 Cambiar por otra obra social
     *3* - 💵 Atención Particular (sin obra social)
     ```
   - Si el paciente elige `2`: Selecciona la nueva obra social, y **automáticamente queda guardada como su nueva predeterminada para siempre**.
3. **Corrección de Perfiles Existentes**:
   - Se limpió el perfil de prueba de Oscar Stella (`DNI 17768931` / `542944674774`) para que no tenga más asociada una obra social errónea por defecto.

---

## 6. Reglas Clave de Desarrollo (`AGENTS.md`)

- **Plantillas en Base de Datos**: Ningún mensaje del bot debe ir cableado fijo en el código; siempre debe existir en `bot_respuestas` y estar disponible en el CRUD del panel de administración (`DashboardPage.jsx`).
- **Zona Horaria y Fechas**:
  - Formato argentino: `DD/MM/AAAA`.
  - Zona horaria: `America/Argentina/Buenos_Aires` (UTC-3).
- **Charset MySQL**: Siempre `utf8mb4` (`utf8mb4_unicode_ci`) para soportar emojis sin truncamiento.

---

## 7. Estado de Implementación y Despliegue en Producción (Octubre 2026)

### ✅ Requerimientos Implementados y Validados:
1. **Paginación de Turnos Disponibles**:
   - `calcularProximasFechas(medicoId, 5, offset)` con soporte de `offset`, límite `dias_antelacion_agenda`, y navegación con `6 - Ver más fechas` y `0 - Volver`.
   - `mostrarSlotsPaginados` con bloques de 5 horarios, opción `6 - Ver más horarios` y `0 - Cambiar fecha`.
2. **Búsqueda Fonética y Difusa (Fuzzy Search)**:
   - Normalización fonética (`normalizarFonetica`) adaptada a grafemas del español (`b/v`, `c/k/qu`, `s/z/c`, `y/i`, etc.).
   - Algoritmo de similitud Levenshtein (`calcularSimilitud` y `puntuarMedico`).
   - Sugerencias inteligentes (*"¿Quisiste decir...?"*) para coincidencias $\ge 55\%$ con plantilla `sugerencia_medico_fuzzy`.
3. **Aviso Automático de Cancelación Médica con Reprogramación**:
   - Integrado en `POST /api/medico/suspensiones` (`server/routes/medico.js`).
   - Función asíncrona `notificarSuspensionPacientes(afectados, motivo)` con control de rate limit (800ms) vía WhatsApp Cloud API.
   - Estado `AWAIT_RESCHEDULE_CHOICE` (`1: Reprogramar / 2: Cancelar`).
4. **Obra Social Dinámica Predeterminada**:
   - Actualización automática en `usuarios` (`obra_social_id`, `plan_id`) al agendar o modificar cobertura tanto en la Web (`/public/agendar` y `crearTurno`) como en WhatsApp (`iniciarSeleccionCobertura` y `AWAIT_COVERAGE_SELECTION`).
5. **Plantillas en Base de Datos**:
   - Archivo `update_mejoras_octubre.sql` creado con todas las claves requeridas para `bot_respuestas`.

---

### 🚀 Pasos para Actualizar en el Servidor VPS (`62.84.179.78`):
Una vez pusheados los cambios a GitHub (`git push origin main`), ejecutar en la consola del servidor:

```bash
cd /www/wwwroot/oscarsoft.com.ar/turnos # o directorio del proyecto en VPS
git pull origin main
mysql -u root -p oscarsoft_turnos < update_mejoras_octubre.sql
npm run client:build
pm2 restart turnos-backend
```
