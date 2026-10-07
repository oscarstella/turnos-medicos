// ==========================================
// LÓGICA DEL WIZARD DE RESERVA (PÚBLICO)
// ==========================================
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function safeImageUrl(value, fallback) {
    try { const parsed = new URL(String(value || fallback || ''), window.location.href); return ['http:','https:'].includes(parsed.protocol) ? parsed.href : fallback; }
    catch (_) { return fallback; }
}

let wizardData = {
    medicoId: null,
    medicoNombre: null,
    especialidadNombre: null,
    coberturaId: null,
    coberturaNombre: null,
    planId: null,
    planNombre: null,
    fecha: null,
    hora: null
};

// Helper: Limpiar nombres y apellidos (quitar direcciones o textos entre paréntesis)
function limpiarNombre(str) {
    if (!str) return '';
    return str.replace(/\s*\([^)]*\)/g, '').replace(/\s*–\s*\d+.*$/g, '').trim();
}
window.limpiarNombre = limpiarNombre;

// Modal y Mapa de Sede con Google Maps & Cómo llegar
// Resolver coordenadas geográficas para garantizar el PIN rojo en el mapa
function resolverCoordenadasSede(nombre, calle, numero, localidad, lat, lng) {
    if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
        return { lat: parseFloat(lat), lng: parseFloat(lng) };
    }
    const txt = `${nombre || ''} ${calle || ''} ${numero || ''}`.toLowerCase();
    if (txt.includes('gutierrez') || txt.includes('gutiérrez') || txt.includes('980')) {
        return { lat: -41.1415571, lng: -71.3132086 };
    }
    if (txt.includes('mitre') || txt.includes('124') || txt.includes('120')) {
        return { lat: -41.1336564, lng: -71.3078764 };
    }
    if (txt.includes('frey') || txt.includes('111')) {
        return { lat: -41.13452, lng: -71.30553 };
    }
    if (txt.includes('km') || txt.includes('bustillo') || txt.includes('1000')) {
        return { lat: -41.131, lng: -71.325 };
    }
    return null;
}

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
        // Con coordenadas numéricas exactas, Google Maps coloca el marcador / PIN rojo garantizado
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
    
    // Si contiene "dra" o "doctora"
    if (/\bdra\.?\b|\bdoctora\b/.test(texto)) {
        return 'assets/img/avatar_doctora.jpg';
    }
    // Si contiene "dr" o "doctor"
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

// Helper: Normalizar texto de días sin tildes
function normalizarDia(str) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}


// Check if user is logged in to change the header button
auth.onAuthStateChanged((firebaseUser) => {
    const authSection = document.getElementById('header-auth-section');
    if (firebaseUser) {
        authSection.innerHTML = `
            <a href="dashboard.php" class="btn btn-outline-primary rounded-pill px-4 fw-semibold shadow-sm">
                <i class="bi bi-person-circle me-1"></i> Ir al Panel
            </a>
        `;
    }
});


document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const medicoId = urlParams.get('medico_id');
    
    if (medicoId) {
        iniciarWizardReserva(medicoId);
    } else {
        window.location.href = 'index.php'; // Volver si no hay médico
    }

    // Buscador de Coberturas
    const searchOs = document.getElementById('wizard-search-os');
    if (searchOs) {
        searchOs.addEventListener('input', function(e) {
            const term = e.target.value.toLowerCase();
            const btns = document.querySelectorAll('#wizard-os-container .os-card, #wizard-os-container .pill-btn');
            btns.forEach(btn => {
                if (btn.textContent.toLowerCase().includes(term)) {
                    btn.classList.remove('d-none');
                    btn.classList.add('d-flex'); // since os-card uses d-flex
                } else {
                    btn.classList.remove('d-flex');
                    btn.classList.add('d-none');
                }
            });
        });
    }

    // Buscador de Planes
    const searchPlan = document.getElementById('wizard-search-plan');
    if (searchPlan) {
        searchPlan.addEventListener('input', function(e) {
            const term = e.target.value.toLowerCase();
            const btns = document.querySelectorAll('#wizard-planes-container .plan-card, #wizard-planes-container .pill-btn');
            btns.forEach(btn => {
                if (btn.textContent.toLowerCase().includes(term)) {
                    btn.classList.remove('d-none');
                    btn.classList.add('d-flex');
                } else {
                    btn.classList.remove('d-flex');
                    btn.classList.add('d-none');
                }
            });
        });
    }
});

