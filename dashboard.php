<!DOCTYPE html>
<html lang="es" data-bs-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - Clínica Médica</title>
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" rel="stylesheet">
    <!-- Select2 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" rel="stylesheet" />
    <link href="https://cdn.jsdelivr.net/npm/select2-bootstrap-5-theme@1.3.0/dist/select2-bootstrap-5-theme.min.css" rel="stylesheet" />
    <!-- DataTables CSS -->
    <link href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css" rel="stylesheet">
    <!-- Custom CSS con Cache Busting -->
    <link href="assets/css/style.css?v=<?php echo filemtime('assets/css/style.css'); ?>" rel="stylesheet">
</head>
<body class="bg-body-tertiary">

<!-- Navbar Superior -->
<nav class="navbar navbar-expand-lg navbar-dark bg-primary sticky-top shadow-sm">
    <div class="container-fluid px-4">
        <button class="navbar-toggler d-md-none collapsed me-2" type="button" data-bs-toggle="collapse" data-bs-target="#sidebarMenu" aria-controls="sidebarMenu" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
        </button>
        <a class="navbar-brand d-flex align-items-center fw-bold me-auto" href="#">
            <i class="bi bi-heart-pulse-fill me-2 fs-4"></i> <span id="page-title">Clínica Médica</span>
        </a>
        
        <!-- Controles derecha -->
        <div class="d-flex align-items-center gap-2 gap-md-3">
            <!-- Botón Ver Vista de Paciente -->
            <a href="index.php" target="_blank" class="btn btn-sm btn-outline-light rounded-pill px-3 d-inline-flex align-items-center gap-1 shadow-sm" title="Abrir vista de turnos del paciente">
                <i class="bi bi-eye"></i> <span class="d-none d-sm-inline">Vista de Paciente</span>
            </a>

            <!-- Theme Toggle -->
            <button class="btn btn-sm btn-outline-light rounded-circle" id="theme-toggle">
                <i class="bi bi-moon-fill"></i>
            </button>
            
            <div class="dropdown text-end">
                <a href="#" class="d-block link-light text-decoration-none dropdown-toggle" id="dropdownUser" data-bs-toggle="dropdown" aria-expanded="false">
                    <img src="https://ui-avatars.com/api/?name=Usuario&background=random" id="user-avatar" alt="mdo" width="32" height="32" class="rounded-circle">
                </a>
                <ul class="dropdown-menu dropdown-menu-end shadow" aria-labelledby="dropdownUser">
                    <li><h6 class="dropdown-header" id="user-name-display">Cargando...</h6></li>
                    <li><span class="dropdown-item-text badge bg-info text-dark mx-3 mb-2" id="user-role-display">ROL</span></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item" href="index.php" target="_blank"><i class="bi bi-eye me-2 text-primary"></i>Ver Vista de Paciente</a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item text-danger" href="#" id="logout-btn"><i class="bi bi-box-arrow-right me-2"></i>Cerrar Sesión</a></li>
                </ul>
            </div>
        </div>
    </div>
</nav>

