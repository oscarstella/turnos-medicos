# Arquitectura y Roadmap: Bot de WhatsApp como Plantilla SaaS (Multi-Cliente y Multi-Rubro)

Este documento detalla la arquitectura técnica, modelo de negocio y pasos para convertir la base de **Turnos WhatsApp** en una **plantilla escalable (SaaS)** lista para clonar o configurar para múltiples clientes y distintos modelos de negocio (Turnos, Cursos, Tiendas, etc.).

---

## 📍 1. Ubicaciones del Proyecto Plantilla (`turnos_whatsapp`)

Para que lo recuerdes y lo tengamos siempre a mano:

* **En tu Mac (Local):**  
  `/Users/oscarnicolasstella/Documents/proyectos/Node/turnos_whatsapp`
* **En el Servidor VPS (`62.84.179.78`):**  
  `/www/wwwroot/oscarsoft.com.ar/turnowhatsapp`
* **En la Web (Producción):**  
  `https://oscarsoft.com.ar/turnowhatsapp/`
* **Backend en PM2 (VPS):**  
  Proceso `turnos-whatsapp-backend` (Puerto interno `5075`).
* **Base de datos dedicada:**  
  `turnos_whatsapp` (en MariaDB / MySQL de tu servidor).

---

## 🛒 2. Versatilidad Multi-Rubro: Turnos, Cursos y Tiendas

El motor conversacional que ya construimos (Webhooks de Meta + Máquina de estados en Node + Respuestas dinámicas en DB) es **100% modular**. Cambiando el catálogo de datos, el mismo bot se adapta a diferentes industrias:

| Rubro | Flujo del Bot | Datos del Sistema | Integración de Pago |
| :--- | :--- | :--- | :--- |
| 🏥 **Turnos Médicos / Servicios** | Especialidad ➔ Profesional ➔ Fecha y Hora ➔ DNI ➔ Confirmación. | Médicos, Agendas, Sedes, Obras Sociales. | Cobro opcional de seña o particular. |
| 🎓 **Cursos y Academias** | Categoría ➔ Selección de Curso ➔ Modalidad / Fechas ➔ Datos del Alumno ➔ Inscripción. | Cursos, Módulos, Profesores, Materiales. | Link de pago de matrícula / cuota por Mercado Pago. |
| 🛍️ **Tiendas y E-Commerce** | Categorías ➔ Catálogo de Productos ➔ Agregar a Carrito ➔ Dirección de Entrega ➔ Pedido. | Productos, Stock, Precios, Variantes (talles/colores). | Checkout de Mercado Pago / Envío contra entrega. |

---

## 🎯 3. El Modelo de Uso y Doble Botón en el Panel del Cliente

En el **Panel de Administración** al que accederá el cliente dueño del negocio (clínica, academia o comercio), tendremos una sección clara de **"Configuración y Facturación"** con **dos botones principales**:

```
┌────────────────────────────────────────────────────────────────────────┐
│  PANEL DE CONTROL DEL CLIENTE (Clínica / Academia / Tienda)             │
│                                                                        │
│  [ Botón 1: Conectar WhatsApp Business ] ➔ Ventana oficial de Meta     │
│   • Asocia su número comercial.                                        │
│   • Ingresa su tarjeta de crédito directamente en Meta.                │
│   • Meta le cobra su consumo a él (aprovechando 1.000 chats gratis).   │
│                                                                        │
│  [ Botón 2: Activar Suscripción del Servicio ] ➔ Checkout Mercado Pago │
│   • Adhiere su tarjeta al débito automático mensual para OscarSoft.   │
│   • Tus honorarios por mantenimiento, catálogo y hosting de la app.    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 💳 4. Desglose de los Dos Flujos de Cobro

### Flujo A: Consumo de Mensajería (Meta WhatsApp Cloud API)
* **Objetivo:** Que vos **nunca** pagues ni un solo peso de los mensajes que envíen los usuarios o clientes de cada negocio.
* **Mecanismo:** **Meta Embedded Signup** (Registro Integrado).
* **Experiencia del cliente:** Hace clic en *"Conectar WhatsApp Business"*, se le abre un pop-up de Facebook/Meta, valida su número de teléfono y carga su propia tarjeta en la plataforma de Meta.
* **Lo que recibe tu servidor:** Meta le entrega automáticamente a tu base de datos el `phone_number_id` y el `access_token` del cliente para que el bot empiece a contestar en su nombre.

### Flujo B: Cobro de tu Servicio / Abono (OscarSoft)
* **Objetivo:** Cobrar de forma automatizada y sin intervención manual tus honorarios mensuales o costo de setup.
* **Mecanismo:** **Mercado Pago Subscriptions** (Preapproval API).
* **Experiencia del cliente:** Hace clic en *"Suscribirse al Plan"* y autoriza el débito automático con su tarjeta de crédito o débito.
* **Lo que recibe tu servidor:** Webhook de Mercado Pago que actualiza el estado de la cuenta a `activo`. Si el cliente no abona, el sistema suspende las funciones del panel o del bot automáticamente.

---

## 🏗️ 5. Pasos a Seguir para la Próxima Sesión

Cuando arranquemos mañana o pasado mañana con este nuevo demo, seguiremos este orden:

1. **Estructura del Panel de Configuración:**  
   Diseñar en el frontend de `turnos_whatsapp` la vista del panel con la tarjeta de suscripción y los dos botones de acción.
2. **Integración del botón de Mercado Pago:**  
   Crear el endpoint en Node.js que genera el link de suscripción recurrente y recibe los webhooks de pago confirmado.
3. **Integración del botón Embedded Signup (Meta):**  
   Cargar el SDK de Facebook en el frontend para abrir el pop-up de conexión de número y vincularlo al backend.
4. **Adaptabilidad de Catálogos (Turnos / Cursos / Tienda):**  
   Dejar la estructura preparada para que el mismo motor pueda alimentar tanto turnos médicos como catálogo de cursos educativos o productos de tienda.

---

> 📌 **Guardado como referencia técnica para OscarSoft.**  
> Cuando quieras continuar, simplemente decime *"retomemos la plantilla de turnos_whatsapp"* y arrancamos directamente sobre estos pasos.