function iniciarWizardReserva(medicoId) {
    wizardData.medicoId = medicoId;
    const urlParams = new URLSearchParams(window.location.search);
    let pending = null;
    if (urlParams.get('resume') === '1') {
        try { pending = JSON.parse(localStorage.getItem('turno_pendiente') || 'null'); } catch (_) {}
    }
    
    // Fetch de datos del médico para llenar la barra superior
    fetch(`backend/api/get_public_agenda.php?medico_id=${medicoId}`)
        .then(res => res.json())
        .then(data => {
            if(data.length > 0) {
                const med = data[0];
                const nomLimpio = limpiarNombre(med.nombre);
                const apeLimpio = limpiarNombre(med.apellido);
                const nombreCompleto = `${nomLimpio} ${apeLimpio}`.trim();
                const especialidadNombre = med.especialidades && med.especialidades.length > 0 
                    ? med.especialidades.map(e => e.nombre).join(', ') 
                    : 'Medicina General';
                    
                wizardData.medico = med;
                wizardData.medicoNombre = nombreCompleto;
                wizardData.especialidadNombre = especialidadNombre;
                // Guardar el ID de la primera especialidad para el guardado del turno
                wizardData.especialidadId = med.especialidades && med.especialidades.length > 0
                    ? med.especialidades[0].especialidad_id
                    : null;

                if (pending && String(pending.medicoId) === String(medicoId)) {
                    ['coberturaId','coberturaNombre','planId','planNombre','fecha','hora','unidadId','sedeNombre'].forEach(key => {
                        if (typeof pending[key] !== 'undefined') wizardData[key] = pending[key];
                    });
                    const coverageLabel = document.getElementById('wizard-cobertura-nombre');
                    if (coverageLabel) { coverageLabel.textContent = wizardData.coberturaNombre || 'Seleccionar...'; coverageLabel.classList.remove('text-muted'); }
                    ['wizard-step-1','wizard-step-2','wizard-step-3'].forEach(id => document.getElementById(id)?.classList.add('d-none'));
                    document.getElementById('wizard-step-4')?.classList.remove('d-none');
                }
                
                document.getElementById('wizard-medico-nombre').textContent = nombreCompleto;
                document.getElementById('wizard-medico-nombre-q').textContent = nombreCompleto;
                document.getElementById('wizard-especialidad-nombre').textContent = especialidadNombre;

                const foto = med.foto_perfil || med.foto_url;
                const avatarContainer = document.getElementById('wizard-avatar-container');
                const defaultAvatar = obtenerAvatarDefault(nomLimpio, apeLimpio);
                if (avatarContainer) {
                    if (foto && foto.trim() !== '') {
                        avatarContainer.innerHTML = `<img src="${escapeHtml(safeImageUrl(foto, defaultAvatar))}" alt="${escapeHtml(nombreCompleto)}" class="w-100 h-100 object-fit-cover" onerror="this.onerror=null;this.src='${escapeHtml(defaultAvatar)}';">`;
                    } else {
                        avatarContainer.innerHTML = `<img src="${defaultAvatar}" alt="${nombreCompleto}" class="w-100 h-100 object-fit-cover">`;
                    }
                }
                if (pending && String(pending.medicoId) === String(medicoId)) wizardRenderCalendarioMock();
            } else {
                alert("Profesional no encontrado.");
                window.location.href = 'index.php';
            }
        })
        .catch(err => {
            console.error("Error cargando médico", err);
        });
}

// Global to store grouped coverage plans
let groupedObrasSociales = {};