<div class="container-fluid">
    <div class="row">
        <!-- Sidebar -->
        <div class="offcanvas-md offcanvas-end bg-body-tertiary sidebar border-end col-md-3 col-lg-2 p-0 h-100" tabindex="-1" id="sidebarMenu" aria-labelledby="sidebarMenuLabel">
            <div class="offcanvas-header">
                    <h5 class="offcanvas-title" id="sidebarMenuLabel">Menú</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="offcanvas" data-bs-target="#sidebarMenu" aria-label="Close"></button>
                </div>
                <div class="offcanvas-body d-md-flex flex-column p-0 pt-lg-3 overflow-y-auto">
                    <ul class="nav flex-column gap-1 w-100 px-2" id="nav-menu">
                        <li class="nav-item">
                            <a class="nav-link active d-flex align-items-center" href="#" id="menu-dashboard">
                                <i class="bi bi-house-door me-2"></i> Inicio
                            </a>
                        </li>
                        <li class="nav-item admin-only d-none">
                            <a class="nav-link d-flex align-items-center" href="#" id="menu-usuarios">
                                <i class="bi bi-people me-2"></i> Gestión de Usuarios
                            </a>
                        </li>
                        <li class="nav-item admin-only d-none">
                            <a class="nav-link d-flex align-items-center" href="#" id="menu-obras">
                                <i class="bi bi-building me-2"></i> Obras Sociales
                            </a>
                        </li>
                        <li class="nav-item admin-only d-none">
                            <a class="nav-link d-flex align-items-center" href="#" id="menu-agenda-admin">
                                <i class="bi bi-calendar-range me-2"></i> Agenda y Horarios
                            </a>
                        </li>
                        <li class="nav-item admin-only d-none">
                            <a class="nav-link d-flex align-items-center" href="#" id="menu-medicos">
                                <i class="bi bi-person-lines-fill me-2"></i> Médicos
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link d-flex align-items-center" href="#" id="menu-turnos">
                                <i class="bi bi-calendar-check me-2"></i> Mis Turnos
                            </a>
                        </li>
                        <li class="nav-item admin-only d-none mt-4">
                            <a class="nav-link d-flex align-items-center text-muted" href="#" id="menu-configuracion">
                                <i class="bi bi-gear me-2"></i> Configuración
                            </a>
                        </li>
                        <li class="nav-item mt-3 pt-2 border-top">
                            <a class="nav-link d-flex align-items-center text-primary fw-semibold" href="index.php" target="_blank" title="Abrir vista de turnos del paciente">
                                <i class="bi bi-box-arrow-up-right me-2 text-primary"></i> Ver Vista de Paciente
                            </a>
                        </li>
                    </ul>
                </div>
            </div>

        <!-- Contenido Principal -->
        <main class="col-md-9 ms-sm-auto col-lg-10 px-3 px-md-4 py-4">
            
            <!-- VISTA: INICIO / DASHBOARD -->
            <!-- VISTA: INICIO / DASHBOARD -->
            <div id="content-dashboard">
                <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pb-3 mb-4 border-bottom">
                    <h1 class="h2 fw-bold">Resumen General</h1>
                </div>

                <div class="row g-4">
                    <div class="col-12 col-md-4">
                        <div class="card border-0 shadow-sm h-100 rounded-4 overflow-hidden">
                            <div class="card-body p-4 bg-primary text-white position-relative">
                                <h5 class="card-title fw-normal opacity-75">Próximos Turnos</h5>
                                <p class="card-text display-4 fw-bold mb-0" id="contador-proximos-turnos">0</p>
                                <i class="bi bi-calendar-event position-absolute" style="font-size: 5rem; right: -10px; bottom: -20px; opacity: 0.2;"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-12 col-md-8">
                        <div class="card border-0 shadow-sm h-100 rounded-4">
                            <div class="card-body p-4 d-flex flex-column justify-content-center align-items-center text-center">
                                <i class="bi bi-calendar-plus text-primary mb-3" style="font-size: 3rem;"></i>
                                <h4>¿Necesitas atención médica?</h4>
                                <p class="text-muted">Agenda tu cita con nuestros especialistas rápidamente.</p>
                                <button class="btn btn-primary px-4 rounded-pill" onclick="document.getElementById('menu-turnos').click()">Solicitar Turno</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- VISTA: GESTIÓN DE USUARIOS (PACIENTES) -->
            <div id="content-usuarios" class="d-none">
                <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pb-3 mb-4 border-bottom">
                    <div>
                        <h1 class="h2 fw-bold mb-1">Gestión de Usuarios (Pacientes)</h1>
                        <p class="text-muted small mb-0">Personas registradas para reservar turnos médicos</p>
                    </div>
                    <div class="d-flex gap-2 align-items-center flex-wrap">
                        <div class="input-group" style="width: 280px;">
                            <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
                            <input type="text" class="form-control" id="search-usuarios" placeholder="Buscar por nombre, DNI, tel, email...">
                        </div>
                        <button class="btn btn-primary shadow-sm rounded-pill" data-bs-toggle="modal" data-bs-target="#modalCrearPaciente">
                            <i class="bi bi-person-plus me-1"></i> Nuevo Paciente
                        </button>
                    </div>
                </div>

                <div class="card border-0 shadow-sm rounded-4">
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0" id="users-table">
                                <thead class="table-light">
                                    <tr>
                                        <th class="ps-4">Paciente</th>
                                        <th>DNI</th>
                                        <th>Fecha Nac.</th>
                                        <th>Cobertura Médica</th>
                                        <th>Plan</th>
                                        <th>WhatsApp / Tel.</th>
                                        <th>Email</th>
                                        <th class="pe-4 text-end">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody id="tabla-usuarios">
                                    <tr>
                                        <td colspan="8" class="text-center py-4 text-muted">Cargando pacientes...</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- VISTA: OBRAS SOCIALES -->
            <div id="content-obras" class="d-none">
                <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pb-3 mb-4 border-bottom">
                    <h1 class="h2 fw-bold">Obras Sociales</h1>
                    <button class="btn btn-primary shadow-sm rounded-pill" data-bs-toggle="modal" data-bs-target="#modalCrearObra">
                        <i class="bi bi-plus-lg me-1"></i> Nueva Obra Social
                    </button>
                </div>
                <div class="card border-0 shadow-sm rounded-4">
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0" id="obras-table">
                                <thead class="table-light">
                                    <tr>
                                        <th class="ps-4">ID</th>
                                        <th>Nombre (Obra Social)</th>
                                        <th>Planes</th>
                                        <th class="pe-4 text-end">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody id="tabla-obras">
                                    <tr>
                                        <td colspan="4" class="text-center py-4 text-muted">Cargando obras sociales...</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- VISTA: AGENDA ADMIN -->
            <div id="content-agenda-admin" class="d-none">
                <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pb-3 mb-4 border-bottom">
                    <h1 class="h2 fw-bold">Configuración de Agenda</h1>
                </div>
                
                <div class="card border-0 shadow-sm rounded-4 mb-4" id="agenda-admin-selector-container">
                    <div class="card-body p-4">
                        <label class="form-label fw-bold"><i class="bi bi-person-badge text-primary me-2"></i>Selecciona un Profesional</label>
                        <select class="form-select form-select-lg" id="agenda-admin-medico-select">
                            <option value="">Cargando profesionales...</option>
                        </select>
                        <div class="form-text mt-2">Elige el médico al que deseas configurarle los días y horarios de atención.</div>
                    </div>
                </div>

                <div class="card border-0 shadow-sm rounded-4 d-none" id="agenda-admin-editor-card">
                    <div class="card-header bg-white border-bottom-0 pt-3 pb-0 px-4">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h5 class="fw-bold mb-0" id="agenda-admin-medico-nombre">Agenda del Profesional</h5>
                                <small class="text-muted" id="agenda-admin-medico-subtitulo"></small>
                            </div>
                        </div>
                        <!-- Pestañas Horarios vs Turnos Asignados vs Reglas de Agenda -->
                        <ul class="nav nav-tabs card-header-tabs" id="agendaAdminTabs" role="tablist">
                            <li class="nav-item" role="presentation">
                                <button class="nav-link active fw-semibold" id="tab-turnos-asignados-tab" data-bs-toggle="tab" data-bs-target="#tab-turnos-asignados" type="button" role="tab">
                                    <i class="bi bi-calendar-week me-1 text-primary"></i> Turnos Asignados y Pacientes
                                </button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link fw-semibold" id="tab-horarios-atencion-tab" data-bs-toggle="tab" data-bs-target="#tab-horarios-atencion" type="button" role="tab">
                                    <i class="bi bi-clock-history me-1 text-primary"></i> Días y Horarios de Atención
                                </button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link fw-semibold" id="tab-reglas-agenda-tab" data-bs-toggle="tab" data-bs-target="#tab-reglas-agenda" type="button" role="tab">
                                    <i class="bi bi-calendar-range me-1 text-primary"></i> Ventana y Apertura de Agenda
                                </button>
                            </li>
                        </ul>
                    </div>
                    <div class="card-body p-4">
                        <div class="tab-content" id="agendaAdminTabsContent">
                            <!-- TAB 1: TURNOS ASIGNADOS DEL PROFESIONAL -->
                            <div class="tab-pane fade show active" id="tab-turnos-asignados" role="tabpanel">
                                <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
                                    <div class="d-flex align-items-center gap-2">
                                        <span class="badge bg-primary-subtle text-primary border px-3 py-2 fs-6 fw-bold" id="badge-total-turnos-medico">0 turnos</span>
                                        <div class="btn-group btn-group-sm">
                                            <button type="button" class="btn btn-outline-secondary active btn-filtro-estado-agenda" onclick="filtrarTurnosAgendaMedico('todos', this)">Todos</button>
                                            <button type="button" class="btn btn-outline-info btn-filtro-estado-agenda" onclick="filtrarTurnosAgendaMedico('asignado', this)">Asignados</button>
                                            <button type="button" class="btn btn-outline-success btn-filtro-estado-agenda" onclick="filtrarTurnosAgendaMedico('confirmado', this)">Confirmados</button>
                                            <button type="button" class="btn btn-outline-warning btn-filtro-estado-agenda" onclick="filtrarTurnosAgendaMedico('pendiente', this)">Pendientes</button>
                                            <button type="button" class="btn btn-outline-primary btn-filtro-estado-agenda" onclick="filtrarTurnosAgendaMedico('asistio', this)">Asistió</button>
                                            <button type="button" class="btn btn-outline-danger btn-filtro-estado-agenda" onclick="filtrarTurnosAgendaMedico('cancelado', this)">Cancelados</button>
                                        </div>
                                    </div>
                                    <div class="d-flex gap-2">
                                        <input type="text" class="form-control form-control-sm rounded-pill" id="search-turnos-medico" placeholder="Buscar por paciente, DNI, teléfono..." style="max-width: 250px;" oninput="filtrarTurnosAgendaMedicoInput(this.value)">
                                    </div>
                                </div>
                                <div class="table-responsive">
                                    <table class="table table-hover align-middle mb-0" id="tabla-turnos-medico-table">
                                        <thead class="table-light">
                                            <tr>
                                                <th>Fecha y Hora</th>
                                                <th>Paciente</th>
                                                <th>Contacto / WhatsApp</th>
                                                <th>Obra Social / Plan</th>
                                                <th>Sede</th>
                                                <th>Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody id="tabla-turnos-medico-body">
                                            <tr><td colspan="6" class="text-center text-muted py-4">Cargando turnos...</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <!-- TAB 2: CONFIGURACIÓN DE HORARIOS -->
                            <div class="tab-pane fade" id="tab-horarios-atencion" role="tabpanel">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <p class="text-muted small mb-0">
                                        Configura los días, horas y centros de atención para este profesional. 
                                        <a href="#" onclick="document.getElementById('menu-configuracion').click();" class="text-primary text-decoration-none fw-semibold"><i class="bi bi-geo-alt"></i> Administrar Sedes</a>
                                    </p>
                                    <button class="btn btn-outline-primary btn-sm rounded-pill" onclick="agregarBloqueHorarioInline()">
                                        <i class="bi bi-plus-lg me-1"></i> Agregar bloque
                                    </button>
                                </div>
                                
                                <!-- Contenedor donde se renderizan los bloques -->
                                <div id="agenda-admin-editor-container"></div>
                                
                                <div class="mt-4 pt-3 border-top text-end">
                                    <input type="hidden" id="agenda-admin-medico-id">
                                    <button type="button" class="btn btn-primary rounded-pill px-4 py-2 fw-bold" onclick="guardarHorariosMedicoInline()">
                                        <i class="bi bi-check-lg me-1"></i> Guardar Cambios de Horarios
                                    </button>
                                </div>
                            </div>

                            <!-- TAB 3: VENTANA Y APERTURA DE AGENDA -->
                            <div class="tab-pane fade" id="tab-reglas-agenda" role="tabpanel">
                                <div class="p-2" style="max-width: 750px;">
                                    <div class="card border-0 bg-light rounded-4 p-4 mb-4">
                                        <h6 class="fw-bold text-dark mb-2">
                                            <i class="bi bi-calendar-range text-primary me-2"></i>1. Período de Tiempo / Ventana de Turnos Habilitada
                                        </h6>
                                        <p class="text-muted small mb-3">
                                            Controla dinámicamente hasta cuántos días hacia adelante los pacientes pueden reservar con este profesional. Esto <strong>evita que saquen turnos a años futuros</strong> (por ejemplo de acá al 2030).
                                        </p>
                                        <div class="row g-3 align-items-center mb-3">
                                            <div class="col-sm-6">
                                                <div class="input-group">
                                                    <input type="number" class="form-control form-control-lg bg-white border-0 shadow-sm" id="agenda-inline-dias-antelacion" min="1" max="730" placeholder="Ej: 30, 45, 60, 90...">
                                                    <span class="input-group-text bg-white border-0 text-muted">días futuros</span>
                                                </div>
                                            </div>
                                            <div class="col-sm-6">
                                                <small class="text-muted d-block" id="agenda-inline-dias-hint">
                                                    Si se deja vacío, aplica el límite general del sistema configurado.
                                                </small>
                                            </div>
                                        </div>
                                        <div class="d-flex flex-wrap gap-2">
                                            <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill" onclick="setDiasRapidosAgendaInline(15)">15 días</button>
                                            <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill" onclick="setDiasRapidosAgendaInline(30)">30 días (1 mes)</button>
                                            <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill" onclick="setDiasRapidosAgendaInline(45)">45 días</button>
                                            <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill" onclick="setDiasRapidosAgendaInline(60)">60 días (2 meses)</button>
                                            <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill" onclick="setDiasRapidosAgendaInline(90)">90 días (3 meses)</button>
                                            <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill" onclick="setDiasRapidosAgendaInline(180)">180 días (6 meses)</button>
                                            <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill" onclick="setDiasRapidosAgendaInline(365)">365 días (1 año)</button>
                                            <button type="button" class="btn btn-sm btn-outline-danger rounded-pill" onclick="setDiasRapidosAgendaInline('')">Usar General del Sistema</button>
                                        </div>
                                    </div>

                                    <div class="card border-0 bg-light rounded-4 p-4 mb-4">
                                        <h6 class="fw-bold text-dark mb-2">
                                            <i class="bi bi-calendar2-check text-primary me-2"></i>2. Día Mensual de Apertura de Agenda
                                        </h6>
                                        <p class="text-muted small mb-3">
                                            Si el médico habilita su agenda a partir de un día específico de cada mes (por ejemplo: <em>"La agenda abre los días 10 de cada mes"</em> o <em>"los días 1"</em>), indícalo aquí. Antes de ese día, los pacientes verán un aviso informando qué día abre la reserva.
                                        </p>
                                        <div class="row g-3 align-items-center mb-2">
                                            <div class="col-sm-6">
                                                <div class="input-group">
                                                    <span class="input-group-text bg-white border-0 text-muted">Día</span>
                                                    <input type="number" class="form-control form-control-lg bg-white border-0 shadow-sm" id="agenda-inline-dia-apertura" min="1" max="31" placeholder="Ej: 1, 10, 15, 20...">
                                                    <span class="input-group-text bg-white border-0 text-muted">de cada mes</span>
                                                </div>
                                            </div>
                                            <div class="col-sm-6">
                                                <button type="button" class="btn btn-sm btn-outline-danger rounded-pill" onclick="document.getElementById('agenda-inline-dia-apertura').value=''">Sin día fijo (Siempre abierta)</button>
                                            </div>
                                        </div>
                                        <small class="text-muted">Déjalo en blanco si la agenda se encuentra abierta continuamente sin esperar a un día específico del mes.</small>
                                    </div>

                                    <div class="text-end pt-2">
                                        <button type="button" class="btn btn-primary rounded-pill px-4 py-2 fw-bold" onclick="guardarReglasAgendaInline()">
                                            <i class="bi bi-check-lg me-1"></i> Guardar Reglas de Agenda
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- VISTA: MIS TURNOS -->
            <div id="content-turnos" class="d-none">
                <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pb-3 mb-4 border-bottom">
                    <h1 class="h2 fw-bold">Mis Turnos</h1>
                    <a href="agendar.php" class="btn btn-primary shadow-sm rounded-pill">
                        <i class="bi bi-calendar-plus me-1"></i> Solicitar Turno
                    </a>
                </div>

                <div id="mis-turnos-container" class="mt-4">
                    <div class="text-center text-muted py-5">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                        <p class="mt-2">Cargando tus turnos...</p>
                    </div>
                </div>
            </div>

            <!-- VISTA: MEDICOS -->
            <div id="content-medicos" class="d-none">
                <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pb-3 mb-4 border-bottom">
                    <h1 class="h2 fw-bold">Gestión de Médicos</h1>
                    <div class="d-flex gap-3">
                        <div class="input-group" style="max-width: 300px;">
                            <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
                            <input type="text" class="form-control" id="search-medicos" placeholder="Buscar médico...">
                        </div>
                        <button class="btn btn-primary rounded-pill fw-bold" data-bs-toggle="modal" data-bs-target="#modalCrearMedico">
                            <i class="bi bi-plus-lg me-1"></i> Agregar Profesional
                        </button>
                    </div>
                </div>
                <div class="row g-4" id="medicos-container">
                    <div class="col-12 text-center text-muted py-5">
                        <div class="spinner-border text-primary" role="status"></div>
                        <p class="mt-2">Cargando médicos...</p>
                    </div>
                </div>
            </div>

            <!-- VISTA: CONFIGURACION -->
            <div id="content-configuracion" class="d-none">
                <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pb-3 mb-4 border-bottom">
                    <h1 class="h2 fw-bold">Configuración del Sistema</h1>
                </div>

                <!-- Agenda Global -->
                <div class="card border-0 shadow-sm rounded-4 mb-4">
                    <div class="card-body p-4">
                        <h5 class="fw-bold mb-3"><i class="bi bi-calendar3 me-2 text-primary"></i>Límite Global de Agenda (Para todos los Médicos)</h5>
                        <p class="text-muted small">
                            Define el período máximo general hacia adelante en el que cualquier paciente puede reservar turnos si el profesional no tiene una ventana personalizada.
                        </p>
                        <form id="form-configuracion">
                            <div class="row g-3 mb-3">
                                <div class="col-md-4">
                                    <label for="config-meses" class="form-label fw-bold">Meses de antelación general</label>
                                    <div class="input-group">
                                        <input type="number" class="form-control" id="config-meses" min="1" max="24" required>
                                        <span class="input-group-text">meses</span>
                                    </div>
                                    <div class="form-text">Ej: 1, 2, 3 meses (equivale a 30, 60, 90 días).</div>
                                </div>
                                <div class="col-md-8 d-flex align-items-end">
                                    <div class="d-flex flex-wrap gap-2">
                                        <button type="button" class="btn btn-outline-secondary btn-sm rounded-pill" onclick="document.getElementById('config-meses').value=1">1 Mes</button>
                                        <button type="button" class="btn btn-outline-secondary btn-sm rounded-pill" onclick="document.getElementById('config-meses').value=2">2 Meses</button>
                                        <button type="button" class="btn btn-outline-secondary btn-sm rounded-pill" onclick="document.getElementById('config-meses').value=3">3 Meses</button>
                                        <button type="button" class="btn btn-outline-secondary btn-sm rounded-pill" onclick="document.getElementById('config-meses').value=6">6 Meses</button>
                                    </div>
                                </div>
                            </div>
                            <button type="submit" class="btn btn-primary px-4 rounded-pill">Guardar Configuración General</button>
                        </form>
                    </div>
                </div>

                <!-- Sedes / Unidades de Atención -->
                <div class="card border-0 shadow-sm rounded-4">
                    <div class="card-body p-4">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h5 class="fw-bold mb-0"><i class="bi bi-building me-2 text-primary"></i>Sedes / Unidades de Atención</h5>
                            <button class="btn btn-primary rounded-pill btn-sm" onclick="abrirModalSede()">
                                <i class="bi bi-plus-lg me-1"></i> Agregar Sede
                            </button>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0" id="sedes-table">
                                <thead class="table-light">
                                    <tr>
                                        <th>Nombre</th>
                                        <th>Dirección</th>
                                        <th>Localidad</th>
                                        <th class="text-end">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody id="tabla-sedes">
                                    <tr><td colspan="4" class="text-center text-muted py-4">Cargando sedes...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
