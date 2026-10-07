// Helper: Limpiar nombres y apellidos (quitar direcciones o textos entre paréntesis)
function limpiarNombre(str) {
    if (!str) return '';
    return str.replace(/\s*\([^)]*\)/g, '').replace(/\s*–\s*\d+.*$/g, '').trim();
}
window.limpiarNombre = limpiarNombre;

// Helper: Nombre completo de un médico (nombre + apellido, sin direcciones)
function nombreCompletoMedico(m) {
    return `${limpiarNombre(m.nombre)} ${limpiarNombre(m.apellido || '')}`.trim();
}
window.nombreCompletoMedico = nombreCompletoMedico;

// Helper: Inicializar Select2 (con buscador) sobre un <select>
function initSelect2(selector, opts = {}) {
    if (!window.jQuery || !$.fn.select2) return;
    const $el = $(selector);
    if (!$el.length) return;
    if ($el.hasClass('select2-hidden-accessible')) $el.select2('destroy');
    $el.select2(Object.assign({
        theme: 'bootstrap-5',
        width: '100%',
        language: {
            noResults: () => 'Sin resultados',
            searching: () => 'Buscando...'
        }
    }, opts));
}
window.initSelect2 = initSelect2;

// Helper: Resolver coordenadas exactas de sedes conocidas o pasadas
function resolverCoordenadasSede(nombre, calle, numero, localidad, lat, lng) {
    if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
        return { lat: parseFloat(lat), lng: parseFloat(lng) };
    }
    const txt = `${nombre || ''} ${calle || ''} ${numero || ''} ${localidad || ''}`.toLowerCase();
    if (txt.includes('gutierrez') || txt.includes('gutiérrez')) {
        return { lat: -41.1415571, lng: -71.3132086 };
    }
    if (txt.includes('mitre')) {
        return { lat: -41.1336564, lng: -71.3078764 };
    }
    if (txt.includes('frey')) {
        return { lat: -41.13452, lng: -71.30553 };
    }
    if (txt.includes('km') || txt.includes('bustillo') || txt.includes('1000')) {
        return { lat: -41.131, lng: -71.325 };
    }
    return null;
}

// Modal y Mapa de Sede con Google Maps & Cómo llegar
window.verMapaDeSede = function(nombre, calle, numero, localidad, lat, lng) {
    const modalEl = document.getElementById('modalVerSedeMapa');
    if (!modalEl) return;

    nombre = nombre || 'Sede de Atención';
    calle = calle || '';
    numero = numero || '';
    localidad = localidad || 'San Carlos de Bariloche';

    const dirPartes = [calle, numero].filter(Boolean).join(' ');
    const dirCompleta = [dirPartes, localidad].filter(Boolean).join(', ') || nombre;
    const coords = resolverCoordenadasSede(nombre, calle, numero, localidad, lat, lng);

    const elNombre = document.getElementById('modal-sede-mapa-nombre');
    const elDir = document.getElementById('modal-sede-mapa-direccion');
    if (elNombre) elNombre.textContent = nombre;
    if (elDir) elDir.textContent = dirCompleta;

    const iframe = document.getElementById('modal-sede-mapa-iframe');
    let embedUrl = '';
    let urlDestino = '';

    if (coords) {
        // Coordenadas exactas garantizan el PIN rojo en Google Maps
        embedUrl = `https://maps.google.com/maps?q=${coords.lat},${coords.lng}&hl=es&z=17&output=embed`;
        urlDestino = `${coords.lat},${coords.lng}`;
    } else {
        const busquedaGoogle = [calle, numero, localidad, 'Argentina'].filter(Boolean).join(', ');
        embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(busquedaGoogle)}&hl=es&z=17&output=embed`;
        urlDestino = encodeURIComponent(busquedaGoogle);
    }

    if (iframe) iframe.src = embedUrl;

    const btnComoLlegar = document.getElementById('modal-sede-mapa-btn-comollegar');
    if (btnComoLlegar) {
        btnComoLlegar.href = `https://www.google.com/maps/dir/?api=1&destination=${urlDestino}`;
    }

    const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    bsModal.show();
};

window.abrirModalSedeDesdeBtn = function(btn) {
    if (!btn) return;
    const nombre = decodeURIComponent(btn.getAttribute('data-nombre') || '');
    const calle = decodeURIComponent(btn.getAttribute('data-calle') || '');
    const numero = decodeURIComponent(btn.getAttribute('data-numero') || '');
    const localidad = decodeURIComponent(btn.getAttribute('data-localidad') || '');
    const lat = btn.getAttribute('data-lat') || '';
    const lng = btn.getAttribute('data-lng') || '';
    verMapaDeSede(nombre, calle, numero, localidad, lat, lng);
};

// Helper: Avatar por defecto según género
function obtenerAvatarDefault(nombre, apellido) {
    const texto = `${nombre || ''} ${apellido || ''}`.trim().toLowerCase();
    
    if (/\bdra\.?\b|\bdoctora\b/.test(texto)) {
        return 'assets/img/avatar_doctora.jpg';
    }
    if (/\bdr\.?\b|\bdoctor\b/.test(texto)) {
        return 'assets/img/avatar_doctor.jpg';
    }

    const primerNombre = (nombre || '').trim().split(' ')[0].toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const nombresFemeninos = new Set([
        'maria', 'ana', 'laura', 'paula', 'sofia', 'florencia', 'julieta', 'camila',
        'valentina', 'carolina', 'mariana', 'andrea', 'claudia', 'patricia', 'natalia',
        'daniela', 'luciana', 'cecilia', 'silvina', 'romina', 'marcela', 'gabriela',
        'silvia', 'veronica', 'monica', 'beatriz', 'mercedes', 'rosario', 'victoria',
        'elena', 'ines', 'teresa', 'susana', 'marta', 'graciela', 'lucia', 'guadalupe',
        'estefania', 'belen', 'micaela', 'agustina', 'antonella', 'valeria', 'sabrina'
    ]);

    if (nombresFemeninos.has(primerNombre)) {
        return 'assets/img/avatar_doctora.jpg';
    }

    const excepcionesMasculinas = new Set(['luca', 'lucas', 'borja', 'bautista', 'sasha']);
    if (primerNombre.endsWith('a') && !excepcionesMasculinas.has(primerNombre)) {
        return 'assets/img/avatar_doctora.jpg';
    }

    return 'assets/img/avatar_doctor.jpg';
}

document.addEventListener('DOMContentLoaded', () => {
    const userJson = localStorage.getItem('user');
    
    // Verificar si el usuario tiene datos básicos locales
    if(!userJson) {
        window.location.href = 'login.php';
        return;
    }

    // Variable global para usar en la vista
    let user = JSON.parse(userJson);

    // Pintar UI inmediatamente con datos locales para evitar parpadeos
    if (document.getElementById('user-name-display')) {
        document.getElementById('user-name-display').textContent = user.nombre || 'Usuario';
    }
    if (document.getElementById('user-role-display')) {
        document.getElementById('user-role-display').textContent = (user.rol || 'paciente').toUpperCase();
    }
    if (user.rol === 'superadmin' || user.rol === 'admin' || user.rol === 'recepcionista') {
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(el => el.classList.remove('d-none'));
    }

    // Consultar al servidor por los datos MÁS RECIENTES (enviando headers para reautenticar si expiró la cookie)
    fetch('backend/api/me.php', {
        headers: {
            'X-Firebase-UID': user.firebase_uid || '',
            'X-User-Email': user.email || ''
        }
    })
        .then(res => {
            if(!res.ok) throw new Error('Sesión no sincronizada');
            return res.json();
        })
        .then(data => {
            if (data && data.user) {
                user = data.user;
                localStorage.setItem('user', JSON.stringify(user));
                
                if (document.getElementById('user-name-display')) {
                    document.getElementById('user-name-display').textContent = user.nombre;
                }
                if (document.getElementById('user-role-display')) {
                    document.getElementById('user-role-display').textContent = user.rol.toUpperCase();
                }

                if (user.rol === 'superadmin' || user.rol === 'admin' || user.rol === 'recepcionista') {
                    const adminElements = document.querySelectorAll('.admin-only');
                    adminElements.forEach(el => el.classList.remove('d-none'));
                }
            }

            // Revisar si hay un turno pendiente tras iniciar sesión
            const turnoPendiente = localStorage.getItem('turno_pendiente');
            if (turnoPendiente) {
                const wizardData = JSON.parse(turnoPendiente);
                
                const cobId = (wizardData.coberturaId && wizardData.coberturaId !== 'particular' && !isNaN(parseInt(wizardData.coberturaId))) ? parseInt(wizardData.coberturaId) : null;
                const plId = (wizardData.planId && !isNaN(parseInt(wizardData.planId))) ? parseInt(wizardData.planId) : null;

                fetch('backend/api/save_turno.php', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        medico_id: wizardData.medicoId,
                        especialidad_id: wizardData.especialidadId,
                        cobertura_id: cobId,
                        plan_id: plId,
                        unidad_id: wizardData.unidadId || null,
                        fecha: wizardData.fecha,
                        hora: wizardData.hora,
                        firebase_uid: user ? (user.firebase_uid || user.uid || null) : null,
                        email: user ? user.email : null
                    })
                })
                .then(async res => {
                    const saveRes = await res.json().catch(() => ({}));
                    if (!res.ok || saveRes.status === 'error') {
                        throw new Error(saveRes.message || 'Error al guardar el turno');
                    }
                    return saveRes;
                })
                .then(saveRes => {
                    const sedeStr = wizardData.sedeNombre ? `\nSede: ${wizardData.sedeNombre}` : '';
                    alert(`¡Turno reservado exitosamente!\n\nMédico: ${wizardData.medicoNombre}\nEspecialidad: ${wizardData.especialidadNombre}\nFecha: ${wizardData.fecha}\nHora: ${wizardData.hora}${sedeStr}\nCobertura: ${wizardData.coberturaNombre} ${wizardData.planNombre ? '- '+wizardData.planNombre : ''}`);
                    localStorage.removeItem('turno_pendiente');
                    cargarMisTurnos();
                })
                .catch(err => {
                    console.error("Error guardando turno pendiente", err);
                    alert("No se pudo reservar el turno pendiente: " + err.message);
                    localStorage.removeItem('turno_pendiente');
                    cargarMisTurnos();
                });
            }
        })
        .catch((err) => {
            // No desloguear si ya tenemos usuario en localStorage
            console.warn('Sesión offline o temporalmente no sincronizada con el backend:', err);
        });

    const menuDashboard = document.getElementById('menu-dashboard');
    const menuUsuarios = document.getElementById('menu-usuarios');
    const menuObras = document.getElementById('menu-obras');
    const menuAgendaAdmin = document.getElementById('menu-agenda-admin');
    const menuMedicos = document.getElementById('menu-medicos');
    const menuTurnos = document.getElementById('menu-turnos');
    const menuConfiguracion = document.getElementById('menu-configuracion');
    
    const contentDashboard = document.getElementById('content-dashboard');
    const contentUsuarios = document.getElementById('content-usuarios');
    const contentObras = document.getElementById('content-obras');
    const contentAgendaAdmin = document.getElementById('content-agenda-admin');
    const contentMedicos = document.getElementById('content-medicos');
    const contentTurnos = document.getElementById('content-turnos');
    const contentConfiguracion = document.getElementById('content-configuracion');

    // Función auxiliar para cambiar vistas
    function mostrarVista(vistaActiva, menuActivo, titulo) {
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        if(menuActivo) menuActivo.classList.add('active');
        
        contentDashboard.classList.add('d-none');
        if(contentUsuarios) contentUsuarios.classList.add('d-none');
        if(contentObras) contentObras.classList.add('d-none');
        if(contentAgendaAdmin) contentAgendaAdmin.classList.add('d-none');
        if(contentMedicos) contentMedicos.classList.add('d-none');
        if(contentTurnos) contentTurnos.classList.add('d-none');
        if(contentConfiguracion) contentConfiguracion.classList.add('d-none');
        
        if(vistaActiva) vistaActiva.classList.remove('d-none');
        document.getElementById('page-title').textContent = titulo || 'Clínica Médica';
    }

    // Lógica de Vistas (Navegación Sidebar)
    menuDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        mostrarVista(contentDashboard, menuDashboard, `Bienvenido, ${user.nombre}`);
    });

    if(menuUsuarios) {
        menuUsuarios.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarVista(contentUsuarios, menuUsuarios, 'Gestión de Usuarios');
            cargarUsuarios();
            cargarEspecialidades();
        });
    }

    if(menuObras) {
        menuObras.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarVista(contentObras, menuObras, 'Obras Sociales');
            cargarObrasSociales();
        });
    }

    if(menuAgendaAdmin) {
        menuAgendaAdmin.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarVista(contentAgendaAdmin, menuAgendaAdmin, 'Agenda y Horarios');
            cargarSedes();

            const sel = document.getElementById('agenda-admin-medico-select');

            fetch('backend/api/admin_get_medicos.php')
                .then(res => res.json())
                .then(medicos => {
                    medicos = Array.isArray(medicos) ? medicos : [];
                    window._medicosParaAgenda = medicos;

                    // Si el usuario es médico, mostramos directamente sus horarios
                    if (user.rol === 'medico') {
                        document.getElementById('agenda-admin-selector-container').classList.add('d-none');
                        document.getElementById('agenda-admin-editor-card').classList.remove('d-none');
                        const miMedico = medicos.find(m => m.id == user.id);
                        if (miMedico) cargarHorariosEnEditorInline(miMedico);
                        return;
                    }

                    // Admin / recepcionista: select de profesionales con Select2
                    document.getElementById('agenda-admin-selector-container').classList.remove('d-none');
                    document.getElementById('agenda-admin-editor-card').classList.add('d-none');

                    sel.innerHTML = '<option value=""></option>';
                    medicos.forEach(m => {
                        const esp = m.especialidad_nombre ? ` — ${m.especialidad_nombre}` : '';
                        const opt = document.createElement('option');
                        opt.value = m.id;
                        opt.textContent = nombreCompletoMedico(m) + esp;
                        sel.appendChild(opt);
                    });

                    initSelect2('#agenda-admin-medico-select', {
                        placeholder: '-- Selecciona un profesional --',
                        allowClear: true
                    });
                })
                .catch(() => {
                    if (sel) sel.innerHTML = '<option value="">Error al cargar profesionales</option>';
                });
        });
    }

    // Al seleccionar un médico en el panel de Agenda (Select2 dispara el evento vía jQuery)
    $('#agenda-admin-medico-select').on('change', function() {
        if (!this.value) {
            document.getElementById('agenda-admin-editor-card').classList.add('d-none');
            return;
        }
        const med = (window._medicosParaAgenda || []).find(m => m.id == this.value);
        if (med) {
            document.getElementById('agenda-admin-editor-card').classList.remove('d-none');
            cargarHorariosEnEditorInline(med);
        }
    });

    if(menuMedicos) {
        menuMedicos.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarVista(contentMedicos, menuMedicos, 'Gestión de Médicos');
            cargarMedicosAdmin();
            cargarSedes(); // Necesario para el modal de Horarios
        });
    }

    if(menuConfiguracion) {
        menuConfiguracion.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarVista(contentConfiguracion, menuConfiguracion, 'Configuración del Sistema');
            cargarConfiguracion();
            cargarSedes();
        });
    }

    if(menuTurnos) {
        menuTurnos.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarVista(contentTurnos, menuTurnos, 'Mis Turnos');
            cargarMisTurnos();
        });
    }

    // Lógica Cerrar Sesión
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        try {
            fetch('backend/api/logout.php').catch(() => {});
        } catch(err) {}

        localStorage.removeItem('user');
        localStorage.removeItem('turno_pendiente');

        if (typeof auth !== 'undefined' && auth && auth.signOut) {
            auth.signOut().then(() => {
                window.location.href = 'index.php';
            }).catch(() => {
                window.location.href = 'index.php';
            });
        } else {
            window.location.href = 'index.php';
        }
    });

    // Carga inicial del contador y datos de apoyo
    cargarMisTurnos();
    cargarSedes();
});

