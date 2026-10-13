# Reglas y Pautas del Proyecto (OscarSoft Turnos)

## 1. Bot de WhatsApp: Preguntas, Respuestas y Flujos
- **Regla Mandatoria**: Cada vez que se agregue, modifique o planifique una nueva pregunta, respuesta, plantilla o flujo conversacional para el bot de WhatsApp, **SIEMPRE debe incorporarse a la base de datos (`bot_respuestas`) y estar disponible en el CRUD del panel de administración (`DashboardPage.jsx` / `server/routes/admin.js`)**.
- **No Hardcodear Mensajes**: Las respuestas fijas, preguntas al paciente, opciones de menú e información clínica/institucional no deben quedar cableadas fijas en `whatsapp.js`. Deben recuperarse dinámicamente mediante `getBotMessage(clave)` o `checkCustomTrigger(userText)`.
- **Compatibilidad con Emojis y Textos**: La tabla `bot_respuestas` y la conexión MySQL deben utilizar siempre el juego de caracteres `utf8mb4` (`utf8mb4_unicode_ci`) para soportar emojis de WhatsApp.

## 2. Formato de Fechas y Zona Horaria
- Todas las fechas en la aplicación web (Agenda, Turnos, Mis Turnos, Modales) deben formatearse en formato argentino: `DD/MM/AAAA` (`xx/xx/xxxx`).
- La zona horaria operativa del sistema es siempre `America/Argentina/Buenos_Aires` (UTC-3).

## 3. Consultas y Cancelaciones
- Los pacientes pueden consultar y cancelar sus turnos tanto por la web ingresando su DNI como por WhatsApp (Opción 4 y Opción 5).
- En WhatsApp, la cancelación siempre debe solicitar confirmación previa (`1: Sí, cancelar / 2: No`) antes de liberar el turno en la base de datos.