</div>

<!-- Modal Solicitar Turno (Docturno Style) -->
<div class="modal fade" id="modalNuevoTurno" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered modal-lg">
    <div class="modal-content rounded-4 border-0 shadow">
      <div class="modal-header border-bottom-0 pb-0">
        <h1 class="modal-title fs-5 fw-bold">Solicitar Turno</h1>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body p-4">
        <form id="form-solicitar-turno">
            <!-- Paso 1: Especialidad y Profesional -->
            <div id="step-1" class="mb-4">
                <h5 class="fw-semibold text-muted mb-3"><i class="bi bi-person-badge me-2"></i>1. ¿Qué profesional buscas?</h5>
                <div class="row g-3">
                    <div class="col-md-6">
                        <select class="form-select shadow-sm" id="turno-especialidad" required>
                            <option value="" selected disabled>Selecciona especialidad...</option>
                            <!-- Cargado por JS -->
                        </select>
                    </div>
                    <div class="col-md-6">
                        <select class="form-select shadow-sm" id="turno-medico" required disabled>
                            <option value="" selected disabled>Primero selecciona especialidad...</option>
                            <!-- Cargado por JS -->
                        </select>
                    </div>
                </div>
            </div>
            
            <!-- Paso 2: Obra Social y Planes (Botones) -->
            <div id="step-2" class="mb-4 d-none">
                <hr class="text-muted opacity-25 my-4">
                <h5 class="fw-semibold text-muted mb-3"><i class="bi bi-shield-check me-2"></i>2. ¿Qué cobertura y plan tienes?</h5>
                
                <div class="mb-3">
                    <select class="form-select shadow-sm" id="turno-obra-social" required>
                        <option value="" selected disabled>Selecciona tu cobertura médica...</option>
                        <!-- Cargado por JS -->
                    </select>
                </div>
                
                <div id="planes-container" class="d-flex flex-wrap gap-2 mt-3 justify-content-center d-none">
                    <!-- Botones píldora (Planes) se inyectan aquí -->
                </div>
                <input type="hidden" id="turno-plan" required>
            </div>

            <!-- Paso 3: Calendario de Días y Horarios -->
            <div id="step-3" class="mb-2 d-none">
                <hr class="text-muted opacity-25 my-4">
                <h5 class="fw-semibold text-muted mb-4 text-center"><i class="bi bi-calendar-event me-2"></i>3. ¿Qué día prefieres?</h5>
                
                <!-- Navegación de meses si fuera necesario -->
                <div id="mes-label" class="text-center text-muted fw-bold mb-3 fs-5">Octubre</div>

                <div id="dias-container" class="d-flex overflow-auto pb-3 gap-3 justify-content-start" style="scroll-snap-type: x mandatory; scroll-behavior: smooth;">
                    <!-- Botones de días (Pills) se inyectan aquí -->
                </div>
                <input type="hidden" id="turno-fecha" required>

                <!-- Horarios Disponibles -->
                <div id="horarios-container" class="d-none mt-4">
                    <h6 class="text-center text-muted mb-3">Horarios disponibles</h6>
                    <div id="horarios-list" class="d-flex flex-wrap gap-2 justify-content-center">
                        <!-- Píldoras de horas se inyectan aquí -->
                    </div>
                    <input type="hidden" id="turno-hora" required>
                </div>
            </div>
        </form>
      </div>
      <div class="modal-footer border-top-0 pt-0">
        <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button>
        <button type="button" class="btn btn-primary rounded-pill px-4" disabled>Siguiente</button>
      </div>
    </div>
  </div>