function agruparObrasSociales(lista) {
    const knownPrefixes = [
        "Swiss Medical Group", "Swiss Medical", 
        "OSDE", "Galeno", "Sancor Salud", "Sancor", 
        "Medife", "OMINT", "O.S.D.E.", "Accord Salud", 
        "IOMA", "PAMI", "ACA Salud", "Aca Salud", "OSECAC", "Jerarquicos Salud",
        "Luis Pasteur", "Medicus", "Prevencion Salud", "Bristol Medicine"
    ];
    
    let grupos = {};
    let resultado = [];
    
    lista.forEach(os => {
        let matchedPrefix = null;
        for (let prefix of knownPrefixes) {
            if (os.nombre.toLowerCase().startsWith(prefix.toLowerCase())) {
                matchedPrefix = prefix;
                break;
            }
        }
        
        if (matchedPrefix) {
            if (!grupos[matchedPrefix]) {
                grupos[matchedPrefix] = {
                    id: 'group_' + matchedPrefix,
                    nombre: matchedPrefix,
                    isGroup: true,
                    children: []
                };
                resultado.push(grupos[matchedPrefix]);
            }
            // Add as child
            let planName = os.nombre.substring(matchedPrefix.length).trim();
            if (planName.startsWith('-')) planName = planName.substring(1).trim();
            if (planName === '') planName = 'Plan General';
            
            grupos[matchedPrefix].children.push({
                id: os.id || os.obra_social_id,
                nombre: planName,
                fullName: os.nombre
            });
        } else {
            resultado.push({
                id: os.id || os.obra_social_id,
                nombre: os.nombre,
                isGroup: false,
                children: []
            });
        }
    });
    
    // Sort
    resultado.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return resultado;
}

// Para usar desde los botones HTML
window.wizardGoToStep2 = function() {
    document.getElementById('wizard-step-1').classList.add('d-none');
    document.getElementById('wizard-step-2').classList.remove('d-none');
    
    wizardCargarObrasSociales();
};

let listaObrasSocialesCargadas = [];

window.wizardCargarObrasSociales = function() {
    const container = document.getElementById('wizard-os-container');
    container.innerHTML = '<span class="text-muted">Cargando coberturas...</span>';
    
    fetch(`backend/api/get_public_agenda.php?medico_id=${wizardData.medicoId}`)
        .then(res => res.json())
        .then(data => {
            container.innerHTML = '';
            
            const renderObras = (lista) => {
                listaObrasSocialesCargadas = lista;
                container.innerHTML = '';
                
                if (!lista || lista.length === 0) {
                    container.innerHTML = '<span class="text-muted">No hay obras sociales asignadas a este profesional. Puedes continuar como Particular.</span>';
                    return;
                }

                // Ordenar alfabéticamente
                const ordenadas = [...lista].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

                ordenadas.forEach(os => {
                    const osId = parseInt(os.obra_social_id || os.id);
                    const osNombre = os.nombre || 'Obra Social';

                    const btn = document.createElement('button');
                    btn.className = 'os-card btn btn-light shadow-sm d-flex flex-column justify-content-center align-items-center p-3 text-center';
                    btn.style.width = '180px';
                    btn.style.height = '120px';
                    btn.style.borderRadius = '12px';
                    btn.style.border = '1px solid rgba(0,0,0,0.05)';
                    btn.style.transition = 'all 0.3s ease';
                    
                    btn.innerHTML = `<span class="fw-semibold text-primary mb-2">${escapeHtml(osNombre)}</span>
                                     <small class="text-muted" style="font-size: 0.75rem;">
                                       Seleccionar
                                     </small>`;
                                     
                    btn.onmouseover = () => {
                        btn.classList.remove('btn-light');
                        btn.classList.add('btn-primary', 'text-white');
                        btn.querySelector('span').classList.remove('text-primary');
                        btn.querySelector('span').classList.add('text-white');
                        btn.querySelector('small').classList.remove('text-muted');
                        btn.querySelector('small').classList.add('text-white-50');
                        btn.style.transform = 'translateY(-3px)';
                        btn.style.boxShadow = '0 10px 20px rgba(13, 110, 253, 0.2)';
                    };
                    btn.onmouseout = () => {
                        btn.classList.add('btn-light');
                        btn.classList.remove('btn-primary', 'text-white');
                        btn.querySelector('span').classList.add('text-primary');
                        btn.querySelector('span').classList.remove('text-white');
                        btn.querySelector('small').classList.add('text-muted');
                        btn.querySelector('small').classList.remove('text-white-50');
                        btn.style.transform = 'translateY(0)';
                        btn.style.boxShadow = 'none';
                    };
                    
                    btn.onclick = () => wizardSelectCobertura(osId, osNombre);
                    container.appendChild(btn);
                });
            };

            const searchInput = document.getElementById('wizard-search-os');
            if (searchInput) {
                searchInput.oninput = (e) => {
                    const q = e.target.value.toLowerCase().trim();
                    const cards = container.querySelectorAll('.os-card');
                    cards.forEach(c => {
                        const txt = c.textContent.toLowerCase();
                        c.style.display = txt.includes(q) ? 'flex' : 'none';
                    });
                };
            }

            if(!data[0] || !data[0].obras_sociales || data[0].obras_sociales.length === 0) {
                container.innerHTML = `
                    <div class="col-12 text-center py-4">
                        <div class="alert alert-light border shadow-sm rounded-4 p-4 d-inline-block text-center" style="max-width: 500px;">
                            <i class="bi bi-info-circle-fill text-primary fs-3 d-block mb-2"></i>
                            <h6 class="fw-bold mb-1">Atención Particular Únicamente</h6>
                            <p class="text-muted small mb-3">Este profesional no tiene obras sociales asignadas en el sistema actualmente.</p>
                            <button class="btn btn-primary rounded-pill px-4 py-2 fw-semibold shadow-sm" onclick="wizardSelectCobertura('particular', 'Particular')">
                                <i class="bi bi-arrow-right-circle me-1"></i> Continuar de forma Particular
                            </button>
                        </div>
                    </div>
                `;
                const searchWrap = document.getElementById('wizard-search-os')?.parentElement;
                if (searchWrap) searchWrap.style.display = 'none';
                return;
            }
            
            const searchWrap = document.getElementById('wizard-search-os')?.parentElement;
            if (searchWrap) searchWrap.style.display = 'block';
            renderObras(data[0].obras_sociales);
        })
        .catch(err => {
            console.error("Error cargando coberturas", err);
            container.innerHTML = '<span class="text-danger">Error al cargar coberturas.</span>';
        });
};