function cargarMisTurnos() {
    const container = document.getElementById('mis-turnos-container');
    container.innerHTML = `
        <div class="text-center text-muted py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Cargando...</span>
            </div>
            <p class="mt-2">Cargando tus turnos...</p>
        </div>
    `;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const params = new URLSearchParams();
    if (user.firebase_uid) params.append('firebase_uid', user.firebase_uid);
    if (user.email) params.append('email', user.email);
    const fuidParam = params.toString() ? `?${params.toString()}` : '';

    fetch(`backend/api/get_mis_turnos.php${fuidParam}`, { credentials: 'same-origin' })
        .then(async res => {
            const data = await res.json().catch(() => []);
            return data;
        })
        .then(data => {
            const contadorEl = document.getElementById('contador-proximos-turnos');
            if (contadorEl) {
                const cant = (data && Array.isArray(data)) ? data.filter(t => t.estado !== 'cancelado').length : 0;
                contadorEl.textContent = cant;
            }

            if(!data || data.length === 0 || data.message) {
                container.innerHTML = `
                    <div class="alert alert-info rounded-4 shadow-sm border-0 d-flex align-items-center" role="alert">
                        <i class="bi bi-info-circle-fill fs-4 me-3"></i>
                        <div>Todavía no hay turnos programados. Haz clic en "Solicitar Turno" para agendar uno.</div>
                    </div>
                `;
                return;
            }

            let html = '<div class="row g-4">';
            data.forEach(turno => {
                // Formatear fecha (YYYY-MM-DD a DD/MM/YYYY)
                const partes = turno.fecha.split('-');
                const fechaFormat = `${partes[2]}/${partes[1]}/${partes[0]}`;
                
                // Formatear hora (HH:MM:SS a HH:MM)
                const horaFormat = turno.hora_inicio.substring(0, 5);

                let badgeColor = 'bg-warning';
                if(turno.estado === 'confirmado') badgeColor = 'bg-success';
                if(turno.estado === 'cancelado') badgeColor = 'bg-danger';

                let coberturaText = 'Particular';
                if(turno.obra_social_nombre) {
                    coberturaText = turno.obra_social_nombre;
                    if(turno.plan_nombre) coberturaText += ' - ' + turno.plan_nombre;
                }

                const pacienteInfo = turno.paciente_nombre ? `
                    <div class="mb-2 text-primary small">
                        <i class="bi bi-person-fill me-1"></i> Paciente: <strong>${turno.paciente_nombre} ${turno.paciente_apellido || ''}</strong>
                    </div>
                ` : '';

                html += `
                    <div class="col-md-6 col-lg-4">
                        <div class="card h-100 border-0 shadow-sm rounded-4 overflow-hidden position-relative">
                            <div class="card-body p-4">
                                <div class="d-flex justify-content-between align-items-start mb-3">
                                    <h5 class="fw-bold mb-0 text-primary">
                                        <i class="bi bi-calendar-check me-2"></i>${fechaFormat}
                                    </h5>
                                    <span class="badge ${badgeColor} rounded-pill px-3 py-2 text-uppercase" style="font-size: 0.7rem;">
                                        ${turno.estado}
                                    </span>
                                </div>
                                
                                <div class="fs-4 fw-light mb-3">
                                    <i class="bi bi-clock me-2 text-muted fs-5"></i>${horaFormat} hs
                                </div>
                                
                                <hr class="opacity-10 my-3">
                                
                                ${pacienteInfo}

                                <div class="mb-2">
                                    <i class="bi bi-person-badge text-muted me-2"></i>
                                    <span class="fw-semibold">Dr/a. ${turno.medico_nombre} ${turno.medico_apellido}</span>
                                </div>
                                
                                <div class="mb-2">
                                    <i class="bi bi-heart-pulse text-muted me-2"></i>
                                    <span>${turno.especialidad_nombre}</span>
                                </div>

                                ${turno.sede_nombre ? `
                                <div class="mb-2">
                                    <i class="bi bi-geo-alt text-primary me-2"></i>
                                    <span class="text-primary fw-medium small">${turno.sede_nombre}${turno.sede_calle ? ' (' + turno.sede_calle + (turno.sede_numero ? ' ' + turno.sede_numero : '') + ')' : ''}</span>
                                </div>` : ''}
                                
                                <div>
                                    <i class="bi bi-shield-check text-muted me-2"></i>
                                    <span class="text-muted small">${coberturaText}</span>
                                </div>
                                ${(() => {
                                    if (!turno.creado_en) return '';
                                    const dCreacion = new Date(turno.creado_en.replace(' ', 'T'));
                                    if (isNaN(dCreacion.getTime())) return '';
                                    const diaC = String(dCreacion.getDate()).padStart(2, '0');
                                    const mesC = String(dCreacion.getMonth() + 1).padStart(2, '0');
                                    const anioC = dCreacion.getFullYear();
                                    const horaC = String(dCreacion.getHours()).padStart(2, '0');
                                    const minC = String(dCreacion.getMinutes()).padStart(2, '0');
                                    return `
                                        <div class="mt-3 pt-2 border-top text-muted d-flex align-items-center" style="font-size:0.75rem;">
                                            <i class="bi bi-clock-history me-1 text-primary"></i> Turno sacado el ${diaC}/${mesC}/${anioC} a las ${horaC}:${minC} hs
                                        </div>
                                    `;
                                })()}
                            </div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        })
        .catch(err => {
            console.error("Error al cargar mis turnos:", err);
            container.innerHTML = `
                <div class="alert alert-danger rounded-4 shadow-sm border-0 d-flex align-items-center" role="alert">
                    <i class="bi bi-exclamation-triangle-fill fs-4 me-3"></i>
                    <div>Ocurrió un error al cargar tus turnos.</div>
                </div>
            `;
        });
}

let usuariosDisponibles = [];
let especialidadesDisponibles = [];
let sedesDisponibles = [];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function safeImageUrl(value, fallback) { try { const u = new URL(String(value || fallback || ''), location.href); return ['http:','https:'].includes(u.protocol) ? u.href : fallback; } catch (_) { return fallback; } }

// ==========================================
// GESTIÓN DE PACIENTES (USUARIOS)
// ==========================================
function cargarUsuarios() {
    const tbody = document.getElementById('tabla-usuarios');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm me-2"></span>Cargando pacientes...</td></tr>';

    fetch('backend/api/get_users.php')
        .then(res => res.json())
        .then(data => {
            if(data.usuarios) {
                usuariosDisponibles = data.usuarios;
                renderUsuarios(usuariosDisponibles);
            } else {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">${escapeHtml(data.message || 'Error al cargar pacientes')}</td></tr>`;
            }
        })
        .catch(err => {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Error de conexión al cargar pacientes</td></tr>`;
        });
}

function renderUsuarios(usuarios) {
    const tbody = document.getElementById('tabla-usuarios');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if(usuarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No se encontraron pacientes registrados.</td></tr>';
        return;
    }

    usuarios.forEach(u => {
        const nombreCompleto = escapeHtml(`${u.nombre || ''} ${u.apellido || ''}`.trim() || 'Sin Nombre');
        const inicial = escapeHtml((u.nombre ? u.nombre.charAt(0) : 'P').toUpperCase());
        
        let fechaNacFmt = '<span class="text-muted small fst-italic">Sin cargar</span>';
        if (u.fecha_nacimiento) {
            const parts = u.fecha_nacimiento.split('-');
            if (parts.length === 3) {
                fechaNacFmt = `<span class="fw-semibold text-secondary">${parts[2]}/${parts[1]}/${parts[0]}</span>`;
            } else {
                fechaNacFmt = escapeHtml(u.fecha_nacimiento);
            }
        }

        const dniHtml = u.dni 
            ? `<span class="fw-bold text-dark">${escapeHtml(u.dni)}</span>`
            : `<span class="text-muted small fst-italic">Sin DNI</span>`;

        const osHtml = u.obra_social_nombre 
            ? `<span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1"><i class="bi bi-shield-check me-1"></i>${escapeHtml(u.obra_social_nombre)}</span>`
            : `<span class="badge bg-light text-muted border px-2 py-1">Particular</span>`;

        const planHtml = u.plan_nombre 
            ? `<span class="badge bg-secondary-subtle text-dark border px-2 py-1">${escapeHtml(u.plan_nombre)}</span>`
            : `<span class="text-muted small">-</span>`;

        let telHtml = '<span class="text-muted small fst-italic">Sin teléfono</span>';
        if (u.telefono) {
            const cleanTel = u.telefono.replace(/[^0-9]/g, '');
            telHtml = `
                <a href="https://wa.me/${cleanTel}" target="_blank" class="btn btn-sm btn-outline-success rounded-pill px-2 py-1 text-nowrap fw-semibold shadow-sm" title="Contactar por WhatsApp">
                    <i class="bi bi-whatsapp me-1"></i>${escapeHtml(u.telefono)}
                </a>
            `;
        }

        const emailHtml = u.email 
            ? `<span class="text-muted small">${escapeHtml(u.email)}</span>`
            : `<span class="text-muted small fst-italic">-</span>`;

        const row = `
            <tr>
                <td class="ps-4">
                    <div class="d-flex align-items-center">
                        <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-3 shadow-sm flex-shrink-0" style="width: 38px; height: 38px; font-weight: 700; font-size: 0.95rem;">
                            ${inicial}
                        </div>
                        <div>
                            <div class="fw-bold text-dark">${nombreCompleto}</div>
                            <div class="text-muted small">ID: #${parseInt(u.id, 10) || 0}</div>
                        </div>
                    </div>
                </td>
                <td>${dniHtml}</td>
                <td>${fechaNacFmt}</td>
                <td>${osHtml}</td>
                <td>${planHtml}</td>
                <td>${telHtml}</td>
                <td>${emailHtml}</td>
                <td class="pe-4 text-end text-nowrap">
                    <button class="btn btn-sm btn-outline-primary rounded-circle me-1" onclick="abrirEditarUsuario(${parseInt(u.id, 10) || 0})" title="Editar paciente">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger rounded-circle" onclick="borrarUsuario(${parseInt(u.id, 10) || 0})" title="Eliminar paciente">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function filtrarUsuarios() {
    const searchVal = document.getElementById('search-usuarios')?.value.toLowerCase() || '';
    const searchDni = searchVal.replace(/\D/g, '');

    const filtrados = usuariosDisponibles.filter(u => {
        const nombreCompleto = `${u.nombre || ''} ${u.apellido || ''}`.toLowerCase();
        const email = (u.email || '').toLowerCase();
        const dni = (u.dni || '').replace(/\D/g, '');
        const tel = (u.telefono || '').toLowerCase();
        const os = (u.obra_social_nombre || '').toLowerCase();
        const plan = (u.plan_nombre || '').toLowerCase();
        
        return nombreCompleto.includes(searchVal) || 
               email.includes(searchVal) || 
               (searchDni !== '' && dni.includes(searchDni)) ||
               tel.includes(searchVal) || 
               os.includes(searchVal) ||
               plan.includes(searchVal);
    });

    renderUsuarios(filtrados);
}

document.getElementById('search-usuarios')?.addEventListener('input', filtrarUsuarios);

// Cargar opciones de Obras Sociales en modales de paciente
function poblarSelectObrasSociales(selectId, selectedId = null, onComplete = null) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    fetch('backend/api/crud_obras_sociales.php')
        .then(res => res.json())
        .then(data => {
            sel.innerHTML = '<option value="">Particular / Sin Cobertura</option>';
            if (Array.isArray(data)) {
                data.forEach(os => {
                    const isSel = selectedId && (selectedId == os.id) ? 'selected' : '';
                    sel.innerHTML += `<option value="${parseInt(os.id,10)||0}" ${isSel}>${escapeHtml(os.nombre)}</option>`;
                });
            }
            if (onComplete) onComplete();
        })
        .catch(() => {
            if (onComplete) onComplete();
        });
}

// Cargar opciones de Planes según la Obra Social seleccionada
function actualizarSelectPlanes(osSelectId, planSelectId, selectedPlanId = null) {
    const osSelect = document.getElementById(osSelectId);
    const planSelect = document.getElementById(planSelectId);
    if (!osSelect || !planSelect) return;

    const osId = osSelect.value;
    if (!osId) {
        planSelect.innerHTML = '<option value="">Particular / Sin Plan</option>';
        planSelect.disabled = true;
        return;
    }

    planSelect.disabled = true;
    planSelect.innerHTML = '<option value="">Cargando planes...</option>';

    fetch(`backend/api/get_planes.php?obra_social_id=${osId}`)
        .then(res => res.json())
        .then(planes => {
            planSelect.innerHTML = '<option value="">Sin plan específico</option>';
            if (Array.isArray(planes) && planes.length > 0) {
                planes.forEach(p => {
                    const isSel = selectedPlanId && (selectedPlanId == p.id) ? 'selected' : '';
                    planSelect.innerHTML += `<option value="${parseInt(p.id,10)||0}" ${isSel}>${escapeHtml(p.nombre)}</option>`;
                });
            }
            planSelect.disabled = false;
        })
        .catch(() => {
            planSelect.innerHTML = '<option value="">Error al cargar planes</option>';
            planSelect.disabled = false;
        });
}

// Eventos de cambio en Obra Social para modales de paciente
document.getElementById('nuevo-paciente-os')?.addEventListener('change', function() {
    actualizarSelectPlanes('nuevo-paciente-os', 'nuevo-paciente-plan', null);
});

document.getElementById('edit-paciente-os')?.addEventListener('change', function() {
    actualizarSelectPlanes('edit-paciente-os', 'edit-paciente-plan', null);
});

// Modal Nuevo Paciente: resetear y cargar listas
const modalCrearPacEl = document.getElementById('modalCrearPaciente');
if (modalCrearPacEl) {
    modalCrearPacEl.addEventListener('show.bs.modal', () => {
        document.getElementById('form-crear-paciente').reset();
        poblarSelectObrasSociales('nuevo-paciente-os', null, () => {
            actualizarSelectPlanes('nuevo-paciente-os', 'nuevo-paciente-plan', null);
        });
    });
}

// Formulario Crear Paciente: submit
document.getElementById('form-crear-paciente')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-guardar-paciente');
    if (btn) btn.disabled = true;

    const data = {
        nombre: document.getElementById('nuevo-paciente-nombre').value.trim(),
        apellido: document.getElementById('nuevo-paciente-apellido').value.trim(),
        dni: document.getElementById('nuevo-paciente-dni').value.trim(),
        fecha_nacimiento: document.getElementById('nuevo-paciente-fnac').value || null,
        telefono: document.getElementById('nuevo-paciente-telefono').value.trim(),
        email: document.getElementById('nuevo-paciente-email').value.trim(),
        obra_social_id: document.getElementById('nuevo-paciente-os').value || null,
        plan_id: document.getElementById('nuevo-paciente-plan').value || null
    };

    fetch('backend/api/users.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(resp => {
        if (resp.status === 'success') {
            alert('Paciente registrado exitosamente.');
            const modalInstance = bootstrap.Modal.getInstance(document.getElementById('modalCrearPaciente'));
            if (modalInstance) modalInstance.hide();
            cargarUsuarios();
        } else {
            alert('Error: ' + (resp.message || 'No se pudo guardar el paciente'));
        }
    })
    .catch(err => {
        alert('Error de conexión al guardar paciente');
    })
    .finally(() => {
        if (btn) btn.disabled = false;
    });
});

// Abrir Modal Editar Paciente
function abrirEditarUsuario(id) {
    const u = usuariosDisponibles.find(x => x.id == id);
    if (!u) return;

    document.getElementById('edit-paciente-id').value = u.id;
    document.getElementById('edit-paciente-nombre').value = u.nombre || '';
    document.getElementById('edit-paciente-apellido').value = u.apellido || '';
    document.getElementById('edit-paciente-dni').value = u.dni || '';
    document.getElementById('edit-paciente-fnac').value = u.fecha_nacimiento || '';
    document.getElementById('edit-paciente-telefono').value = u.telefono || '';
    document.getElementById('edit-paciente-email').value = u.email || '';

    poblarSelectObrasSociales('edit-paciente-os', u.obra_social_id, () => {
        actualizarSelectPlanes('edit-paciente-os', 'edit-paciente-plan', u.plan_id);
    });

    new bootstrap.Modal(document.getElementById('modalEditarPaciente')).show();
}

// Formulario Editar Paciente: submit
document.getElementById('form-editar-paciente')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const id = document.getElementById('edit-paciente-id').value;
    const data = {
        id: id,
        nombre: document.getElementById('edit-paciente-nombre').value.trim(),
        apellido: document.getElementById('edit-paciente-apellido').value.trim(),
        dni: document.getElementById('edit-paciente-dni').value.trim(),
        fecha_nacimiento: document.getElementById('edit-paciente-fnac').value || null,
        telefono: document.getElementById('edit-paciente-telefono').value.trim(),
        email: document.getElementById('edit-paciente-email').value.trim(),
        obra_social_id: document.getElementById('edit-paciente-os').value || null,
        plan_id: document.getElementById('edit-paciente-plan').value || null
    };

    fetch('backend/api/users.php', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(resp => {
        if (resp.status === 'success') {
            alert('Datos del paciente actualizados exitosamente.');
            const modalInstance = bootstrap.Modal.getInstance(document.getElementById('modalEditarPaciente'));
            if (modalInstance) modalInstance.hide();
            cargarUsuarios();
        } else {
            alert('Error: ' + (resp.message || 'No se pudo actualizar el paciente'));
        }
    })
    .catch(err => {
        alert('Error de conexión al actualizar paciente');
    });
});

// Eliminar Paciente
function borrarUsuario(id) {
    const u = usuariosDisponibles.find(x => x.id == id);
    const nom = u ? `${u.nombre} ${u.apellido || ''}`.trim() : `ID #${id}`;
    if (!confirm(`¿Estás seguro de eliminar al paciente "${nom}"? Esta acción no se puede deshacer.`)) return;

    fetch('backend/api/users.php', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    })
    .then(res => res.json())
    .then(resp => {
        if (resp.status === 'success') {
            alert('Paciente eliminado correctamente.');
            cargarUsuarios();
        } else {
            alert('Error: ' + (resp.message || 'No se pudo eliminar el paciente'));
        }
    })
    .catch(() => alert('Error de conexión al eliminar paciente'));
}

// ==========================================
// GESTIÓN DE ESPECIALIDADES (CATEGORÍAS)
// ==========================================
function cargarEspecialidades() {
    fetch('backend/api/get_especialidades.php')
        .then(res => res.json())
        .then(data => {
            especialidadesDisponibles = data;
            const tbody = document.getElementById('tabla-especialidades');
            const selectFilter = document.getElementById('filter-especialidades-opts');
            
            tbody.innerHTML = '';
            
            // Llenar tabla de modal
            if(data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">No hay categorías.</td></tr>';
            } else {
                data.forEach(esp => {
                    tbody.innerHTML += `
                        <tr>
                            <td>${escapeHtml(esp.nombre)}</td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-outline-danger" onclick="borrarEspecialidad(${parseInt(esp.id,10)||0})">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
            }

            // Llenar select de filtro de usuarios
            if(selectFilter) {
                selectFilter.innerHTML = '<option value="medico">Todos los Médicos</option>';
                data.forEach(esp => {
                    selectFilter.innerHTML += `<option value="esp_${parseInt(esp.id,10)||0}">${escapeHtml(esp.nombre)}</option>`;
                });
            }
        });
}

document.getElementById('form-crear-especialidad')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const nombre = document.getElementById('new-especialidad-nombre').value;
    
    fetch('backend/api/crud_especialidades.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ nombre })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        document.getElementById('new-especialidad-nombre').value = '';
        cargarEspecialidades();
        cargarUsuarios(); // Refrescar por si impacta algo
    })
    .catch(err => alert('Error al crear especialidad'));
});

function borrarEspecialidad(id) {
    if(!confirm('¿Seguro que deseas eliminar esta categoría?')) return;
    
    fetch('backend/api/crud_especialidades.php', {
        method: 'DELETE',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ id })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        cargarEspecialidades();
    })
    .catch(err => alert('Error al eliminar'));
}

function cambiarRol(userId, nuevoRol) {
    if(!confirm(`¿Estás seguro de cambiar el rol a ${nuevoRol}?`)) {
        cargarUsuarios(); // revertir visualmente
        return;
    }
    
    fetch('backend/api/update_user_role.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: userId, nuevo_rol: nuevoRol })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        cargarUsuarios();
    })
    .catch(err => {
        alert("Error al cambiar rol.");
        cargarUsuarios();
    });
}

// --- Nuevas Funciones Administrativas ---

function crearPersonal() {
    const btn = document.querySelector('#modalCrearUsuario .btn-primary');
    btn.disabled = true;
    
    const data = {
        nombre: document.getElementById('new-nombre').value,
        email: document.getElementById('new-email').value,
        rol: document.getElementById('new-rol').value,
        password: document.getElementById('new-password').value
    };

    if(!data.nombre || !data.email || !data.rol || !data.password) {
        alert("Todos los campos son obligatorios");
        btn.disabled = false;
        return;
    }

    fetch('backend/api/admin_create_user.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        if(data.message.includes('exitosamente')) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalCrearUsuario'));
            modal.hide();
            document.getElementById('form-crear-personal').reset();
            cargarUsuarios();
        }
    })
    .catch(err => alert("Error de conexión"))
    .finally(() => btn.disabled = false);
}

function cargarObrasSociales() {
    const tbody = document.getElementById('tabla-obras');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">Cargando...</td></tr>';
    
    fetch('backend/api/crud_obras_sociales.php')
        .then(res => res.json())
        .then(data => {
            tbody.innerHTML = '';
            if(data && data.length > 0) {
                let html = '';
                data.forEach(obra => {
                    const cantPlanes = parseInt(obra.total_planes || 0);
                    const badgeClass = cantPlanes > 0 ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-secondary-subtle text-muted';
                    const badgeText = cantPlanes === 1 ? '1 plan' : `${cantPlanes} planes`;

                    html += `
                        <tr>
                            <td class="ps-4 fw-bold text-muted">#${obra.id}</td>
                            <td class="fw-semibold">${obra.nombre}</td>
                            <td>
                                <span class="badge ${badgeClass} rounded-pill px-2.5 py-1">
                                    <i class="bi bi-layers me-1"></i>${badgeText}
                                </span>
                            </td>
                            <td class="pe-4 text-end">
                                <button class="btn btn-sm btn-outline-info rounded-pill px-3 me-1" onclick="abrirGestionPlanes(${obra.id}, '${obra.nombre.replace(/'/g, "\\'")}')"><i class="bi bi-card-list me-1"></i> Planes</button>
                                <button class="btn btn-sm btn-outline-primary rounded-circle me-1" onclick="editarObraSocial(${obra.id}, '${obra.nombre.replace(/'/g, "\\'")}')" title="Editar"><i class="bi bi-pencil"></i></button>
                                <button class="btn btn-sm btn-outline-danger rounded-circle" onclick="eliminarObraSocial(${obra.id})" title="Eliminar"><i class="bi bi-trash"></i></button>
                            </td>
                        </tr>
                    `;
                });
                tbody.innerHTML = html;
                
                // Initialize DataTables
                if ($.fn.DataTable.isDataTable('#obras-table')) {
                    $('#obras-table').DataTable().destroy();
                }
                $('#obras-table').DataTable({
                    language: { url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
                    pageLength: 10
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">No hay obras sociales cargadas.</td></tr>';
            }
        })
        .catch(err => {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-danger">Error de conexión</td></tr>';
        });
}

function editarObraSocial(id, nombreActual) {
    const nuevoNombre = prompt('Editar nombre de la obra social:', nombreActual);
    if (!nuevoNombre || nuevoNombre.trim() === '' || nuevoNombre.trim() === nombreActual) return;

    fetch('backend/api/crud_obras_sociales.php', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id, nombre: nuevoNombre.trim() })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message || 'Obra social actualizada');
        cargarObrasSociales();
    })
    .catch(() => alert('Error de conexión'));
}

function eliminarObraSocial(id) {
    if (!confirm('¿Estás seguro de eliminar esta obra social? Se eliminarán también sus planes asociados.')) return;

    fetch('backend/api/crud_obras_sociales.php', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message || 'Obra social eliminada');
        cargarObrasSociales();
    })
    .catch(() => alert('Error de conexión'));
}

// --- Lógica del Paciente (Solicitar Turno - UX Rediseñada) ---
const modalTurno = document.getElementById('modalNuevoTurno');
if(modalTurno) {
    modalTurno.addEventListener('show.bs.modal', () => {
        // Reset state
        document.getElementById('step-2').classList.add('d-none');
        document.getElementById('step-3').classList.add('d-none');
        document.getElementById('btn-confirmar-turno').classList.add('d-none');
        document.getElementById('turno-plan').value = '';
        document.getElementById('turno-fecha').value = '';
        document.getElementById('turno-hora').value = '';
        document.getElementById('planes-container').innerHTML = '';
        document.getElementById('dias-container').innerHTML = '';
        document.getElementById('horarios-list').innerHTML = '';
        
        // Cargar Especialidades
        fetch('backend/api/get_especialidades.php')
            .then(res => res.json())
            .then(data => {
                const sel = document.getElementById('turno-especialidad');
                sel.innerHTML = '<option value="" selected disabled>Selecciona especialidad...</option>';
                data.forEach(e => {
                    sel.innerHTML += `<option value="${parseInt(e.id,10)||0}">${escapeHtml(e.nombre)}</option>`;
                });
            });

        // No cargar Obras Sociales hasta elegir médico para filtrar (opcional), 
        // pero por ahora cargamos todas o las permitidas por el médico
        fetch('backend/api/crud_obras_sociales.php')
            .then(res => res.json())
            .then(data => {
                const sel = document.getElementById('turno-obra-social');
                sel.innerHTML = '<option value="" selected disabled>Selecciona tu cobertura médica...</option>';
                sel.innerHTML += '<option value="particular">Particular (Sin Obra Social)</option>';
                data.forEach(o => {
                    sel.innerHTML += `<option value="${parseInt(o.id,10)||0}">${escapeHtml(o.nombre)}</option>`;
                });
            });

        // Select2 del médico (dropdownParent es necesario dentro de un modal de Bootstrap)
        initSelect2('#turno-medico', {
            dropdownParent: $('#modalNuevoTurno'),
            placeholder: 'Selecciona un profesional...'
        });
    });

    // Cambio de Especialidad -> Cargar Médicos
    document.getElementById('turno-especialidad').addEventListener('change', (e) => {
        const espId = e.target.value;
        const medicoSel = document.getElementById('turno-medico');
        medicoSel.disabled = true;
        medicoSel.innerHTML = '<option value="" selected disabled>Cargando profesionales...</option>';

        fetch(`backend/api/get_medicos.php?especialidad_id=${espId}`)
            .then(res => res.json())
            .then(data => {
                medicoSel.innerHTML = '<option value="" selected disabled>Selecciona un profesional...</option>';
                if(data.length > 0) {
                    data.forEach(m => {
                        medicoSel.innerHTML += `<option value="${parseInt(m.id,10)||0}">${escapeHtml(nombreCompletoMedico(m))}</option>`;
                    });
                    medicoSel.disabled = false;
                } else {
                    medicoSel.innerHTML = '<option value="" selected disabled>No hay profesionales disponibles.</option>';
                }
                initSelect2('#turno-medico', { dropdownParent: $('#modalNuevoTurno') });
            });
    });

    // Cambio de Médico -> Mostrar Paso 2 (Select2 dispara el evento vía jQuery)
    $('#turno-medico').on('change', function() {
        document.getElementById('step-2').classList.remove('d-none');
        document.getElementById('turno-obra-social').value = '';
        document.getElementById('planes-container').classList.add('d-none');
        document.getElementById('step-3').classList.add('d-none');
    });
            
    // Cambio de Obra Social -> Cargar Planes (Pills)
    document.getElementById('turno-obra-social').addEventListener('change', (e) => {
        const osId = e.target.value;
        const planesContainer = document.getElementById('planes-container');
        const inputPlan = document.getElementById('turno-plan');
        
        planesContainer.innerHTML = '';
        planesContainer.classList.remove('d-none');
        inputPlan.value = '';
        document.getElementById('step-3').classList.add('d-none');
        
        if (osId === 'particular') {
            inputPlan.value = 'particular';
            renderPill(planesContainer, 'Particular', 'particular', inputPlan, () => showStep3());
            return;
        }
        
        planesContainer.innerHTML = '<span class="text-muted small spinner-border spinner-border-sm"></span>';
        
        fetch(`backend/api/get_planes.php?obra_social_id=${osId}`)
            .then(res => res.json())
            .then(data => {
                planesContainer.innerHTML = '';
                if(data.length > 0) {
                    data.forEach(p => {
                        renderPill(planesContainer, p.nombre, p.id, inputPlan, () => showStep3());
                    });
                } else {
                    inputPlan.value = 'unico';
                    renderPill(planesContainer, 'Plan Único', 'unico', inputPlan, () => showStep3());
                }
            });
    });

    // Renderiza un botón píldora simple y maneja su estado activo
    function renderPill(container, label, value, hiddenInput, onClickCallback = null) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pill-btn';
        if (hiddenInput.value == value) btn.classList.add('active');
        btn.textContent = label;
        btn.dataset.value = value;
        
        btn.addEventListener('click', () => {
            // Deseleccionar hermanos
            container.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            hiddenInput.value = value;
            if(onClickCallback) onClickCallback(value);
        });
        
        container.appendChild(btn);
    }

    // Mostrar Paso 3 (Calendario) y renderizar Días simulados
    function showStep3() {
        document.getElementById('step-3').classList.remove('d-none');
        const diasContainer = document.getElementById('dias-container');
        const inputFecha = document.getElementById('turno-fecha');
        diasContainer.innerHTML = '';
        inputFecha.value = '';
        
        // Simular próximos 14 días
        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const hoy = new Date();
        
        for(let i = 1; i <= 14; i++) {
            const d = new Date();
            d.setDate(hoy.getDate() + i);
            
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const slots = isWeekend ? 0 : Math.floor(Math.random() * 8) + 2; // de 2 a 9 turnos en la semana
            
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `pill-btn calendar-pill ${slots === 0 ? 'disabled' : ''}`;
            if(slots === 0) btn.disabled = true;
            
            const diaNombre = diasSemana[d.getDay()];
            const diaNum = d.getDate();
            const dateStr = d.toISOString().split('T')[0];
            
            btn.innerHTML = `
                <span class="pill-date">${diaNombre} ${diaNum}</span>
                <span class="pill-slots">${slots === 0 ? '(sin horarios)' : `(${slots} horarios)`}</span>
            `;
            
            if(slots > 0) {
                btn.addEventListener('click', () => {
                    diasContainer.querySelectorAll('.calendar-pill').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    inputFecha.value = dateStr;
                    showHorarios(slots);
                });
            }
            diasContainer.appendChild(btn);
        }
    }

    // Mostrar las horas para un día seleccionado
    function showHorarios(numSlots) {
        const c = document.getElementById('horarios-container');
        const list = document.getElementById('horarios-list');
        const inputHora = document.getElementById('turno-hora');
        const btnSubmit = document.getElementById('btn-confirmar-turno');
        
        c.classList.remove('d-none');
        list.innerHTML = '';
        inputHora.value = '';
        btnSubmit.classList.add('d-none');
        
        let horaBase = 9; // Empiezan 9 AM
        for(let i=0; i<numSlots; i++) {
            const h = horaBase + Math.floor(i/2);
            const m = (i%2 === 0) ? '00' : '30';
            const horaStr = `${h.toString().padStart(2, '0')}:${m}`;
            
            renderPill(list, horaStr, horaStr, inputHora, () => {
                btnSubmit.classList.remove('d-none'); // Mostrar botón confirmar
            });
        }
    }
}

// --- Modal Crear Obra Social ---
function toggleTipoPlanCreacion() {
    const radioUnico = document.getElementById('plan_tipo_unico');
    const isUnico = radioUnico ? radioUnico.checked : true;
    const cUnico = document.getElementById('container-plan-unico');
    const cMultiples = document.getElementById('container-planes-multiples');
    const lista = document.getElementById('lista-inputs-planes');

    if (cUnico && cMultiples) {
        if (isUnico) {
            cUnico.classList.remove('d-none');
            cMultiples.classList.add('d-none');
        } else {
            cUnico.classList.add('d-none');
            cMultiples.classList.remove('d-none');
            if (lista && lista.children.length === 0) {
                agregarInputPlanModal('Plan 1');
                agregarInputPlanModal('Plan 2');
            }
        }
    }
}

function agregarInputPlanModal(valor = '') {
    const lista = document.getElementById('lista-inputs-planes');
    if (!lista) return;
    const div = document.createElement('div');
    div.className = 'input-group input-group-sm plan-item-row';
    div.innerHTML = `
        <input type="text" class="form-control input-plan-item" placeholder="Nombre del plan (ej: Plan 210, Plan Plata...)" value="${valor ? valor.replace(/"/g, '&quot;') : ''}" required>
        <button class="btn btn-outline-danger" type="button" onclick="removerFilaPlan(this)" title="Quitar plan">
            <i class="bi bi-trash"></i>
        </button>
    `;
    lista.appendChild(div);
}

function removerFilaPlan(btn) {
    const lista = document.getElementById('lista-inputs-planes');
    if (!lista) return;
    if (lista.children.length > 1) {
        btn.closest('.plan-item-row').remove();
    } else {
        alert('Debes incluir al menos un plan o seleccionar Plan Único.');
    }
}

const formCrearObra = document.getElementById('form-crear-obra');
if (formCrearObra) {
    formCrearObra.addEventListener('submit', function(e) {
        e.preventDefault();
        const nombreInput = document.getElementById('nueva-obra-nombre');
        const nombre = nombreInput ? nombreInput.value.trim() : '';
        if (!nombre) {
            alert('Por favor, ingresa el nombre de la obra social.');
            return;
        }

        const isUnico = document.getElementById('plan_tipo_unico') ? document.getElementById('plan_tipo_unico').checked : true;
        const btnSubmit = document.getElementById('btn-guardar-obra');
        
        let payload = { nombre: nombre };

        if (isUnico) {
            const planUnicoInput = document.getElementById('nueva-obra-plan-unico');
            const planUnicoNombre = planUnicoInput ? planUnicoInput.value.trim() : 'Plan Único';
            payload.tipo_plan = 'unico';
            payload.plan_unico_nombre = planUnicoNombre || 'Plan Único';
        } else {
            const planInputs = document.querySelectorAll('#lista-inputs-planes .input-plan-item');
            const planes = [];
            planInputs.forEach(inp => {
                const val = inp.value.trim();
                if (val) planes.push(val);
            });

            if (planes.length === 0) {
                alert('Por favor ingresa al menos el nombre de un plan o selecciona Plan Único.');
                return;
            }

            payload.tipo_plan = 'multiples';
            payload.planes = planes;
        }

        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando...';
        }

        fetch('backend/api/crud_obras_sociales.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.id || (data.message && data.message.includes('exitosamente'))) {
                // Cerrar modal
                const modalEl = document.getElementById('modalCrearObra');
                if (modalEl) {
                    const modalInst = bootstrap.Modal.getInstance(modalEl);
                    if (modalInst) modalInst.hide();
                }

                // Reset form
                formCrearObra.reset();
                const planUnico = document.getElementById('nueva-obra-plan-unico');
                if (planUnico) planUnico.value = 'Plan Único';
                const lista = document.getElementById('lista-inputs-planes');
                if (lista) lista.innerHTML = '';
                toggleTipoPlanCreacion();

                // Recargar tabla
                cargarObrasSociales();
            } else {
                alert(data.message || 'Error al crear la obra social.');
            }
        })
        .catch(err => {
            console.error('Error al guardar obra social:', err);
            alert('Error de conexión al guardar obra social.');
        })
        .finally(() => {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = '<i class="bi bi-check-lg me-1"></i> Guardar Obra Social';
            }
        });
    });
}

const modalCrearObraEl = document.getElementById('modalCrearObra');
if (modalCrearObraEl) {
    modalCrearObraEl.addEventListener('show.bs.modal', () => {
        const form = document.getElementById('form-crear-obra');
        if (form) form.reset();
        const radioUnico = document.getElementById('plan_tipo_unico');
        if (radioUnico) radioUnico.checked = true;
        const inputUnico = document.getElementById('nueva-obra-plan-unico');
        if (inputUnico) inputUnico.value = 'Plan Único';
        const lista = document.getElementById('lista-inputs-planes');
        if (lista) lista.innerHTML = '';
        toggleTipoPlanCreacion();
    });
}

// --- Gestión de Planes por Obra Social ---
function abrirGestionPlanes(obraSocialId, obraSocialNombre) {
    document.getElementById('gestion-plan-os-id').value = obraSocialId;
    document.getElementById('modalGestionPlanesTitle').textContent = `Planes de: ${obraSocialNombre}`;
    cargarPlanesAdmin(obraSocialId);
    const modal = new bootstrap.Modal(document.getElementById('modalGestionPlanes'));
    modal.show();
}

function cargarPlanesAdmin(obraSocialId) {
    const tbody = document.getElementById('tabla-planes');
    tbody.innerHTML = '<tr><td colspan="2" class="text-center py-3 text-muted">Cargando planes...</td></tr>';
    
    fetch(`backend/api/crud_planes.php?obra_social_id=${obraSocialId}`)
        .then(res => res.json())
        .then(data => {
            tbody.innerHTML = '';
            if(data.length > 0) {
                data.forEach(p => {
                    tbody.innerHTML += `
                        <tr>
                            <td>${p.nombre}</td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-outline-danger rounded-circle" onclick="eliminarPlan(${p.id})"><i class="bi bi-trash"></i></button>
                            </td>
                        </tr>
                    `;
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="2" class="text-center py-3 text-muted">No hay planes para esta obra social.</td></tr>';
            }
        })
        .catch(() => {
            tbody.innerHTML = '<tr><td colspan="2" class="text-center py-3 text-danger">Error al cargar planes.</td></tr>';
        });
}

document.getElementById('form-crear-plan').addEventListener('submit', function(e) {
    e.preventDefault();
    const osId = document.getElementById('gestion-plan-os-id').value;
    const nombre = document.getElementById('new-plan-nombre').value;
    const btn = this.querySelector('button[type="submit"]');
    
    btn.disabled = true;
    
    fetch('backend/api/crud_planes.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obra_social_id: osId, nombre: nombre })
    })
    .then(res => res.json())
    .then(data => {
        if(data.message.includes('exitosamente')) {
            document.getElementById('new-plan-nombre').value = '';
            cargarPlanesAdmin(osId);
            cargarObrasSociales();
        } else {
            alert(data.message || 'Error al crear plan');
        }
    })
    .catch(() => alert('Error de conexión'))
    .finally(() => btn.disabled = false);
});

function eliminarPlan(id) {
    if(!confirm('¿Estás seguro de eliminar este plan?')) return;
    
    const osId = document.getElementById('gestion-plan-os-id').value;
    
    fetch('backend/api/crud_planes.php', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        cargarPlanesAdmin(osId);
        cargarObrasSociales();
    })
    .catch(() => alert('Error de conexión'));
}

// ==========================================
// CONFIGURACIÓN
// ==========================================
function cargarConfiguracion() {
    fetch('backend/api/config.php')
        .then(res => res.json())
        .then(data => {
            document.getElementById('config-meses').value = data.meses_agenda || 3;
        })
        .catch(err => console.error("Error cargando config", err));
}

document.getElementById('form-configuracion').addEventListener('submit', function(e) {
    e.preventDefault();
    const btn = this.querySelector('button[type="submit"]');
    const meses = document.getElementById('config-meses').value;
    
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';
    
    fetch('backend/api/config.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meses_agenda: meses })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
    })
    .catch(() => alert('Error de conexión'))
    .finally(() => {
        btn.disabled = false;
        btn.textContent = 'Guardar Configuración';
    });
});

// ==========================================
// CRUD MÉDICOS
// ==========================================
let medicosDisponibles = [];
let obrasSocialesDisponibles = [];

function cargarMedicosAdmin() {
    const container = document.getElementById('medicos-container');
    container.innerHTML = `
        <div class="col-12 text-center text-muted py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2">Cargando médicos...</p>
        </div>
    `;

    // Cargar médicos, Obras Sociales, Especialidades y Sedes
    Promise.all([
        fetch('backend/api/admin_get_medicos.php').then(res => res.json()),
        fetch('backend/api/get_obras_sociales.php').then(res => res.json()),
        fetch('backend/api/get_especialidades.php').then(res => res.json()),
        fetch('backend/api/crud_unidades.php').then(res => res.json()).catch(() => [])
    ]).then(([medicos, obras, especialidades, sedes]) => {
        medicosDisponibles = medicos;
        obrasSocialesDisponibles = obras;
        especialidadesDisponibles = especialidades || [];
        sedesDisponibles = sedes || [];
        
        renderMedicos(medicosDisponibles);
    }).catch(err => {
        container.innerHTML = '<div class="col-12"><div class="alert alert-danger">Error cargando datos.</div></div>';
    });
}

function renderMedicos(medicos) {
    const container = document.getElementById('medicos-container');
    container.innerHTML = '';
    
    if(medicos.length === 0) {
        container.innerHTML = '<div class="col-12"><div class="alert alert-info">No hay médicos que coincidan con la búsqueda.</div></div>';
        return;
    }

    medicos.forEach(med => {
        const nomLimpio = limpiarNombre(med.nombre);
        const apeLimpio = limpiarNombre(med.apellido);
        const defaultAvatar = obtenerAvatarDefault(nomLimpio, apeLimpio);
        const fotoHtml = med.foto_perfil
            ? `<img src="${escapeHtml(safeImageUrl(med.foto_perfil, defaultAvatar))}" class="rounded-circle mb-3 object-fit-cover shadow-sm" width="100" height="100" style="border: 3px solid #e9ecef;" onerror="this.onerror=null;this.src='${escapeHtml(defaultAvatar)}';">`
            : `<img src="${defaultAvatar}" class="rounded-circle mb-3 object-fit-cover shadow-sm" width="100" height="100" style="border: 3px solid #e9ecef;">`;
        
        const horariosResumen = med.horarios && med.horarios.length > 0
            ? med.horarios.map(h => {
                const sede = h.unidad_nombre 
                    ? ` • <button type="button" class="btn btn-link p-0 text-decoration-none text-primary fw-semibold" style="font-size:0.78rem;" 
                        data-nombre="${encodeURIComponent(h.unidad_nombre || '')}" 
                        data-calle="${encodeURIComponent(h.unidad_calle || '')}" 
                        data-numero="${encodeURIComponent(h.unidad_numero || '')}" 
                        data-localidad="${encodeURIComponent(h.unidad_localidad || '')}" 
                        data-lat="${escapeHtml(h.unidad_latitud || '')}"
                        data-lng="${escapeHtml(h.unidad_longitud || '')}"
                        onclick="abrirModalSedeDesdeBtn(this)" 
                        title="Ver en Google Maps"><i class="bi bi-geo-alt-fill text-danger me-1"></i>${escapeHtml(h.unidad_nombre)}</button>`
                    : '';
                return `<div class="badge bg-light text-dark border me-1 mb-1 p-2 text-start d-block" style="font-size:0.78rem; font-weight:normal;">
                    <i class="bi bi-clock text-primary me-1"></i><strong>${escapeHtml(h.dia_semana)}:</strong> ${escapeHtml(h.hora_inicio.slice(0,5))} a ${escapeHtml(h.hora_fin.slice(0,5))} hs${sede}
                </div>`;
            }).join('')
            : `<span class="text-muted small">Sin horarios configurados</span>`;
        
        const cantCoberturas = med.obras_sociales ? med.obras_sociales.length : 0;

        const html = `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 border-0 shadow-sm rounded-4 overflow-hidden">
                    <div class="card-body p-4 text-center">
                        ${fotoHtml}
                        <h5 class="fw-bold mb-1">Dr/a. ${escapeHtml(nomLimpio)} ${escapeHtml(apeLimpio)}</h5>
                        <p class="text-muted small mb-1">${escapeHtml(med.especialidad_nombre || 'Sin especialidad')}</p>
                        <p class="text-muted small mb-2">Matrícula: ${escapeHtml(med.matricula || 'No especificada')}</p>
                        <div class="mb-3 text-start px-2" style="max-height:130px; overflow-y:auto;">${horariosResumen}</div>
                        <div class="d-grid gap-2">
                            <button class="btn btn-outline-primary btn-sm rounded-pill" onclick="abrirEditMedico(${parseInt(med.id,10)||0})">
                                <i class="bi bi-pencil-square me-1"></i> Editar Perfil y Especialidades
                            </button>
                            <button class="btn btn-outline-warning btn-sm rounded-pill" onclick="abrirHorariosMedico(${parseInt(med.id,10)||0})">
                                <i class="bi bi-clock me-1"></i> Horarios (${med.horarios ? med.horarios.length : 0})
                            </button>
                            <button class="btn btn-outline-success btn-sm rounded-pill" onclick="abrirCoberturasMedico(${parseInt(med.id,10)||0})">
                                <i class="bi bi-shield-check me-1"></i> Coberturas (${cantCoberturas})
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// Búsqueda de Médicos
document.getElementById('search-medicos')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtrados = medicosDisponibles.filter(m => {
        const nombreCompleto = `${limpiarNombre(m.nombre)} ${limpiarNombre(m.apellido)}`.toLowerCase();
        const especialidad = (m.especialidad_nombre || '').toLowerCase();
        return nombreCompleto.includes(query) || especialidad.includes(query);
    });
    renderMedicos(filtrados);
});

function abrirEditMedico(id) {
    const med = medicosDisponibles.find(m => m.id == id);
    if(!med) return;
    
    document.getElementById('edit-medico-id').value = med.id;
    document.getElementById('edit-medico-nombre').value = limpiarNombre(med.nombre);
    document.getElementById('edit-medico-apellido').value = limpiarNombre(med.apellido);
    document.getElementById('edit-medico-matricula').value = med.matricula || '';
    document.getElementById('edit-medico-direccion').value = med.direccion || '';
    document.getElementById('edit-medico-biografia').value = med.biografia || '';
    document.getElementById('edit-medico-foto').value = '';

    // Llenar select de sedes
    const sedeSelect = document.getElementById('edit-medico-sede-select');
    if (sedeSelect) {
        sedeSelect.innerHTML = '<option value="">-- Seleccionar Sede de Atención (Configuración) --</option>';
        sedesDisponibles.forEach(s => {
            const dir = [s.calle, s.numero].filter(Boolean).join(' ');
            const label = s.nombre + (dir ? ` (${dir})` : '');
            sedeSelect.innerHTML += `<option value="${parseInt(s.id,10)||0}">${escapeHtml(label)}</option>`;
        });
    }
    
    // Especialidades dinámicas
    renderEspecialidadesCheckboxes(med);

    // Manejar foto: mostrar imagen si existe, o placeholder
    const preview = document.getElementById('edit-medico-foto-preview');
    const placeholder = document.getElementById('edit-medico-foto-placeholder');
    const defaultAvatar = obtenerAvatarDefault(med.nombre, med.apellido);
    if(med.foto_perfil) {
        preview.src = med.foto_perfil;
        preview.classList.remove('d-none');
        placeholder.classList.add('d-none');
    } else {
        preview.src = defaultAvatar;
        preview.classList.remove('d-none');
        placeholder.classList.add('d-none');
    }
    
    const modal = new bootstrap.Modal(document.getElementById('modalEditMedico'));
    modal.show();
}

function renderEspecialidadesCheckboxes(medico) {
    const espContainer = document.getElementById('edit-medico-especialidades-container');
    if (!espContainer) return;
    
    const medEspIds = medico 
        ? (medico.especialidades_ids || (medico.especialidades ? medico.especialidades.map(e => e.id || e.especialidad_id) : []))
        : Array.from(document.querySelectorAll('.check-especialidad-medico:checked')).map(cb => parseInt(cb.value));

    if (!especialidadesDisponibles || especialidadesDisponibles.length === 0) {
        espContainer.innerHTML = '<span class="text-muted small">No hay especialidades configuradas. Puedes agregar una abajo directamente.</span>';
    } else {
        espContainer.innerHTML = especialidadesDisponibles.map(esp => {
            const checked = medEspIds.includes(esp.id) ? 'checked' : '';
            return `
                <div class="form-check mb-1">
                    <input class="form-check-input check-especialidad-medico" type="checkbox" value="${esp.id}" id="edit-esp-${esp.id}" ${checked}>
                    <label class="form-check-label" for="edit-esp-${esp.id}">${esp.nombre}</label>
                </div>
            `;
        }).join('');
    }
}

// Al seleccionar una sede en el perfil del médico
window.seleccionarSedeEnMedico = function(sedeId) {
    if(!sedeId) return;
    const sede = sedesDisponibles.find(s => s.id == sedeId);
    if(sede) {
        const dir = [sede.calle, sede.numero].filter(Boolean).join(' ');
        const loc = sede.localidad ? ` (${sede.localidad})` : '';
        document.getElementById('edit-medico-direccion').value = sede.nombre + (dir ? ` - ${dir}` : '') + loc;
    }
};

// Agregar especialidad rápida desde el modal
window.agregarEspecialidadRapida = function() {
    const input = document.getElementById('nueva-especialidad-rapida');
    const nombre = input.value.trim();
    if(!nombre) {
        alert('Escribe el nombre de la especialidad');
        return;
    }

    fetch('backend/api/crud_especialidades.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre })
    })
    .then(res => res.json())
    .then(data => {
        input.value = '';
        // Recargar especialidades
        return fetch('backend/api/get_especialidades.php').then(r => r.json());
    })
    .then(esps => {
        especialidadesDisponibles = esps;
        // Buscar la nueva especialidad creada
        const creada = esps.find(e => e.nombre.toLowerCase() === nombre.toLowerCase());
        const espContainer = document.getElementById('edit-medico-especialidades-container');
        
        // Renderizar manteniendo las ya seleccionadas + la nueva
        const checksActuales = Array.from(document.querySelectorAll('.check-especialidad-medico:checked')).map(cb => parseInt(cb.value));
        if (creada && !checksActuales.includes(creada.id)) {
            checksActuales.push(creada.id);
        }
        
        espContainer.innerHTML = especialidadesDisponibles.map(esp => {
            const checked = checksActuales.includes(esp.id) ? 'checked' : '';
            return `
                <div class="form-check mb-1">
                    <input class="form-check-input check-especialidad-medico" type="checkbox" value="${esp.id}" id="edit-esp-${esp.id}" ${checked}>
                    <label class="form-check-label" for="edit-esp-${esp.id}">${esp.nombre}</label>
                </div>
            `;
        }).join('');
    })
    .catch(() => alert('Error al agregar especialidad'));
};

// Subida de imagen
document.getElementById('edit-medico-foto').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if(!file) return;
    
    const formData = new FormData();
    formData.append('image', file);
    
    fetch('backend/api/upload_image.php', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if(data.url) {
            const preview = document.getElementById('edit-medico-foto-preview');
            const placeholder = document.getElementById('edit-medico-foto-placeholder');
            preview.src = data.url;
            preview.setAttribute('data-url-relativa', data.url);
            preview.classList.remove('d-none');
            placeholder.classList.add('d-none');
        } else {
            alert(data.message || 'Error al subir imagen');
        }
    })
    .catch(() => alert('Error de conexión al subir imagen'));
});

