let medicosGlobal = [];
window.medicosGlobal = medicosGlobal;

// Helper: Limpiar nombres y apellidos (quitar direcciones o textos entre paréntesis)
function limpiarNombre(str) {
    if (!str) return '';
    return str.replace(/\s*\([^)]*\)/g, '').replace(/\s*–\s*\d+.*$/g, '').trim();
}
window.limpiarNombre = limpiarNombre;

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

    document.getElementById('modal-sede-mapa-nombre').textContent = nombre;
    document.getElementById('modal-sede-mapa-direccion').textContent = dirCompleta;

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
    const filterNombre = document.getElementById('filter-nombre');
    const filterEspecialidad = document.getElementById('filter-especialidad');
    const filterCobertura = document.getElementById('filter-cobertura');
    const resultsContainer = document.getElementById('results-container');
    
    // Cargar Coberturas (Obras Sociales)
    fetch('backend/api/crud_obras_sociales.php')
        .then(response => response.json())
        .then(data => {
            data.forEach(os => {
                const option = document.createElement('option');
                option.value = os.id;
                option.textContent = os.nombre;
                filterCobertura.appendChild(option);
            });
            // Initialize Select2 after options are loaded
            $(filterCobertura).select2({
                theme: 'bootstrap-5',
                placeholder: 'Todas las coberturas',
                allowClear: true
            });
        });

    // Cargar Profesionales para el select
    fetch('backend/api/get_public_agenda.php')
        .then(response => response.json())
        .then(data => {
            if(data) {
                // Remove duplicates in case
                const unicos = new Map();
                data.forEach(med => {
                    if(!unicos.has(med.id)) {
                        unicos.set(med.id, med);
                    }
                });
                unicos.forEach(med => {
                    const option = document.createElement('option');
                    option.value = med.id;
                    option.textContent = limpiarNombre(med.nombre) + ' ' + limpiarNombre(med.apellido);
                    filterNombre.appendChild(option);
                });
            }
            // Initialize Select2 after options are loaded
            $(filterNombre).select2({
                theme: 'bootstrap-5',
                placeholder: 'Todos los profesionales',
                allowClear: true
            });
        });

    // Initialize Select2 for especialidades after options are loaded
    fetch('backend/api/get_especialidades.php')
        .then(response => response.json())
        .then(data => {
            data.forEach(esp => {
                const option = document.createElement('option');
                option.value = esp.id;
                option.textContent = esp.nombre;
                filterEspecialidad.appendChild(option);
            });
            $(filterEspecialidad).select2({
                theme: 'bootstrap-5',
                placeholder: 'Todas las especialidades',
                allowClear: true
            });
        });

    // Función para renderizar los médicos
    const loadAgenda = () => {
        resultsContainer.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-border text-primary" role="status"></div>
                <div class="mt-2">Buscando profesionales...</div>
            </div>`;

        const params = new URLSearchParams();
        if (filterNombre.value) params.append('medico_id', filterNombre.value);
        if (filterEspecialidad.value) params.append('especialidad_id', filterEspecialidad.value);
        if (filterCobertura.value) params.append('obra_social_id', filterCobertura.value);

        fetch(`backend/api/get_public_agenda.php?${params.toString()}`)
            .then(response => response.json())
            .then(medicos => {
                resultsContainer.innerHTML = '';
                medicosGlobal = medicos || [];
                window.medicosGlobal = medicosGlobal;
                
                if (!medicos || medicos.length === 0) {
                    resultsContainer.innerHTML = `<div class="alert alert-info text-center mt-4">No se encontraron profesionales con esos criterios.</div>`;
                    return;
                }

                medicos.forEach(medico => {
                    const col = document.createElement('div');
                    col.className = 'col-12 col-md-6 col-lg-4 col-xl-3 d-flex';
                    
                    // Especialidades
                    const especialidadesText = escapeHtml((medico.especialidades || []).map(e => e.nombre).join(', ') || 'Medicina General');
                    
                    // Botón Coberturas
                    const cantCoberturas = medico.obras_sociales ? medico.obras_sociales.length : 0;
                    const coberturasBtnHtml = `
                        <button type="button" class="btn btn-outline-primary btn-sm rounded-pill w-100 mb-3 fw-medium" onclick="abrirModalCoberturasPaciente(${medico.id})">
                            <i class="bi bi-shield-check me-1"></i> Ver Coberturas ${cantCoberturas > 0 ? '(' + cantCoberturas + ')' : ''}
                        </button>
                    `;
                                 // Horarios (formato 24 hs estricto con Centro de Atención / Sede clickeable)
                    let horariosHtml = '';
                    if (medico.horarios && medico.horarios.length > 0) {
                        medico.horarios.forEach(h => {
                            const inicio = h.hora_inicio ? h.hora_inicio.substring(0, 5) : '';
                            const fin = h.hora_fin ? h.hora_fin.substring(0, 5) : '';
                            const sedeTxt = h.unidad_nombre 
                                ? `<button type="button" class="btn btn-link p-0 text-decoration-none badge bg-primary-subtle text-primary border border-primary-subtle ms-1 text-truncate" 
                                    style="font-size:0.72rem; font-weight:600; cursor:pointer; max-width: 140px; vertical-align: middle;" 
                                    data-nombre="${encodeURIComponent(h.unidad_nombre || '')}" 
                                    data-calle="${encodeURIComponent(h.unidad_calle || '')}" 
                                    data-numero="${encodeURIComponent(h.unidad_numero || '')}" 
                                    data-localidad="${encodeURIComponent(h.unidad_localidad || '')}"
                                    data-lat="${escapeHtml(h.unidad_latitud || '')}"
                                    data-lng="${escapeHtml(h.unidad_longitud || '')}"
                                    onclick="abrirModalSedeDesdeBtn(this)" 
                                    title="Ver ubicación en Google Maps y cómo llegar">
                                    <i class="bi bi-geo-alt-fill text-danger me-1"></i>${escapeHtml(h.unidad_nombre)}
                                   </button>` 
                                : '';
                            horariosHtml += `
                                <div class="small mb-1 d-flex justify-content-between align-items-center py-1 border-bottom border-light-subtle">
                                    <span><i class="bi bi-clock me-1 text-primary"></i> <strong>${escapeHtml(h.dia_semana)}:</strong> ${escapeHtml(inicio)} a ${escapeHtml(fin)} hs</span>
                                    ${sedeTxt}
                                </div>`;
                        });
                    } else {
                        horariosHtml = `<div class="text-muted small py-1"><i class="bi bi-calendar-x me-1"></i> Sin horarios cargados</div>`;
                    }

                    // Foto del médico o fallback por género
                    const nombreLimpio = limpiarNombre(medico.nombre);
                    const apellidoLimpio = limpiarNombre(medico.apellido);
                    const avatarDefault = obtenerAvatarDefault(nombreLimpio, apellidoLimpio);
                    const fotoUrlRaw = (medico.foto_perfil && medico.foto_perfil.trim() !== '')
                        ? medico.foto_perfil 
                        : ((medico.foto_url && medico.foto_url.trim() !== '') ? medico.foto_url : avatarDefault);
                    const fotoUrl = escapeHtml(safeImageUrl(fotoUrlRaw, avatarDefault));

                    col.innerHTML = `
                        <div class="card w-100 border-0 shadow-sm glass-card hover-lift" style="border-radius: 1rem; overflow: hidden; transition: transform 0.3s ease, box-shadow 0.3s ease;">
                            <div class="text-center pt-4 pb-2" style="background: rgba(248,249,250,0.5);">
                            <img src="${fotoUrl}" alt="Dr. ${escapeHtml(apellidoLimpio)}" class="rounded-circle shadow-sm border border-3 border-white" style="width: 120px; height: 120px; object-fit: cover;" onerror="this.onerror=null; this.src='${escapeHtml(avatarDefault)}';">
                            </div>
                            <div class="card-body d-flex flex-column text-center">
                                <h5 class="card-title fw-bold mb-1">${escapeHtml(nombreLimpio)} ${escapeHtml(apellidoLimpio)}</h5>
                                <h6 class="card-subtitle mb-3 text-primary fw-semibold">${especialidadesText}</h6>
                                ${coberturasBtnHtml}
                                <div class="bg-light rounded-3 p-2 mb-3 text-start" style="max-height: 140px; overflow-y: auto;">
                                    ${horariosHtml}
                                </div>
                                <button class="btn btn-primary rounded-pill w-100 mt-auto fw-semibold py-2" onclick="agendarTurno(${medico.id})">
                                    Agendar Turno
                                </button>
                            </div>
                        </div>
                    `;
                    resultsContainer.appendChild(col);
                });
            })
            .catch(error => {
                resultsContainer.innerHTML = `<div class="alert alert-danger text-center mt-4">Ocurrió un error al cargar la agenda. Intenta nuevamente más tarde.</div>`;
                console.error(error);
            });
    };

    // Listeners
    $(filterNombre).on('change', loadAgenda);
    $(filterEspecialidad).on('change', loadAgenda);
    $(filterCobertura).on('change', loadAgenda);

    // Carga inicial
    loadAgenda();
});

// Función para el botón Agendar
window.agendarTurno = function(medicoId) {
    window.location.href = 'agendar.php?medico_id=' + medicoId;
};

function renderizarListaCoberturasModal(med, listContainer) {
    if (med.obras_sociales && med.obras_sociales.length > 0) {
        let itemsHtml = '<h6 class="fw-bold text-muted small text-uppercase mb-2">Coberturas y Obras Sociales Aceptadas:</h6>';
        itemsHtml += '<div class="list-group list-group-flush border rounded-3 p-2 bg-light" style="max-height: 280px; overflow-y: auto;">';
        med.obras_sociales.forEach(os => {
            itemsHtml += `
                <div class="list-group-item bg-transparent d-flex align-items-center py-2 border-0">
                    <i class="bi bi-shield-check text-success fs-5 me-2"></i>
                    <span class="fw-medium text-dark">${escapeHtml(os.nombre)}</span>
                </div>
            `;
        });
        itemsHtml += '</div>';
        itemsHtml += '<p class="text-muted small mt-2 mb-0"><i class="bi bi-info-circle me-1"></i> Puedes seleccionar tu cobertura al agendar el turno.</p>';
        listContainer.innerHTML = itemsHtml;
    } else {
        listContainer.innerHTML = `
            <div class="alert alert-info border-0 rounded-3 mb-0">
                <div class="d-flex align-items-start">
                    <i class="bi bi-info-circle-fill fs-4 me-2 text-primary"></i>
                    <div>
                        <strong class="text-dark">Atención Particular</strong>
                        <p class="small text-muted mb-0">Este profesional actualmente no tiene convenios de obras sociales directos cargados o atiende de forma particular. Puedes solicitar factura para reintegro.</p>
                    </div>
                </div>
            </div>
        `;
    }
}

// Modal de Coberturas para el Paciente
window.abrirModalCoberturasPaciente = function(medicoId) {
    const listContainer = document.getElementById('modal-coberturas-paciente-list');
    const infoContainer = document.getElementById('modal-coberturas-paciente-medico-info');
    const btnAgendar = document.getElementById('modal-coberturas-paciente-btn-agendar');

    let med = (window.medicosGlobal || []).find(m => m.id == medicoId);

    // Si ya tenemos los datos en memoria, mostramos inmediatamente
    if (med) {
        const nomLimpio = limpiarNombre(med.nombre);
        const apeLimpio = limpiarNombre(med.apellido);
        const avatarDefault = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(nomLimpio + ' ' + apeLimpio) + '&background=e9ecef&color=6c757d&size=200';
        const foto = escapeHtml(safeImageUrl((med.foto_perfil && med.foto_perfil.trim() !== '') ? med.foto_perfil : (med.foto_url || avatarDefault), avatarDefault));

        infoContainer.innerHTML = `
            <img src="${foto}" class="rounded-circle shadow-sm mb-2" style="width: 80px; height: 80px; object-fit: cover;" onerror="this.onerror=null; this.src='${escapeHtml(avatarDefault)}';">
            <h5 class="fw-bold mb-0">${escapeHtml(nomLimpio)} ${escapeHtml(apeLimpio)}</h5>
            <small class="text-primary fw-semibold">${escapeHtml((med.especialidades || []).map(e => e.nombre).join(', ') || 'Medicina General')}</small>
        `;
        renderizarListaCoberturasModal(med, listContainer);
        btnAgendar.onclick = function() {
            window.location.href = 'agendar.php?medico_id=' + med.id;
        };
    } else {
        listContainer.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary spinner-border-sm" role="status"></div>
                <div class="small text-muted mt-2">Cargando coberturas...</div>
            </div>
        `;
    }

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCoberturasPaciente'));
    modal.show();

    // Actualización dinámica en tiempo real desde el servidor
    fetch(`backend/api/get_public_agenda.php?medico_id=${medicoId}`)
        .then(res => res.json())
        .then(data => {
            if (data && data.length > 0) {
                const medActualizado = data[0];
                if (!window.medicosGlobal) window.medicosGlobal = [];
                const idx = window.medicosGlobal.findIndex(m => m.id == medicoId);
                if (idx !== -1) {
                    window.medicosGlobal[idx] = medActualizado;
                } else {
                    window.medicosGlobal.push(medActualizado);
                }

                const avatarDefault = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(medActualizado.nombre + ' ' + medActualizado.apellido) + '&background=e9ecef&color=6c757d&size=200';
                const foto = escapeHtml(safeImageUrl((medActualizado.foto_perfil && medActualizado.foto_perfil.trim() !== '') ? medActualizado.foto_perfil : (medActualizado.foto_url || avatarDefault), avatarDefault));

                infoContainer.innerHTML = `
                    <img src="${foto}" class="rounded-circle shadow-sm mb-2" style="width: 80px; height: 80px; object-fit: cover;" onerror="this.onerror=null; this.src='${escapeHtml(avatarDefault)}';">
                    <h5 class="fw-bold mb-0">${escapeHtml(medActualizado.nombre)} ${escapeHtml(medActualizado.apellido)}</h5>
                    <small class="text-primary fw-semibold">${escapeHtml((medActualizado.especialidades || []).map(e => e.nombre).join(', ') || 'Medicina General')}</small>
                `;

                renderizarListaCoberturasModal(medActualizado, listContainer);

                btnAgendar.onclick = function() {
                    window.location.href = 'agendar.php?medico_id=' + medActualizado.id;
                };
            }
        })
        .catch(err => {
            console.error('Error al actualizar coberturas dinámicamente:', err);
        });
};

// Utils: Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function safeImageUrl(value, fallback) {
    const candidate = String(value || fallback || '');
    try { const parsed = new URL(candidate, window.location.href); return ['http:','https:'].includes(parsed.protocol) ? parsed.href : fallback; }
    catch (_) { return fallback; }
}