</div>

<!-- Modal Crear Personal -->
<!-- Modal Agregar Médico -->
<div class="modal fade" id="modalCrearMedico" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content rounded-4 border-0 shadow">
      <div class="modal-header border-bottom-0 pb-0">
        <h1 class="modal-title fs-5 fw-bold">Agregar Profesional</h1>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <form id="form-crear-medico">
            <div class="mb-3">
                <input type="text" class="form-control" id="new-medico-nombre" placeholder="Nombre(s)" required>
            </div>
            <div class="mb-3">
                <input type="text" class="form-control" id="new-medico-apellido" placeholder="Apellido(s)" required>
            </div>
            <div class="mb-3">
                <input type="email" class="form-control" id="new-medico-email" placeholder="Correo Electrónico" required>
            </div>
            <div class="mb-3">
                <input type="number" class="form-control" id="new-medico-dni" placeholder="DNI (sin puntos)" required>
            </div>
            <div class="mb-3">
                <input type="password" class="form-control" id="new-medico-password" placeholder="Contraseña de Acceso" required>
            </div>
        </form>
      </div>
      <div class="modal-footer border-top-0 pt-0">
        <button type="button" class="btn btn-light rounded-pill" data-bs-dismiss="modal">Cancelar</button>
        <button type="button" class="btn btn-primary rounded-pill" onclick="crearMedicoAdminBtn()">Agregar</button>
      </div>
    </div>
  </div>
</div>