window.wizardSelectCobertura = function(id, nombre) {
    // Actualizar barra superior
    document.getElementById('wizard-cobertura-nombre').textContent = nombre;
    document.getElementById('wizard-cobertura-nombre').classList.remove('text-muted');
    document.getElementById('btn-cambiar-cobertura').classList.remove('d-none');
    
    document.getElementById('wizard-step-2').classList.add('d-none');
    
    if(id === 'particular') {
        wizardData.coberturaId = 'particular';
        wizardData.coberturaNombre = 'Particular';
        wizardData.planId = null;
        wizardData.planNombre = null;
        wizardGoToStep4();
    } else {
        wizardData.coberturaId = parseInt(id);
        wizardData.coberturaNombre = nombre;
        wizardData.planId = null;
        wizardData.planNombre = null;
        wizardCargarPlanes(parseInt(id));
    }
};

window.wizardCargarPlanes = function(osId) {
    document.getElementById('wizard-step-3').classList.remove('d-none');
    const container = document.getElementById('wizard-planes-container');
    container.innerHTML = '<span class="text-muted">Cargando planes...</span>';
    
    // Limpiar buscador si existe
    const searchPlan = document.getElementById('wizard-search-plan');
    if(searchPlan) searchPlan.value = '';
    
    fetch(`backend/api/get_planes.php?obra_social_id=${osId}`)
        .then(res => res.json())
        .then(data => {
            container.innerHTML = '';
            if(!data || !Array.isArray(data) || data.length === 0) {
                // Si la obra social no tiene planes específicos, continuar directamente a días
                wizardData.planId = null;
                wizardData.planNombre = null;
                document.getElementById('wizard-step-3').classList.add('d-none');
                wizardGoToStep4();
                return;
            }

            if (searchPlan) {
                searchPlan.oninput = (e) => {
                    const q = e.target.value.toLowerCase().trim();
                    const cards = container.querySelectorAll('.plan-card');
                    cards.forEach(c => {
                        const txt = c.textContent.toLowerCase();
                        c.style.display = txt.includes(q) ? 'inline-flex' : 'none';
                    });
                };
            }

            data.forEach(plan => {
                const btn = document.createElement('button');
                btn.className = 'plan-card btn btn-outline-primary px-4 py-3 m-2 d-inline-flex align-items-center justify-content-center fw-semibold shadow-sm';
                btn.style.borderRadius = '50px';
                btn.style.minWidth = '200px';
                btn.textContent = plan.nombre;
                btn.onclick = () => {
                    wizardData.planId = parseInt(plan.id);
                    wizardData.planNombre = plan.nombre;
                    document.getElementById('wizard-cobertura-nombre').textContent = `${wizardData.coberturaNombre} - ${plan.nombre}`;
                    document.getElementById('wizard-step-3').classList.add('d-none');
                    wizardGoToStep4();
                };
                container.appendChild(btn);
            });
        })
        .catch(err => {
            console.error("Error cargando planes", err);
            wizardData.planId = null;
            wizardData.planNombre = null;
            document.getElementById('wizard-step-3').classList.add('d-none');
            wizardGoToStep4();
        });
};