// Guardar Perfil Médico
document.getElementById('form-edit-medico').addEventListener('submit', function(e) {
    e.preventDefault();
    const btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    
    const preview = document.getElementById('edit-medico-foto-preview');
    let fotoUrl = preview.getAttribute('data-url-relativa') || preview.getAttribute('src') || null;
    if(fotoUrl && fotoUrl.includes('/img/medicos/')) {
        fotoUrl = 'img/medicos/' + fotoUrl.split('/img/medicos/').pop();
    }
    if(preview.classList.contains('d-none')) fotoUrl = null;
    
    const espChecks = document.querySelectorAll('.check-especialidad-medico:checked');
    const especialidadesSeleccionadas = Array.from(espChecks).map(cb => parseInt(cb.value));

    const payload = {
        id: document.getElementById('edit-medico-id').value,
        nombre: document.getElementById('edit-medico-nombre').value,
        apellido: document.getElementById('edit-medico-apellido').value,
        matricula: document.getElementById('edit-medico-matricula').value,
        direccion: document.getElementById('edit-medico-direccion').value,
        biografia: document.getElementById('edit-medico-biografia').value,
        foto_perfil: fotoUrl,
        especialidades: especialidadesSeleccionadas
    };
    
    fetch('backend/api/admin_update_medico.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        preview.removeAttribute('data-url-relativa');
        bootstrap.Modal.getInstance(document.getElementById('modalEditMedico')).hide();
        cargarMedicosAdmin();
    })
    .catch(() => alert('Error de conexión'))
    .finally(() => btn.disabled = false);
});