<!-- Modal Crear Paciente (Usuario) -->
<div class="modal fade" id="modalCrearPaciente" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered modal-lg">
    <div class="modal-content rounded-4 border-0 shadow">
      <div class="modal-header border-bottom-0 pb-0">
        <h1 class="modal-title fs-5 fw-bold"><i class="bi bi-person-plus text-primary me-2"></i>Nuevo Paciente</h1>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <form id="form-crear-paciente">
        <div class="modal-body p-4">
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label small fw-semibold text-muted">Nombre</label>
              <input type="text" class="form-control" id="nuevo-paciente-nombre" placeholder="Nombre" required>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-semibold text-muted">Apellido</label>
              <input type="text" class="form-control" id="nuevo-paciente-apellido" placeholder="Apellido" required>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-semibold text-muted">DNI</label>
              <input type="text" class="form-control" id="nuevo-paciente-dni" placeholder="Ej: 38123456" required>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-semibold text-muted">Fecha de Nacimiento</label>
              <input type="date" class="form-control" id="nuevo-paciente-fnac" required>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-semibold text-muted" id="label-nuevo-paciente-telefono"><i class="bi bi-whatsapp text-success me-1"></i>WhatsApp / Teléfono</label>
              <input type="tel" class="form-control" id="nuevo-paciente-telefono" placeholder="Ej: 2944123456" required>
              <div class="form-check mt-1">
                <input class="form-check-input" type="checkbox" id="nuevo-paciente-no-whatsapp" onchange="toggleAdminPacNoWhatsapp('nuevo', this.checked)">
                <label class="form-check-label small text-muted user-select-none" for="nuevo-paciente-no-whatsapp">
                  No tiene WhatsApp (solo llamadas)
                </label>
              </div>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-semibold text-muted">Correo Electrónico (Email)</label>
              <input type="email" class="form-control" id="nuevo-paciente-email" placeholder="paciente@ejemplo.com" required>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-semibold text-muted">Cobertura Médica (Obra Social)</label>
              <select class="form-select" id="nuevo-paciente-os">
                <option value="">Particular / Sin Cobertura</option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-semibold text-muted">Plan</label>
              <select class="form-select" id="nuevo-paciente-plan" disabled>
                <option value="">Selecciona una obra social...</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer border-top-0 pt-0 px-4 pb-4">
          <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button>
          <button type="submit" class="btn btn-primary rounded-pill px-4" id="btn-guardar-paciente">
            <i class="bi bi-check-lg me-1"></i> Guardar Paciente
          </button>
        </div>
      </form>
    </div>
  </div>
</div>

<!-- Modal Editar Paciente (Usuario) -->
<div class="modal fade" id="modalEditarPaciente" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered modal-lg">
    <div class="modal-content rounded-4 border-0 shadow">
      <div class="modal-header border-bottom-0 pb-0">
        <h1 class="modal-title fs-5 fw-bold"><i class="bi bi-pencil-square text-primary me-2"></i>Editar Datos de Paciente</h1>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <form id="form-editar-paciente">
        <input type="hidden" id="edit-paciente-id">
        <div class="modal-body p-4">
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label small fw-semibold text-muted">Nombre</label>
              <input type="text" class="form-control" id="edit-paciente-nombre" required>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-semibold text-muted">Apellido</label>
              <input type="text" class="form-control" id="edit-paciente-apellido" required>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-semibold text-muted">DNI</label>
              <input type="text" class="form-control" id="edit-paciente-dni">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-semibold text-muted">Fecha de Nacimiento</label>
              <input type="date" class="form-control" id="edit-paciente-fnac">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-semibold text-muted" id="label-edit-paciente-telefono"><i class="bi bi-whatsapp text-success me-1"></i>WhatsApp / Teléfono</label>
              <input type="tel" class="form-control" id="edit-paciente-telefono">
              <div class="form-check mt-1">
                <input class="form-check-input" type="checkbox" id="edit-paciente-no-whatsapp" onchange="toggleAdminPacNoWhatsapp('edit', this.checked)">
                <label class="form-check-label small text-muted user-select-none" for="edit-paciente-no-whatsapp">
                  No tiene WhatsApp (solo llamadas)
                </label>
              </div>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-semibold text-muted">Correo Electrónico (Email)</label>
              <input type="email" class="form-control" id="edit-paciente-email" required>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-semibold text-muted">Cobertura Médica (Obra Social)</label>
              <select class="form-select" id="edit-paciente-os">
                <option value="">Particular / Sin Cobertura</option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-semibold text-muted">Plan</label>
              <select class="form-select" id="edit-paciente-plan">
                <option value="">Selecciona cobertura...</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer border-top-0 pt-0 px-4 pb-4">
          <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button>
          <button type="submit" class="btn btn-primary rounded-pill px-4" id="btn-actualizar-paciente">
            <i class="bi bi-check-lg me-1"></i> Guardar Cambios
          </button>
        </div>
      </form>
    </div>
  </div>
</div>

<div class="modal fade" id="modalCrearUsuario" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content rounded-4 border-0 shadow">
      <div class="modal-header border-bottom-0 pb-0">
        <h1 class="modal-title fs-5 fw-bold">Alta de Personal</h1>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <form id="form-crear-personal">
            <div class="mb-3">
                <input type="text" class="form-control" id="new-nombre" placeholder="Nombre completo" required>
            </div>
            <div class="mb-3">
                <input type="email" class="form-control" id="new-email" placeholder="Correo Electrónico" required>
            </div>
            <div class="mb-3">
                <select class="form-select" id="new-rol" required>
                    <option value="" selected disabled>Seleccionar Rol...</option>
                    <option value="recepcionista">Recepcionista</option>
                    <option value="medico">Médico</option>
                    <option value="admin">Admin</option>
                </select>
            </div>
            <div class="mb-3">
                <input type="password" class="form-control" id="new-password" placeholder="Contraseña de Acceso" required>
            </div>
        </form>
      </div>
      <div class="modal-footer border-top-0 pt-0">
        <button type="button" class="btn btn-light rounded-pill" data-bs-dismiss="modal">Cancelar</button>
        <button type="button" class="btn btn-primary rounded-pill" onclick="crearPersonal()">Crear</button>
      </div>
    </div>
  </div>
</div>