window.wizardGoToStep4 = function() {
    document.getElementById('wizard-step-4').classList.remove('d-none');
    wizardRenderCalendarioMock();
};

window.wizardRenderCalendarioMock = function() {
    const container = document.getElementById('wizard-dias-container');
    container.innerHTML = `
        <div class="col-12 text-center text-muted py-3">
            <div class="spinner-border text-primary spinner-border-sm" role="status"></div>
            <span class="ms-2">Cargando agenda...</span>
        </div>
    `;
    
    // Ocultar el título del mes antiguo porque ahora pondremos un título por cada bloque
    const mesLabel = document.getElementById('wizard-mes-label');
    if (mesLabel) mesLabel.style.display = 'none';

    fetch('backend/api/config.php')
        .then(res => res.json())
        .then(async config => {
            const mesesConfig = parseInt(config.meses_agenda) || 3;
            let diasTotales = mesesConfig * 30; // approx general
            if (wizardData.medico && wizardData.medico.dias_antelacion_agenda && parseInt(wizardData.medico.dias_antelacion_agenda) > 0) {
                diasTotales = parseInt(wizardData.medico.dias_antelacion_agenda);
            }
            const hasta = new Date();
            hasta.setDate(hasta.getDate() + diasTotales);
            const fechaIso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const disponibilidadResp = await fetch(`backend/api/get_disponibilidad.php?medico_id=${encodeURIComponent(wizardData.medicoId)}&desde=${encodeURIComponent(fechaIso(new Date()))}&hasta=${encodeURIComponent(fechaIso(hasta))}`);
            if (!disponibilidadResp.ok) throw new Error('No se pudo consultar la disponibilidad.');
            wizardData.disponibilidad = await disponibilidadResp.json();
            container.innerHTML = '';
            
            const hoy = new Date();
            const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const diasMap = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
            const mesNombres = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
            
            const tieneHorariosCargados = wizardData.medico && Array.isArray(wizardData.medico.horarios) && wizardData.medico.horarios.length > 0;

            if (!tieneHorariosCargados) {
                container.innerHTML = `
                    <div class="col-12 text-center py-4">
                        <div class="alert alert-light border shadow-sm rounded-4 p-4 d-inline-block text-center" style="max-width: 500px;">
                            <i class="bi bi-calendar-x text-warning fs-1 d-block mb-2"></i>
                            <h6 class="fw-bold mb-1">Sin horarios configurados</h6>
                            <p class="text-muted small mb-0">El profesional no cuenta con horarios de atención asignados en este momento. Por favor, consulta más adelante o contacta al consultorio.</p>
                        </div>
                    </div>
                `;
                return;
            }

            let currentMonth = -1;
            let monthContainer = null;

            for(let i=1; i<=diasTotales; i++) {
                let d = new Date(hoy);
                d.setDate(hoy.getDate() + i);
                
                if(d.getDay() === 0) continue; // Skip Sundays
                
                // Si cambiamos de mes, creamos un nuevo header y contenedor
                if (d.getMonth() !== currentMonth) {
                    currentMonth = d.getMonth();
                    
                    const header = document.createElement('h4');
                    header.className = 'w-100 text-center fw-bold mt-4 mb-3 text-secondary';
                    header.style.letterSpacing = '2px';
                    header.textContent = mesNombres[currentMonth] + (d.getFullYear() !== hoy.getFullYear() ? ' ' + d.getFullYear() : '');
                    container.appendChild(header);
                    
                    monthContainer = document.createElement('div');
                    monthContainer.className = 'd-flex flex-wrap justify-content-center w-100 mb-4';
                    container.appendChild(monthContainer);
                }
                
                let diaNombre = dias[d.getDay()];
                let diaNorm = diasMap[d.getDay()];
                let diaNumero = d.getDate();
                
                const bloquesDelDia = wizardData.medico.horarios.filter(h => normalizarDia(h.dia_semana) === diaNorm);

                // Si no atiende este día de la semana
                if (bloquesDelDia.length === 0) {
                    const btn = document.createElement('button');
                    btn.className = 'btn btn-light m-2 d-flex flex-column align-items-center justify-content-center shadow-none text-muted opacity-50';
                    btn.style.width = '110px';
                    btn.style.height = '110px';
                    btn.style.borderRadius = '20px';
                    btn.style.cursor = 'not-allowed';
                    btn.disabled = true;
                    btn.innerHTML = `
                        <span class="text-uppercase fw-bold text-muted mb-1" style="font-size:0.8rem">${diaNombre}</span>
                        <span class="fs-2 fw-semibold mb-1 text-muted">${diaNumero}</span>
                        <small class="text-muted" style="font-size:0.7rem">Sin atención</small>
                    `;
                    monthContainer.appendChild(btn);
                    continue;
                }

                const fechaDelDia = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                const cupos = (wizardData.disponibilidad || []).filter(slot => slot.fecha === fechaDelDia).length;
                
                const btn = document.createElement('button');
                btn.className = `btn ${cupos ? 'btn-outline-primary' : 'btn-light text-muted opacity-50'} m-2 d-flex flex-column align-items-center justify-content-center shadow-sm`;
                btn.style.width = '110px';
                btn.style.height = '110px';
                btn.style.borderRadius = '20px';
                btn.style.transition = 'all 0.3s ease';
                
                btn.innerHTML = `
                    <span class="text-uppercase fw-bold text-muted mb-1" style="font-size:0.8rem">${diaNombre}</span>
                    <span class="fs-2 fw-bolder mb-1">${diaNumero}</span>
                    <small class="text-muted" style="font-size:0.7rem">${cupos} turnos</small>
                `;
                if (!cupos) {
                    btn.disabled = true;
                    btn.style.cursor = 'not-allowed';
                    btn.querySelector('small').textContent = 'Sin turnos';
                    monthContainer.appendChild(btn);
                    continue;
                }
                
                btn.onclick = () => {
                    const yaSeleccionado = btn.classList.contains('btn-primary');
                    
                    if (yaSeleccionado) {
                        btn.classList.remove('btn-primary', 'text-white');
                        btn.classList.add('btn-outline-primary');
                        btn.querySelectorAll('.text-muted').forEach(el => el.classList.remove('text-white-50'));
                        wizardData.fecha = null;
                        wizardData.hora = null;
                        const modalEl = document.getElementById('modalHorariosTurno');
                        const modalInstance = bootstrap.Modal.getInstance(modalEl);
                        if (modalInstance) modalInstance.hide();
                        return;
                    }

                    document.querySelectorAll('#wizard-dias-container .btn').forEach(b => {
                        b.classList.remove('btn-primary', 'text-white');
                        b.classList.add('btn-outline-primary');
                        b.querySelectorAll('.text-muted').forEach(el => el.classList.remove('text-white-50'));
                    });
                    btn.classList.remove('btn-outline-primary');
                    btn.classList.add('btn-primary', 'text-white');
                    btn.querySelectorAll('.text-muted').forEach(el => el.classList.add('text-white-50'));
                    
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    wizardData.fecha = `${year}-${month}-${day}`;
                    wizardAbrirModalHorarios(d);
                };
                
                monthContainer.appendChild(btn);
            }
            const resumeParams = new URLSearchParams(window.location.search);
            if (resumeParams.get('resume') === '1' && !wizardData.resumeOpened) {
                wizardData.resumeOpened = true;
                let pendingTurno = null;
                try { pendingTurno = JSON.parse(localStorage.getItem('turno_pendiente') || 'null'); } catch (_) {}
                if (pendingTurno && pendingTurno.fecha && pendingTurno.hora) {
                    const selectedDate = new Date(`${pendingTurno.fecha}T12:00:00`);
                    if (!Number.isNaN(selectedDate.getTime())) {
                        wizardAbrirModalHorarios(selectedDate);
                        const wantedTime = String(pendingTurno.hora).slice(0,5) + ' hs';
                        const timeButton = [...document.querySelectorAll('#modal-horarios-list .btn')].find(b => b.textContent.trim() === wantedTime);
                        if (timeButton) timeButton.click();
                        else alert('El horario que habías elegido ya no está libre. Elegí uno de los horarios disponibles.');
                    }
                }
            }
        })
        .catch(err => {
            console.error("Error cargando configuración", err);
            container.innerHTML = '<div class="alert alert-danger w-100">Error cargando la agenda. Intente nuevamente.</div>';
        });
};