// Modal de Coberturas
function abrirCoberturasMedico(id) {
    const med = medicosDisponibles.find(m => m.id == id);
    if(!med) return;
    
    document.getElementById('coberturas-medico-id').value = med.id;
    const container = document.getElementById('coberturas-list-container');
    container.innerHTML = '<div class="text-center"><div class="spinner-border text-primary spinner-border-sm"></div></div>';
    
    const planesMed = med.planes || [];
    const obrasMed = med.obras_sociales || [];
    
    let html = '';
    obrasSocialesDisponibles.forEach(os => {
        const tienePlanes = os.planes && os.planes.length > 0;
        const osChecked = obrasMed.includes(os.id) || (tienePlanes && os.planes.some(p => planesMed.includes(p.id)));
        
        html += `
            <div class="card mb-3 border-0 shadow-sm rounded-3 card-cobertura-item">
                <div class="card-header bg-light border-0 d-flex justify-content-between align-items-center">
                    <div class="form-check mb-0">
                        <input class="form-check-input check-os-medico" type="checkbox" value="${os.id}" id="os-check-${os.id}" ${osChecked ? 'checked' : ''} onchange="togglePlanesOS(${os.id}, this.checked)">
                        <label class="form-check-label fw-bold" for="os-check-${os.id}">${os.nombre}</label>
                    </div>
                    ${tienePlanes ? `<span class="badge bg-white text-secondary border small">${os.planes.length} planes</span>` : '<span class="badge bg-secondary-subtle text-secondary small">Convenio directo</span>'}
                </div>
        `;
        
        if (tienePlanes) {
            html += `<div class="card-body py-2 ps-4" id="planes-os-${os.id}">`;
            os.planes.forEach(plan => {
                const planChecked = planesMed.includes(plan.id);
                html += `
                    <div class="form-check mb-1">
                        <input class="form-check-input check-plan-medico plan-de-os-${os.id}" type="checkbox" value="${plan.id}" data-os-id="${os.id}" id="plan-${plan.id}" ${planChecked ? 'checked' : ''} onchange="syncOSFromPlan(${os.id})">
                        <label class="form-check-label small" for="plan-${plan.id}">
                            ${plan.nombre}
                        </label>
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        html += `</div>`;
    });
    
    container.innerHTML = html;

    // Configurar buscador en tiempo real dentro del modal
    const searchInput = document.getElementById('search-coberturas-modal');
    if (searchInput) {
        searchInput.value = '';
        searchInput.oninput = function(e) {
            const query = e.target.value.toLowerCase().trim();
            const items = container.querySelectorAll('.card-cobertura-item');
            let encontrados = 0;
            items.forEach(item => {
                const text = item.textContent.toLowerCase();
                if (!query || text.includes(query)) {
                    item.classList.remove('d-none');
                    encontrados++;
                } else {
                    item.classList.add('d-none');
                }
            });

            let noResultsMsg = document.getElementById('no-coberturas-search-msg');
            if (encontrados === 0 && query) {
                if (!noResultsMsg) {
                    noResultsMsg = document.createElement('div');
                    noResultsMsg.id = 'no-coberturas-search-msg';
                    noResultsMsg.className = 'alert alert-info text-center small py-3 mt-2';
                    container.appendChild(noResultsMsg);
                }
                noResultsMsg.innerHTML = `<i class="bi bi-search me-1"></i> No se encontraron coberturas ni planes para "<strong>${escapeHtml(e.target.value)}</strong>".`;
                noResultsMsg.classList.remove('d-none');
            } else if (noResultsMsg) {
                noResultsMsg.classList.add('d-none');
            }
        };
    }
    
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCoberturasMedico'));
    modal.show();
}

window.togglePlanesOS = function(osId, isChecked) {
    const planChecks = document.querySelectorAll(`.plan-de-os-${osId}`);
    planChecks.forEach(cb => { cb.checked = isChecked; });
};

window.syncOSFromPlan = function(osId) {
    const planChecks = document.querySelectorAll(`.plan-de-os-${osId}`);
    const anyChecked = Array.from(planChecks).some(cb => cb.checked);
    const osCheck = document.getElementById(`os-check-${osId}`);
    if (osCheck) {
        osCheck.checked = anyChecked;
    }
};

window.marcarTodasCoberturas = function(marcar) {
    const container = document.getElementById('coberturas-list-container');
    if (!container) return;
    
    // Marcar/desmarcar todos los checkboxes visibles o totales
    const osChecks = container.querySelectorAll('.check-os-medico');
    const planChecks = container.querySelectorAll('.check-plan-medico');
    
    osChecks.forEach(cb => { cb.checked = marcar; });
    planChecks.forEach(cb => { cb.checked = marcar; });
};

// Guardar Coberturas
document.getElementById('form-coberturas-medico').addEventListener('submit', function(e) {
    e.preventDefault();
    const btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    
    const usuarioId = document.getElementById('coberturas-medico-id').value;
    const osCheckboxes = document.querySelectorAll('.check-os-medico:checked');
    const obrasSeleccionadas = Array.from(osCheckboxes).map(cb => parseInt(cb.value));

    const planCheckboxes = document.querySelectorAll('.check-plan-medico:checked');
    const planesSeleccionados = Array.from(planCheckboxes).map(cb => parseInt(cb.value));
    
    fetch('backend/api/admin_update_medico_coberturas.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            usuario_id: usuarioId,
            obras_sociales: obrasSeleccionadas,
            planes: planesSeleccionados
        })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        bootstrap.Modal.getInstance(document.getElementById('modalCoberturasMedico')).hide();
        cargarMedicosAdmin();
    })
    .catch(() => alert('Error de conexión'))
    .finally(() => btn.disabled = false);
});

// ==========================================
// SEDES / UNIDADES DE ATENCIÓN
// ==========================================

function cargarSedes() {
    fetch('backend/api/crud_unidades.php')
        .then(res => res.json())
        .then(data => {
            sedesDisponibles = data;
            renderSedes(data);
        })
        .catch(() => {
            document.getElementById('tabla-sedes').innerHTML =
                '<tr><td colspan="4" class="text-center text-danger">Error al cargar sedes.</td></tr>';
        });
}

function renderSedes(sedes) {
    const tbody = document.getElementById('tabla-sedes');
    if(!tbody) return;
    tbody.innerHTML = '';

    if(sedes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No hay sedes registradas.</td></tr>';
        return;
    }

    sedes.forEach(s => {
        const dir = [s.calle, s.numero].filter(Boolean).join(' ') || '—';
        tbody.innerHTML += `
            <tr>
                <td class="fw-semibold">${escapeHtml(s.nombre)}</td>
                <td>${escapeHtml(dir)}</td>
                <td>${escapeHtml(s.localidad || '—')}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-info me-1" data-nombre="${encodeURIComponent(s.nombre || '')}" data-calle="${encodeURIComponent(s.calle || '')}" data-numero="${encodeURIComponent(s.numero || '')}" data-localidad="${encodeURIComponent(s.localidad || '')}" data-lat="${escapeHtml(s.latitud || '')}" data-lng="${escapeHtml(s.longitud || '')}" onclick="abrirModalSedeDesdeBtn(this)" title="Ver en Google Maps y Cómo llegar">
                        <i class="bi bi-geo-alt-fill text-danger"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="abrirModalSede(${parseInt(s.id,10)||0})" title="Editar Sede">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="borrarSede(${parseInt(s.id,10)||0})" title="Eliminar Sede">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

function abrirModalSede(id) {
    const sede = id ? sedesDisponibles.find(s => s.id == id) : null;
    document.getElementById('modalSedeTitle').textContent = sede ? 'Editar Sede' : 'Nueva Sede';
    document.getElementById('sede-id').value = sede ? sede.id : '';
    document.getElementById('sede-nombre').value = sede ? sede.nombre : '';
    document.getElementById('sede-calle').value = sede ? (sede.calle || '') : '';
    document.getElementById('sede-numero').value = sede ? (sede.numero || '') : '';
    document.getElementById('sede-localidad').value = sede ? (sede.localidad || '') : '';
    
    const inputLat = document.getElementById('sede-latitud');
    const inputLng = document.getElementById('sede-longitud');
    if (inputLat) inputLat.value = sede ? (sede.latitud || '') : '';
    if (inputLng) inputLng.value = sede ? (sede.longitud || '') : '';

    // Limpiar buscador autocompletar
    const autoInput = document.getElementById('sede-autocomplete-input');
    if (autoInput) autoInput.value = '';
    const autoRes = document.getElementById('sede-autocomplete-results');
    if (autoRes) {
        autoRes.innerHTML = '';
        autoRes.classList.add('d-none');
    }

    actualizarPreviewMapaModalSede();
    new bootstrap.Modal(document.getElementById('modalSede')).show();
}

// Vista previa dinámica en Google Maps en el modal de sedes
window.actualizarPreviewMapaModalSede = function() {
    const wrapper = document.getElementById('sede-mapa-preview-wrapper');
    const iframe = document.getElementById('sede-mapa-preview-iframe');
    const linkLlegar = document.getElementById('sede-preview-link-comollegar');
    if (!wrapper || !iframe) return;

    const nombre = (document.getElementById('sede-nombre')?.value || '').trim();
    const calle = (document.getElementById('sede-calle')?.value || '').trim();
    const numero = (document.getElementById('sede-numero')?.value || '').trim();
    const localidad = (document.getElementById('sede-localidad')?.value || '').trim() || 'San Carlos de Bariloche';
    const lat = document.getElementById('sede-latitud')?.value || '';
    const lng = document.getElementById('sede-longitud')?.value || '';

    const dirPartes = [calle, numero].filter(Boolean).join(' ');
    if (dirPartes || nombre || (lat && lng)) {
        const coords = resolverCoordenadasSede(nombre, calle, numero, localidad, lat, lng);
        let embedUrl = '';
        let urlDestino = '';

        if (coords) {
            embedUrl = `https://maps.google.com/maps?q=${coords.lat},${coords.lng}&hl=es&z=17&output=embed`;
            urlDestino = `${coords.lat},${coords.lng}`;
        } else {
            const busqueda = [nombre, dirPartes, localidad, 'Argentina'].filter(Boolean).join(', ');
            embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(busqueda)}&hl=es&z=17&output=embed`;
            urlDestino = encodeURIComponent(busqueda);
        }

        iframe.src = embedUrl;
        if (linkLlegar) {
            linkLlegar.href = `https://www.google.com/maps/dir/?api=1&destination=${urlDestino}`;
        }
        wrapper.style.display = 'block';
    } else {
        wrapper.style.display = 'none';
        iframe.src = '';
    }
};

// Autocompletado inteligente de direcciones (OpenStreetMap / Photon)
(function initAutocompleteSedes() {
    let timeoutDebounce = null;

    document.addEventListener('DOMContentLoaded', () => {
        const autoInput = document.getElementById('sede-autocomplete-input');
        const autoResults = document.getElementById('sede-autocomplete-results');
        const btnLimpiar = document.getElementById('btn-limpiar-autocomplete');

        if (!autoInput || !autoResults) return;

        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => {
                autoInput.value = '';
                autoResults.innerHTML = '';
                autoResults.classList.add('d-none');
                autoInput.focus();
            });
        }

        autoInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(timeoutDebounce);

            if (query.length < 3) {
                autoResults.innerHTML = '';
                autoResults.classList.add('d-none');
                return;
            }

            timeoutDebounce = setTimeout(() => {
                autoResults.innerHTML = '<div class="list-group-item small text-muted py-2"><div class="spinner-border spinner-border-sm me-2 text-primary"></div>Buscando sugerencias...</div>';
                autoResults.classList.remove('d-none');

                fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`)
                    .then(res => res.json())
                    .then(data => {
                        autoResults.innerHTML = '';
                        if (!data.features || data.features.length === 0) {
                            autoResults.innerHTML = '<div class="list-group-item small text-muted py-2">No se encontraron resultados exactos. Puedes escribir la calle y número abajo.</div>';
                            return;
                        }

                        data.features.forEach(feat => {
                            const p = feat.properties;
                            const calle = p.street || p.name || '';
                            const numero = p.housenumber || '';
                            const ciudad = p.city || p.town || p.district || p.state || 'San Carlos de Bariloche';
                            const titulo = [calle, numero].filter(Boolean).join(' ') || p.name || 'Ubicación';
                            const subtitulo = [p.district, ciudad, p.state, p.country].filter(Boolean).join(', ');

                            const a = document.createElement('a');
                            a.href = 'javascript:void(0)';
                            a.className = 'list-group-item list-group-item-action py-2';
                            a.innerHTML = `
                                <div class="d-flex align-items-center">
                                    <i class="bi bi-geo-alt-fill text-danger me-2 fs-5"></i>
                                    <div>
                                        <div class="fw-semibold text-dark small">${titulo}</div>
                                        <small class="text-muted" style="font-size:0.75rem;">${subtitulo}</small>
                                    </div>
                                </div>
                            `;

                            a.onclick = () => {
                                document.getElementById('sede-calle').value = calle;
                                document.getElementById('sede-numero').value = numero;
                                document.getElementById('sede-localidad').value = ciudad;

                                const inputNombre = document.getElementById('sede-nombre');
                                if (!inputNombre.value || inputNombre.value.trim() === '') {
                                    inputNombre.value = (p.name && p.name !== calle) ? p.name : titulo;
                                }

                                // Capturar coordenadas de Photon si están disponibles [lon, lat]
                                if (feat.geometry && feat.geometry.coordinates && feat.geometry.coordinates.length >= 2) {
                                    const lon = feat.geometry.coordinates[0];
                                    const lat = feat.geometry.coordinates[1];
                                    const inLat = document.getElementById('sede-latitud');
                                    const inLng = document.getElementById('sede-longitud');
                                    if (inLat) inLat.value = lat;
                                    if (inLng) inLng.value = lon;
                                }

                                autoInput.value = titulo + ', ' + ciudad;
                                autoResults.innerHTML = '';
                                autoResults.classList.add('d-none');

                                actualizarPreviewMapaModalSede();
                            };

                            autoResults.appendChild(a);
                        });
                    })
                    .catch(() => {
                        autoResults.innerHTML = '<div class="list-group-item small text-muted py-2">No se pudo autocompletar. Puedes escribir los datos manualmente.</div>';
                    });
            }, 300);
        });

        // Ocultar al hacer clic afuera
        document.addEventListener('click', (e) => {
            if (!autoInput.contains(e.target) && !autoResults.contains(e.target)) {
                autoResults.classList.add('d-none');
            }
        });
    });
})();

document.getElementById('form-sede').addEventListener('submit', function(e) {
    e.preventDefault();
    const btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;

    const payload = {
        id: document.getElementById('sede-id').value || null,
        nombre: document.getElementById('sede-nombre').value,
        calle: document.getElementById('sede-calle').value,
        numero: document.getElementById('sede-numero').value,
        localidad: document.getElementById('sede-localidad').value,
        latitud: document.getElementById('sede-latitud')?.value || null,
        longitud: document.getElementById('sede-longitud')?.value || null
    };

    fetch('backend/api/crud_unidades.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        bootstrap.Modal.getInstance(document.getElementById('modalSede')).hide();
        cargarSedes();
    })
    .catch(() => alert('Error al guardar sede'))
    .finally(() => btn.disabled = false);
});

function borrarSede(id) {
    if(!confirm('¿Seguro que deseas eliminar esta sede?')) return;
    fetch('backend/api/crud_unidades.php', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        cargarSedes();
    })
    .catch(() => alert('Error al eliminar'));
}

// ==========================================
// HORARIOS DEL MÉDICO
// ==========================================
const DIAS_SEMANA = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

function abrirHorariosMedico(id) {
    const med = medicosDisponibles.find(m => m.id == id);
    if(!med) return;

    const nomLimpio = limpiarNombre(med.nombre);
    const apeLimpio = limpiarNombre(med.apellido);
    document.getElementById('horario-medico-id').value = med.id;
    document.getElementById('horario-medico-nombre-label').textContent = `Dr/a. ${nomLimpio} ${apeLimpio}`;

    const container = document.getElementById('horarios-editor-container');
    container.innerHTML = '';

    // Renderizar horarios existentes o un bloque vacío si no hay
    if(med.horarios && med.horarios.length > 0) {
        med.horarios.forEach(h => renderBloqueHorario(container, h));
    } else {
        renderBloqueHorario(container, null);
    }

    new bootstrap.Modal(document.getElementById('modalHorariosMedico')).show();
}

const HORAS_24 = [];
for (let hr = 6; hr <= 23; hr++) {
    const hh = String(hr).padStart(2, '0');
    HORAS_24.push(`${hh}:00`);
    HORAS_24.push(`${hh}:30`);
}

function generarOpcionesHoras(horaActual, defecto) {
    const hora = (horaActual && horaActual.length >= 5) ? horaActual.slice(0, 5) : defecto;
    let horas = [...HORAS_24];
    if (hora && !horas.includes(hora)) {
        horas.push(hora);
        horas.sort();
    }
    return horas.map(h => `<option value="${h}" ${h === hora ? 'selected' : ''}>${h} hs</option>`).join('');
}

function renderBloqueHorario(container, h) {
    const selectedSedeId = h && h.unidad_id ? h.unidad_id : (sedesDisponibles.length > 0 ? sedesDisponibles[0].id : '');
    const sedesOpts = sedesDisponibles.map(s => {
        const dir = [s.calle, s.numero].filter(Boolean).join(' ');
        const label = s.nombre + (dir ? ` (${dir})` : '');
        return `<option value="${s.id}" ${selectedSedeId == s.id ? 'selected' : ''}>${label}</option>`;
    }).join('');

    const div = document.createElement('div');
    div.className = 'card border-0 bg-light rounded-3 p-3 mb-3 horario-bloque';
    div.innerHTML = `
        <div class="row g-2 align-items-center">
            <div class="col-md-2">
                <label class="form-label small fw-semibold">Día</label>
                <select class="form-select form-select-sm hb-dia">
                    ${DIAS_SEMANA.map(d => `<option value="${d}" ${h && h.dia_semana === d ? 'selected' : ''}>${d}</option>`).join('')}
                </select>
            </div>
            <div class="col-md-2">
                <label class="form-label small fw-semibold">Desde (24hs)</label>
                <select class="form-select form-select-sm hb-inicio">
                    ${generarOpcionesHoras(h ? h.hora_inicio : null, '08:00')}
                </select>
            </div>
            <div class="col-md-2">
                <label class="form-label small fw-semibold">Hasta (24hs)</label>
                <select class="form-select form-select-sm hb-fin">
                    ${generarOpcionesHoras(h ? h.hora_fin : null, '13:00')}
                </select>
            </div>
            <div class="col-md-2">
                <label class="form-label small fw-semibold">Duración (min)</label>
                <input type="number" class="form-control form-control-sm hb-duracion" min="10" max="120" step="5" value="${h ? h.duracion_turno_minutos : 30}">
            </div>
            <div class="col-md-3">
                <label class="form-label small fw-semibold">Centro / Sede <span class="text-danger">*</span></label>
                <select class="form-select form-select-sm hb-sede" required>
                    <option value="" disabled ${!selectedSedeId ? 'selected' : ''}>-- Selecciona Sede --</option>
                    ${sedesOpts}
                </select>
            </div>
            <div class="col-md-1 d-flex align-items-end">
                <button class="btn btn-sm btn-outline-danger rounded-circle" onclick="this.closest('.horario-bloque').remove()" title="Eliminar bloque">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `;
    container.appendChild(div);
}

function agregarBloqueHorario() {
    const container = document.getElementById('horarios-editor-container');
    renderBloqueHorario(container, null);
}

function guardarHorariosMedico() {
    const medicoId = document.getElementById('horario-medico-id').value;
    const bloques = document.querySelectorAll('.horario-bloque');

    for (let i = 0; i < bloques.length; i++) {
        const sedeVal = bloques[i].querySelector('.hb-sede')?.value;
        if (!sedeVal) {
            alert('Atención: Cada bloque de horario debe tener una Sede o Centro de atención seleccionado obligatoriamente.');
            return;
        }
    }

    const horarios = Array.from(bloques).map(b => ({
        dia_semana: b.querySelector('.hb-dia').value,
        hora_inicio: b.querySelector('.hb-inicio').value,
        hora_fin: b.querySelector('.hb-fin').value,
        duracion_turno_minutos: parseInt(b.querySelector('.hb-duracion').value) || 30,
        unidad_id: b.querySelector('.hb-sede').value || null
    }));

    fetch('backend/api/crud_horarios_medico.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medico_id: medicoId, horarios })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        bootstrap.Modal.getInstance(document.getElementById('modalHorariosMedico')).hide();
        cargarMedicosAdmin();
    })
    .catch(() => alert('Error al guardar horarios'));
}

// --- Lógica Inline de Gestión de Agenda ---
function cargarHorariosEnEditorInline(med) {
    if (!med) return;
    
    document.getElementById('agenda-admin-medico-id').value = med.id;
    document.getElementById('agenda-admin-medico-nombre').textContent = `Horarios de: Dr/a. ${limpiarNombre(med.nombre)} ${limpiarNombre(med.apellido)}`;
    
    const container = document.getElementById('agenda-admin-editor-container');
    container.innerHTML = '';
    
    if(med.horarios && med.horarios.length > 0) {
        med.horarios.forEach(h => renderBloqueHorario(container, h));
    } else {
        renderBloqueHorario(container, null);
    }
}

function agregarBloqueHorarioInline() {
    const container = document.getElementById('agenda-admin-editor-container');
    renderBloqueHorario(container, null);
}

function guardarHorariosMedicoInline() {
    const medicoId = document.getElementById('agenda-admin-medico-id').value;
    const bloques = document.querySelectorAll('#agenda-admin-editor-container .horario-bloque');
    const btn = document.querySelector('#agenda-admin-editor-card button.btn-primary');

    for (let i = 0; i < bloques.length; i++) {
        const sedeVal = bloques[i].querySelector('.hb-sede')?.value;
        if (!sedeVal) {
            alert('Atención: Cada bloque de horario debe tener una Sede o Centro de atención seleccionado obligatoriamente.');
            return;
        }
    }

    const horarios = Array.from(bloques).map(b => ({
        dia_semana: b.querySelector('.hb-dia').value,
        hora_inicio: b.querySelector('.hb-inicio').value,
        hora_fin: b.querySelector('.hb-fin').value,
        duracion_turno_minutos: parseInt(b.querySelector('.hb-duracion').value) || 30,
        unidad_id: b.querySelector('.hb-sede').value || null
    }));

    if(btn) btn.disabled = true;

    fetch('backend/api/crud_horarios_medico.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medico_id: medicoId, horarios })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        
        // Refrescar los datos locales para la vista actual
        if (window._medicosParaAgenda) {
            const mIndex = window._medicosParaAgenda.findIndex(m => m.id == medicoId);
            if (mIndex !== -1) {
                window._medicosParaAgenda[mIndex].horarios = horarios;
            }
        }
        
        const user = JSON.parse(localStorage.getItem('user'));
        if (user && user.id == medicoId) {
            user.horarios = horarios;
            localStorage.setItem('user', JSON.stringify(user));
        }
    })
    .catch(() => alert('Error al guardar horarios'))
    .finally(() => {
        if(btn) btn.disabled = false;
    });
}