<!-- Modal Crear Obra Social -->
<div class="modal fade" id="modalCrearObra" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content rounded-4 border-0 shadow">
      <div class="modal-header border-bottom-0 pb-0">
        <h1 class="modal-title fs-5 fw-bold"><i class="bi bi-building-add text-primary me-2"></i>Nueva Obra Social</h1>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <form id="form-crear-obra">
        <div class="modal-body p-4">
          <div class="mb-4">
            <label class="form-label fw-bold text-dark mb-1">Nombre de la Obra Social</label>
            <input type="text" class="form-control form-control-lg rounded-3" id="nueva-obra-nombre" placeholder="Ej: OSDE, Swiss Medical, Galeno..." required autocomplete="off">
            <div class="form-text">Nombre de la entidad o cobertura médica.</div>
          </div>

          <div class="mb-3">
            <label class="form-label fw-bold text-dark mb-2">Esquema de Planes</label>
            
            <div class="row g-2 mb-3">
              <div class="col-6">
                <input type="radio" class="btn-check" name="tipo_plan_creacion" id="plan_tipo_unico" value="unico" checked autocomplete="off" onchange="toggleTipoPlanCreacion()">
                <label class="btn btn-outline-primary w-100 py-2.5 rounded-3 d-flex flex-column align-items-center justify-content-center text-center h-100" for="plan_tipo_unico">
                  <i class="bi bi-file-earmark-check fs-4 mb-1"></i>
                  <span class="fw-bold">Plan Único</span>
                  <small class="text-muted" style="font-size: 0.75rem;">Para coberturas sin segmentación</small>
                </label>
              </div>
              <div class="col-6">
                <input type="radio" class="btn-check" name="tipo_plan_creacion" id="plan_tipo_multiples" value="multiples" autocomplete="off" onchange="toggleTipoPlanCreacion()">
                <label class="btn btn-outline-primary w-100 py-2.5 rounded-3 d-flex flex-column align-items-center justify-content-center text-center h-100" for="plan_tipo_multiples">
                  <i class="bi bi-collection fs-4 mb-1"></i>
                  <span class="fw-bold">Varios Planes</span>
                  <small class="text-muted" style="font-size: 0.75rem;">Agregar múltiples planes</small>
                </label>
              </div>
            </div>

            <!-- Contenedor Plan Único -->
            <div id="container-plan-unico" class="p-3 bg-light rounded-3 border">
              <label class="form-label small fw-semibold text-muted mb-1">Nombre del Plan Único</label>
              <input type="text" class="form-control" id="nueva-obra-plan-unico" value="Plan Único" placeholder="Plan Único">
              <div class="form-text small">Se creará automáticamente este plan único para la obra social.</div>
            </div>

            <!-- Contenedor Varios Planes -->
            <div id="container-planes-multiples" class="d-none">
              <div class="p-3 bg-light rounded-3 border">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <label class="form-label small fw-semibold text-muted mb-0">Planes a registrar:</label>
                  <button type="button" class="btn btn-sm btn-outline-primary rounded-pill py-0 px-2.5" onclick="agregarInputPlanModal()">
                    <i class="bi bi-plus-lg me-1"></i> Agregar otro
                  </button>
                </div>
                <div id="lista-inputs-planes" class="d-flex flex-column gap-2">
                  <!-- Inputs dinámicos agregados por JS -->
                </div>
                <div class="form-text small mt-2">Puedes añadir todos los planes que sean necesarios.</div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer border-top-0 pt-0 px-4 pb-4">
          <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button>
          <button type="submit" class="btn btn-primary rounded-pill px-4" id="btn-guardar-obra">
            <i class="bi bi-check-lg me-1"></i> Guardar Obra Social
          </button>
        </div>
      </form>
    </div>
  </div>
</div>

<!-- Modal Gestión de Planes -->
<div class="modal fade" id="modalGestionPlanes" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content rounded-4 border-0 shadow">
      <div class="modal-header border-bottom-0 pb-0">
        <h1 class="modal-title fs-5 fw-bold" id="modalGestionPlanesTitle">Planes de Obra Social</h1>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <input type="hidden" id="gestion-plan-os-id">
        
        <!-- Formulario para agregar plan -->
        <form id="form-crear-plan" class="mb-4">
            <div class="input-group">
                <input type="text" class="form-control" id="new-plan-nombre" placeholder="Nombre del nuevo plan" required>
                <button class="btn btn-primary" type="submit"><i class="bi bi-plus"></i> Añadir Plan</button>
            </div>
            <div class="mt-2 d-flex gap-2">
                <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill py-0 px-2" style="font-size: 0.8rem;" onclick="document.getElementById('new-plan-nombre').value='Plan Único'; document.getElementById('new-plan-nombre').focus();">
                    <i class="bi bi-magic me-1"></i> Sugerir "Plan Único"
                </button>
            </div>
        </form>

        <div class="table-responsive">
            <table class="table table-hover align-middle mb-0" id="planes-table">
                <thead class="table-light">
                    <tr>
                        <th>Nombre del Plan</th>
                        <th class="text-end">Acciones</th>
                    </tr>
                </thead>
                <tbody id="tabla-planes">
                    <tr>
                        <td colspan="2" class="text-center py-3 text-muted">Cargando planes...</td>
                    </tr>
                </tbody>
            </table>
        </div>
      </div>
      <div class="modal-footer border-top-0 pt-0">
        <button type="button" class="btn btn-light rounded-pill" data-bs-dismiss="modal">Cerrar</button>
      </div>
    </div>
  </div>
</div>

<!-- Modal Gestión de Especialidades (Categorías de Usuarios) -->
<div class="modal fade" id="modalEspecialidades" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content rounded-4 border-0 shadow">
      <div class="modal-header border-bottom-0 pb-0">
        <h1 class="modal-title fs-5 fw-bold">Categorías de Usuarios (Especialidades)</h1>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        
        <!-- Formulario para agregar especialidad -->
        <form id="form-crear-especialidad" class="mb-4">
            <div class="input-group">
                <input type="text" class="form-control" id="new-especialidad-nombre" placeholder="Nombre de la nueva categoría (ej. Kinesiólogo)" required>
                <button class="btn btn-primary" type="submit"><i class="bi bi-plus"></i> Añadir</button>
            </div>
        </form>

        <div class="table-responsive">
            <table class="table table-hover align-middle mb-0" id="especialidades-table">
                <thead class="table-light">
                    <tr>
                        <th>Categoría / Especialidad</th>
                        <th class="text-end">Acciones</th>
                    </tr>
                </thead>
                <tbody id="tabla-especialidades">
                    <tr>
                        <td colspan="2" class="text-center py-3 text-muted">Cargando categorías...</td>
                    </tr>
                </tbody>
            </table>
        </div>
      </div>
      <div class="modal-footer border-top-0 pt-0">
        <button type="button" class="btn btn-light rounded-pill" data-bs-dismiss="modal">Cerrar</button>
      </div>
    </div>
  </div>
</div>