window.wizardAbrirModalHorarios = function(dateObj) {
    const list = document.getElementById('modal-horarios-list');
    const btnConfirmar = document.getElementById('wizard-btn-confirmar');
    const labelFecha = document.getElementById('modal-fecha-seleccionada');
    const sedeBanner = document.getElementById('modal-sede-info-banner');
    const infoHora = document.getElementById('modal-horario-seleccionado-info');
    const textoHora = document.getElementById('modal-hora-texto');
    
    list.innerHTML = '';
    btnConfirmar.classList.add('d-none');
    if (infoHora) infoHora.classList.add('d-none');
    wizardData.hora = null;

    const diasNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diasMap = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const mesNombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    const diaNombre = diasNombres[dateObj.getDay()];
    const diaNorm = diasMap[dateObj.getDay()];
    const diaNumero = dateObj.getDate();
    const mesNombre = mesNombres[dateObj.getMonth()];

    labelFecha.textContent = `${diaNombre} ${diaNumero} de ${mesNombre}`;

    // Buscar si el médico tiene horario cargado para este día (insensible a acentos/mayúsculas)
    const tieneHorariosCargados = wizardData.medico && Array.isArray(wizardData.medico.horarios) && wizardData.medico.horarios.length > 0;
    const horariosDelDia = tieneHorariosCargados
        ? wizardData.medico.horarios.filter(h => normalizarDia(h.dia_semana) === diaNorm)
        : [];

    if (horariosDelDia.length > 0) {
        const primerH = horariosDelDia[0];
        wizardData.unidadId = primerH.unidad_id || null;
        wizardData.sedeNombre = primerH.unidad_nombre || '';

        if (primerH.unidad_nombre) {
            const dir = [primerH.unidad_calle, primerH.unidad_numero].filter(Boolean).join(' ');
            const loc = primerH.unidad_localidad || 'San Carlos de Bariloche';
            sedeBanner.innerHTML = `
                <button type="button" class="btn btn-link p-0 text-decoration-none badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 rounded-pill fs-6 fw-semibold shadow-sm"
                    data-nombre="${encodeURIComponent(primerH.unidad_nombre || '')}" 
                    data-calle="${encodeURIComponent(primerH.unidad_calle || '')}" 
                    data-numero="${encodeURIComponent(primerH.unidad_numero || '')}" 
                    data-localidad="${encodeURIComponent(loc)}"
                    data-lat="${escapeHtml(primerH.unidad_latitud || '')}"
                    data-lng="${escapeHtml(primerH.unidad_longitud || '')}"
                    onclick="abrirModalSedeDesdeBtn(this)"
                    title="Ver ubicación en Google Maps y cómo llegar"
                    style="cursor:pointer;">
                    <i class="bi bi-geo-alt-fill text-danger me-1"></i> ${escapeHtml(primerH.unidad_nombre)}${dir ? ' — ' + escapeHtml(dir) : ''} <span class="badge bg-primary text-white ms-1" style="font-size:0.68rem;"><i class="bi bi-map me-1"></i>Ver Mapa</span>
                </button>
            `;
            sedeBanner.classList.remove('d-none');
        } else {
            sedeBanner.innerHTML = '';
            sedeBanner.classList.add('d-none');
        }

        const fechaSeleccionada = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
        const slots = (wizardData.disponibilidad || []).filter(slot => slot.fecha === fechaSeleccionada);
        slots.forEach(slot => {
            const bloque = horariosDelDia.find(h => String(h.unidad_id || '') === String(slot.unidad_id)) || primerH;
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline-primary px-4 py-2 fw-bold shadow-sm rounded-pill';
            btn.textContent = slot.hora_inicio + ' hs';
            btn.onclick = () => {
                document.querySelectorAll('#modal-horarios-list .btn').forEach(b => {
                    b.classList.remove('btn-primary', 'text-white');
                    b.classList.add('btn-outline-primary');
                });
                btn.classList.remove('btn-outline-primary');
                btn.classList.add('btn-primary', 'text-white');
                wizardData.hora = slot.hora_inicio;
                wizardData.unidadId = slot.unidad_id;
                wizardData.sedeNombre = bloque.unidad_nombre || '';
                if (infoHora && textoHora) {
                    textoHora.textContent = slot.hora_inicio + ' hs';
                    infoHora.classList.remove('d-none');
                }
                btnConfirmar.classList.remove('d-none');
            };
            list.appendChild(btn);
        });
        if (!slots.length) list.innerHTML = '<div class="p-3 text-muted">No quedan turnos disponibles ese día. Actualizá la agenda.</div>';
    } else {
        sedeBanner.innerHTML = '';
        sedeBanner.classList.add('d-none');
        wizardData.unidadId = null;
        wizardData.sedeNombre = null;
        list.innerHTML = `
            <div class="py-4 text-center">
                <i class="bi bi-calendar-x text-warning fs-1 d-block mb-2"></i>
                <h6 class="fw-bold mb-1">Sin turnos disponibles</h6>
                <p class="text-muted small mb-0">El profesional no atiende los días ${diaNombre} o no tiene horarios disponibles configurados.</p>
            </div>
        `;
    }

    const modalEl = document.getElementById('modalHorariosTurno');
    const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
    modalInstance.show();
};

// Botones de retroceso
document.getElementById('btn-cambiar-profesional').addEventListener('click', () => {
    window.location.href = 'index.php';
});

document.getElementById('btn-cambiar-cobertura').addEventListener('click', () => {
    document.getElementById('wizard-step-4').classList.add('d-none');
    document.getElementById('wizard-step-3').classList.add('d-none');
    document.getElementById('wizard-step-2').classList.remove('d-none');
    document.getElementById('wizard-cobertura-nombre').textContent = 'Seleccionar...';
    document.getElementById('wizard-cobertura-nombre').classList.add('text-muted');
    document.getElementById('btn-cambiar-cobertura').classList.add('d-none');
});

// Confirmar Turno
document.getElementById('wizard-btn-confirmar').addEventListener('click', async () => {
    const localUser = JSON.parse(localStorage.getItem('user') || 'null');
    const currentUser = auth.currentUser || localUser;
    
    if (currentUser) {
        const btn = document.getElementById('wizard-btn-confirmar');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Guardando...';
        btn.disabled = true;

        const cobId = (wizardData.coberturaId && wizardData.coberturaId !== 'particular' && !isNaN(parseInt(wizardData.coberturaId))) ? parseInt(wizardData.coberturaId) : null;
        const plId = (wizardData.planId && !isNaN(parseInt(wizardData.planId))) ? parseInt(wizardData.planId) : null;

        const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
        fetch('backend/api/save_turno.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: Object.assign({ 'Content-Type': 'application/json' }, idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
            body: JSON.stringify({
                medico_id: wizardData.medicoId,
                especialidad_id: wizardData.especialidadId,
                cobertura_id: cobId,
                plan_id: plId,
                unidad_id: wizardData.unidadId || null,
                fecha: wizardData.fecha,
                hora: wizardData.hora,
            })
        })
        .then(async res => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.status === 'error') {
                throw new Error(data.message || 'Error al guardar el turno (HTTP ' + res.status + ')');
            }
            return data;
        })
        .then(data => {
            const sedeStr = wizardData.sedeNombre ? `\nSede: ${wizardData.sedeNombre}` : '';
            alert(`¡Turno reservado exitosamente!\n\nMédico: ${wizardData.medicoNombre}\nEspecialidad: ${wizardData.especialidadNombre}\nFecha: ${wizardData.fecha}\nHora: ${wizardData.hora}${sedeStr}\nCobertura: ${wizardData.coberturaNombre} ${wizardData.planNombre ? '- '+wizardData.planNombre : ''}`);
            localStorage.removeItem('turno_pendiente');
            window.location.href = 'dashboard.php';
        })
        .catch(err => {
            console.error("Error al guardar el turno", err);
            alert("No se pudo reservar el turno: " + err.message);
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        });
    } else {
        localStorage.setItem('turno_pendiente', JSON.stringify(wizardData));
        window.location.href = 'login.php?redirect=confirmar_turno';
    }
});