<!-- Scripts UI Basicos -->
<!-- Modal Editar Médico -->
<div class="modal fade" id="modalEditMedico" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content rounded-4 border-0 shadow">
      <div class="modal-header border-bottom-0 pb-0">
        <h5 class="modal-title fw-bold">Editar Perfil Médico</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body p-4">
        <form id="form-edit-medico">
            <input type="hidden" id="edit-medico-id">
            <div class="mb-3 text-center">
                <div id="edit-medico-foto-wrapper" class="rounded-circle mb-2 overflow-hidden d-inline-flex align-items-center justify-content-center bg-light" style="width:100px;height:100px;border:3px solid #e9ecef;">
                    <img src="" id="edit-medico-foto-preview" class="rounded-circle object-fit-cover d-none" width="100" height="100">
                    <i class="bi bi-person-fill text-secondary d-block" id="edit-medico-foto-placeholder" style="font-size:3.5rem;"></i>
                </div>
                <div>
                    <label for="edit-medico-foto" class="btn btn-sm btn-outline-primary rounded-pill">Subir Foto</label>
                    <input type="file" id="edit-medico-foto" class="d-none" accept="image/png, image/jpeg, image/webp">
                </div>
            </div>
            <div class="row g-2 mb-3">
                <div class="col-6">
                    <label class="form-label fw-semibold">Nombre</label>
                    <input type="text" class="form-control bg-light border-0 rounded-3" id="edit-medico-nombre">
                </div>
                <div class="col-6">
                    <label class="form-label fw-semibold">Apellido</label>
                    <input type="text" class="form-control bg-light border-0 rounded-3" id="edit-medico-apellido">
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label fw-semibold">Matrícula</label>
                <input type="text" class="form-control bg-light border-0 rounded-3" id="edit-medico-matricula">
            </div>
            <div class="mb-3">
                <label class="form-label fw-semibold">Especialidades</label>
                <div id="edit-medico-especialidades-container" class="p-3 bg-light rounded-3" style="max-height: 180px; overflow-y: auto;">
                    <!-- checkboxes de especialidades cargados dinámicamente -->
                </div>
                <div class="input-group input-group-sm mt-2">
                    <input type="text" class="form-control bg-light border-0" id="nueva-especialidad-rapida" placeholder="¿No está en la lista? Escribe otra especialidad...">
                    <button class="btn btn-outline-primary" type="button" onclick="agregarEspecialidadRapida()">+ Agregar</button>
                </div>
                <small class="text-muted">Selecciona una o más especialidades o agrega una nueva directamente.</small>
            </div>
            <div class="mb-3">
                <label class="form-label fw-semibold">Sede de Atención</label>
                <select class="form-select bg-light border-0 rounded-3 mb-2" id="edit-medico-sede-select" onchange="seleccionarSedeEnMedico(this.value)">
                    <option value="">-- Seleccionar Sede de Atención (Configuración) --</option>
                </select>
                <input type="text" class="form-control bg-light border-0 rounded-3" id="edit-medico-direccion" placeholder="O escribe la dirección de atención...">
                <small class="text-muted">Elige una sede cargada en Configuración o escribe la dirección manualmente.</small>
            </div>
            <div class="mb-3">
                <label class="form-label fw-semibold">
                    <i class="bi bi-calendar-range me-1 text-primary"></i>Ventana de Agenda Abierta
                </label>
                <div class="input-group">
                    <input type="number" class="form-control bg-light border-0" id="edit-medico-dias-agenda" min="1" max="730" placeholder="Ej: 30, 60, 90, 180, 365...">
                    <span class="input-group-text bg-light border-0 text-muted">días hacia adelante</span>
                </div>
                <div class="d-flex flex-wrap gap-1 mt-2">
                    <button type="button" class="btn btn-xs btn-outline-secondary py-0 px-2 rounded-pill small" onclick="setDiasRapidosMedico(30)">30 d (1 mes)</button>
                    <button type="button" class="btn btn-xs btn-outline-secondary py-0 px-2 rounded-pill small" onclick="setDiasRapidosMedico(60)">60 d (2 m)</button>
                    <button type="button" class="btn btn-xs btn-outline-secondary py-0 px-2 rounded-pill small" onclick="setDiasRapidosMedico(90)">90 d (3 m)</button>
                    <button type="button" class="btn btn-xs btn-outline-secondary py-0 px-2 rounded-pill small" onclick="setDiasRapidosMedico(180)">180 d (6 m)</button>
                    <button type="button" class="btn btn-xs btn-outline-secondary py-0 px-2 rounded-pill small" onclick="setDiasRapidosMedico(365)">365 d (1 año)</button>
                    <button type="button" class="btn btn-xs btn-outline-danger py-0 px-2 rounded-pill small" onclick="setDiasRapidosMedico('')">General del sistema</button>
                </div>
                <div class="form-text">Define hasta cuántos días en el futuro los pacientes pueden reservar turnos con este médico (evita turnos a años futuros). Déjalo vacío para usar el valor general.</div>
            </div>
            <div class="mb-3">
                <label class="form-label fw-semibold">
                    <i class="bi bi-calendar2-check me-1 text-primary"></i>Día Mensual de Apertura de Agenda
                </label>
                <div class="input-group">
                    <span class="input-group-text bg-light border-0 text-muted">Día</span>
                    <input type="number" class="form-control bg-light border-0" id="edit-medico-dia-apertura" min="1" max="31" placeholder="Ej: 1, 10, 15, 20...">
                    <span class="input-group-text bg-light border-0 text-muted">de cada mes</span>
                </div>
                <div class="form-text">Si este médico abre su agenda a partir de un día específico cada mes (ej. día 10), ingrésalo aquí. Déjalo vacío si está siempre abierta.</div>
            </div>
            <div class="mb-3">
                <label class="form-label fw-semibold">Biografía / Presentación</label>
                <textarea class="form-control bg-light border-0 rounded-3" id="edit-medico-biografia" rows="4"></textarea>
            </div>
            <button type="submit" class="btn btn-primary w-100 rounded-pill py-2 fw-bold">Guardar Cambios</button>
        </form>
      </div>
    </div>
  </div>
</div>

<!-- Modal Coberturas Médico -->
<div class="modal fade" id="modalCoberturasMedico" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
    <div class="modal-content rounded-4 border-0 shadow">
      <div class="modal-header border-bottom-0 pb-0">
        <h5 class="modal-title fw-bold">Asignar Coberturas</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body p-4">
        <form id="form-coberturas-medico">
            <input type="hidden" id="coberturas-medico-id">
            <div class="position-relative mb-2">
                <i class="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
                <input type="text" id="search-coberturas-modal" class="form-control rounded-pill ps-5 bg-light border-0 py-2" placeholder="Buscar obra social o plan (ej: OSDE, Swiss, Galeno...)" autocomplete="off">
            </div>
            <div class="d-flex justify-content-between align-items-center mb-3 px-1">
                <span class="text-muted small">Selección rápida:</span>
                <div class="btn-group btn-group-sm">
                    <button type="button" class="btn btn-outline-primary btn-sm rounded-pill px-2 py-1 me-1" onclick="marcarTodasCoberturas(true)" title="Marcar todas las obras sociales y sus planes">
                        <i class="bi bi-check-all me-1"></i>Marcar todos
                    </button>
                    <button type="button" class="btn btn-outline-secondary btn-sm rounded-pill px-2 py-1" onclick="marcarTodasCoberturas(false)" title="Desmarcar todas las obras sociales y planes">
                        <i class="bi bi-x-circle me-1"></i>Desmarcar todos
                    </button>
                </div>
            </div>
            <div id="coberturas-list-container" class="mb-4" style="max-height: 380px; overflow-y: auto;">
                <!-- Se llenará dinámicamente -->
            </div>
            <button type="submit" class="btn btn-primary w-100 rounded-pill py-2 fw-bold">Guardar Coberturas</button>
        </form>
      </div>
    </div>
  </div>
</div>

<!-- Modal Sede (Crear/Editar) -->
<div class="modal fade" id="modalSede" tabindex="-1" aria-hidden="true" style="z-index: 1060;">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content rounded-4 border-0 shadow">
      <div class="modal-header border-bottom-0 pb-0">
        <h5 class="modal-title fw-bold" id="modalSedeTitle">Nueva Sede</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body p-4">
        <form id="form-sede">
            <input type="hidden" id="sede-id">
            <input type="hidden" id="sede-latitud">
            <input type="hidden" id="sede-longitud">

            <!-- Buscador con autocompletar inteligente -->
            <div class="mb-3 position-relative">
                <label class="form-label fw-semibold text-primary"><i class="bi bi-geo-alt-fill me-1"></i>Buscar Dirección (Autocompletar)</label>
                <div class="input-group">
                    <span class="input-group-text bg-light border-0"><i class="bi bi-search text-muted"></i></span>
                    <input type="text" class="form-control bg-light border-0" id="sede-autocomplete-input" placeholder="Escribe calle, número o lugar (ej: Pasaje Gutiérrez 980)..." autocomplete="off">
                    <button class="btn btn-outline-secondary border-0 bg-light" type="button" id="btn-limpiar-autocomplete" title="Limpiar"><i class="bi bi-x-circle"></i></button>
                </div>
                <div id="sede-autocomplete-results" class="list-group position-absolute w-100 shadow-lg rounded-3 mt-1 d-none" style="z-index: 1065; max-height: 200px; overflow-y: auto;"></div>
                <small class="text-muted" style="font-size: 0.78rem;">Escribe una dirección para autocompletar calle, número y ciudad automáticamente.</small>
            </div>

            <div class="mb-3">
                <label class="form-label fw-semibold">Nombre de la Sede <span class="text-danger">*</span></label>
                <input type="text" class="form-control bg-light border-0 rounded-3" id="sede-nombre" placeholder="Ej: Consultorio Pasaje Gutiérrez o Centro Central" required>
            </div>
            <div class="row g-3 mb-3">
                <div class="col-8">
                    <label class="form-label fw-semibold">Calle</label>
                    <input type="text" class="form-control bg-light border-0 rounded-3" id="sede-calle" placeholder="Ej: Pasaje Gutiérrez" oninput="actualizarPreviewMapaModalSede()">
                </div>
                <div class="col-4">
                    <label class="form-label fw-semibold">Número</label>
                    <input type="text" class="form-control bg-light border-0 rounded-3" id="sede-numero" placeholder="980" oninput="actualizarPreviewMapaModalSede()">
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label fw-semibold">Ciudad / Localidad</label>
                <input type="text" class="form-control bg-light border-0 rounded-3" id="sede-localidad" placeholder="Ej: San Carlos de Bariloche" oninput="actualizarPreviewMapaModalSede()">
            </div>

            <!-- Preview mapa en el modal de edición de sede -->
            <div class="mb-4" id="sede-mapa-preview-wrapper" style="display:none;">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <label class="form-label small fw-semibold text-muted mb-0"><i class="bi bi-map me-1 text-primary"></i>Ubicación en Google Maps</label>
                    <a href="#" id="sede-preview-link-comollegar" target="_blank" class="small text-decoration-none text-primary fw-semibold"><i class="bi bi-cursor-fill me-1"></i>Cómo llegar</a>
                </div>
                <div class="rounded-3 overflow-hidden border" style="height: 170px; background-color: #f8f9fa;">
                    <iframe id="sede-mapa-preview-iframe" width="100%" height="100%" style="border:0;" loading="lazy"></iframe>
                </div>
            </div>

            <button type="submit" class="btn btn-primary w-100 rounded-pill py-2 fw-bold">Guardar Sede</button>
        </form>
      </div>
    </div>
  </div>
</div>

<!-- Modal Horarios del Médico -->
<div class="modal fade" id="modalHorariosMedico" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
    <div class="modal-content rounded-4 border-0 shadow">
      <div class="modal-header border-bottom-0 pb-0">
        <div>
            <h5 class="modal-title fw-bold">Horarios de Atención</h5>
            <small class="text-muted" id="horario-medico-nombre-label">Dr/a. ...</small>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body p-4">
        <input type="hidden" id="horario-medico-id">
        <p class="text-muted small mb-3">
            Podés asignar diferentes centros de atención a cada bloque de horario (ej: Lunes en Pasaje Gutiérrez, Miércoles en Km 1).
            <a href="javascript:void(0)" onclick="bootstrap.Modal.getInstance(document.getElementById('modalHorariosMedico')).hide(); document.getElementById('menu-configuracion').click(); setTimeout(() => document.getElementById('tab-sedes-tab').click(), 400);" class="text-primary text-decoration-none fw-semibold ms-1"><i class="bi bi-geo-alt"></i> Administrar Sedes</a>
        </p>
        <div id="horarios-editor-container">
            <!-- Se generan dinámicamente los días -->
        </div>
        <button class="btn btn-outline-primary rounded-pill mt-3" onclick="agregarBloqueHorario()">
            <i class="bi bi-plus-lg me-1"></i> Agregar bloque de horario
        </button>
      </div>
      <div class="modal-footer border-top-0 pt-0">
        <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button>
        <button type="button" class="btn btn-primary rounded-pill px-4" onclick="guardarHorariosMedico()">
            <i class="bi bi-check-lg me-1"></i> Guardar Horarios
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Modal Ver Mapa de Sede & Cómo llegar -->
<div class="modal fade" id="modalVerSedeMapa" tabindex="-1" aria-labelledby="modalVerSedeMapaLabel" aria-hidden="true" style="z-index: 1070;">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content rounded-4 border-0 shadow-lg overflow-hidden bg-white">
            <div class="modal-header border-bottom-0 pb-1 pt-4 px-4 bg-white">
                <div class="d-flex align-items-center gap-2">
                    <div class="rounded-circle p-2 bg-primary-subtle text-primary d-flex align-items-center justify-content-center" style="width:42px; height:42px;">
                        <i class="bi bi-geo-alt-fill fs-5"></i>
                    </div>
                    <div>
                        <h5 class="modal-title fw-bold text-dark mb-0" id="modal-sede-mapa-nombre">Sede</h5>
                        <small class="text-muted" id="modal-sede-mapa-direccion">Dirección de atención</small>
                    </div>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body p-3 p-md-4 bg-white">
                <div class="rounded-4 overflow-hidden shadow-sm border mb-3" style="height: 350px; background-color: #f1f3f5;">
                    <iframe id="modal-sede-mapa-iframe" width="100%" height="100%" style="border:0;" loading="lazy" allowfullscreen="" referrerpolicy="no-referrer-when-downgrade"></iframe>
                </div>
                <div class="d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2 pt-2">
                    <div class="text-muted small text-center text-sm-start">
                        <i class="bi bi-info-circle me-1 text-primary"></i>Ubicación en Google Maps. Puedes abrir la ruta directamente en tu GPS.
                    </div>
                    <div class="d-flex gap-2 w-100 w-sm-auto justify-content-end">
                        <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cerrar</button>
                        <a id="modal-sede-mapa-btn-comollegar" href="#" target="_blank" rel="noopener noreferrer" class="btn btn-primary rounded-pill px-4 fw-bold shadow-sm d-inline-flex align-items-center justify-content-center gap-2">
                            <i class="bi bi-cursor-fill"></i> Cómo llegar
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
<script>
    // Theme Toggle Logic
    const themeToggle = document.getElementById('theme-toggle');
    const icon = themeToggle.querySelector('i');
    const htmlElement = document.documentElement;
    
    const savedTheme = localStorage.getItem('theme') || 'light';
    htmlElement.setAttribute('data-bs-theme', savedTheme);
    updateIcon(savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = htmlElement.getAttribute('data-bs-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        htmlElement.setAttribute('data-bs-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateIcon(newTheme);
    });

    function updateIcon(theme) {
        if(theme === 'dark') {
            icon.classList.remove('bi-moon-fill');
            icon.classList.add('bi-sun-fill');
            icon.style.color = '#ffc107';
        } else {
            icon.classList.remove('bi-sun-fill');
            icon.classList.add('bi-moon-fill');
            icon.style.color = 'inherit';
        }
    }
</script>

<!-- jQuery (Requerido por Select2 y DataTables) -->
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<!-- Select2 JS -->
<script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
<!-- DataTables JS -->
<script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
<script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>

<!-- Firebase SDK -->
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
<!-- Scripts Propios con Cache Busting -->
<script src="assets/js/firebase-config.js?v=<?php echo filemtime('assets/js/firebase-config.js'); ?>"></script>
<script src="assets/js/dashboard.js?v=<?php echo filemtime('assets/js/dashboard.js'); ?>"></script>
</body>
</html>
