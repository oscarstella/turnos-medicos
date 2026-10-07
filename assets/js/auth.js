// Determinar a dónde redirigir según el rol del usuario y sus turnos pendientes
async function redirigirSegunRol(u, urlParams) {
    if (urlParams.get('redirect') === 'confirmar_turno') {
        try {
            const pending = JSON.parse(localStorage.getItem('turno_pendiente') || 'null');
            if (pending && pending.medicoId) {
                window.location.href = `agendar.php?medico_id=${encodeURIComponent(pending.medicoId)}&resume=1`;
                return;
            }
        } catch (_) {}
    }
    if (urlParams.get('redirect') === 'agendar' && urlParams.get('medico_id')) {
        window.location.href = 'agendar.php?medico_id=' + urlParams.get('medico_id');
        return;
    }
    const esAdmin = ['superadmin', 'admin', 'recepcionista'].includes(u.rol);
    if (esAdmin) {
        window.location.href = 'dashboard.php';
        return;
    }

    // Para pacientes: verificar si tiene turnos pendientes
    try {
        if (typeof u.turnos_pendientes !== 'undefined' && u.turnos_pendientes !== null) {
            if (parseInt(u.turnos_pendientes) > 0) {
                window.location.href = 'dashboard.php';
                return;
            } else {
                window.location.href = 'index.php';
                return;
            }
        }

        // Si no viene calculado en el objeto, consultar get_mis_turnos.php
        const resp = await fetch('backend/api/get_mis_turnos.php', {
            credentials: 'same-origin'
        });
        const turnos = await resp.json().catch(() => []);
        const hoy = new Date().toISOString().split('T')[0];
        const tienePendientes = Array.isArray(turnos) && turnos.some(t => {
            const fechaValida = t.fecha >= hoy;
            const estadoValido = (t.estado || '').toLowerCase() === 'pendiente';
            return fechaValida && estadoValido;
        });

        if (tienePendientes) {
            window.location.href = 'dashboard.php';
        } else {
            window.location.href = 'index.php';
        }
    } catch (e) {
        // Fallback por defecto a la búsqueda de turnos
        window.location.href = 'index.php';
    }
}

// Si ya hay sesión activa guardada y no se solicitó logout explícito, redirigir
(function checkExistingSession() {
    const userSaved = localStorage.getItem('user');
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('logout') === 'true') {
        localStorage.removeItem('user');
        return;
    }
    if (userSaved) {
        try {
            const u = JSON.parse(userSaved);
            if (u && (u.email || u.id)) {
                redirigirSegunRol(u, urlParams);
            }
        } catch(e) {}
    }
})();

const loginForm = document.getElementById('login-form');
const googleLoginBtn = document.getElementById('google-login-btn');
const errorDiv = document.getElementById('login-error');

// URL base de la API (Ajustar al subir a oscarsoft.click)
const API_URL = 'backend/api';

function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('d-none');
}

// Iniciar sesión (soporta DNI o Email)
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorDiv.classList.add('d-none');
        
        const identifierInput = document.getElementById('login-identifier') || document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const identifier = identifierInput ? identifierInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';

        if (!identifier || !password) {
            showError('Por favor, ingresa tu DNI o Email y la contraseña.');
            return;
        }

        try {
            if (/^\d[\d.\s-]*$/.test(identifier)) {
                const response = await fetch(`${API_URL}/firebase_login.php`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dni: identifier, password })
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok || !result.id_token) throw new Error(result.message || 'DNI o contraseña incorrectos.');
                await handleBackendToken(result.id_token);
            } else {
                const userCredential = await auth.signInWithEmailAndPassword(identifier, password);
                if (!userCredential.user.emailVerified) {
                    await userCredential.user.sendEmailVerification();
                    showError('Verificá tu correo electrónico desde el enlace que te enviamos y después iniciá sesión nuevamente.');
                    await auth.signOut();
                    return;
                }
                const pendingProfile = JSON.parse(localStorage.getItem('pending_patient_profile') || 'null') || {};
                await handleBackendLogin(userCredential.user, pendingProfile);
                localStorage.removeItem('pending_patient_profile');
            }
        } catch (err) {
            showError(err.message || 'Error al conectar con el servidor.');
        }
    });
}

// Reutilizable para enviar datos extra al backend
async function handleBackendLogin(user, extraData = {}) {
    const token = await user.getIdToken();
    try {
        return await handleBackendToken(token, extraData);
    } catch (error) {
        if (!/DNI válido/.test(error.message)) throw error;
        const dni = window.prompt('Para completar tu ficha, ingresá tu DNI (solo para asociarlo a tu cuenta verificada de Firebase):');
        if (!dni) throw error;
        return handleBackendToken(token, { ...extraData, dni });
    }
}

async function handleBackendToken(idToken, extraData = {}) {
    const response = await fetch(`${API_URL}/auth.php`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
            nombre: extraData.nombre || '',
            apellido: extraData.apellido || "",
            dni: extraData.dni || null,
            fecha_nacimiento: extraData.fecha_nacimiento || null,
            telefono: extraData.telefono || null,
            obra_social_id: extraData.obra_social_id || null,
            plan_id: extraData.plan_id || null
        })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.user) throw new Error(data.message || 'No se pudo vincular la cuenta.');
    localStorage.setItem('user', JSON.stringify(data.user));
    const urlParams = new URLSearchParams(window.location.search);
    redirigirSegunRol(data.user, urlParams);
}

// Cargar Obras Sociales para el registro de paciente
const regOsSelect = document.getElementById('reg-obra-social');
const regPlSelect = document.getElementById('reg-plan');
if (regOsSelect && regPlSelect) {
    fetch(`${API_URL}/crud_obras_sociales.php`)
        .then(res => res.json())
        .then(data => {
            if (data && data.length > 0) {
                data.forEach(os => {
                    const opt = document.createElement('option');
                    opt.value = os.id;
                    opt.textContent = os.nombre;
                    regOsSelect.appendChild(opt);
                });
            }
        })
        .catch(() => {});

    regOsSelect.addEventListener('change', () => {
        const osId = regOsSelect.value;
        regPlSelect.innerHTML = '<option value="">Cargando planes...</option>';
        regPlSelect.disabled = true;

        if (!osId) {
            regPlSelect.innerHTML = '<option value="">Particular / Sin plan</option>';
            return;
        }

        fetch(`${API_URL}/get_planes.php?obra_social_id=${osId}`)
            .then(res => res.json())
            .then(planes => {
                regPlSelect.innerHTML = '';
                if (planes && planes.length > 0) {
                    planes.forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = p.id;
                        opt.textContent = p.nombre;
                        regPlSelect.appendChild(opt);
                    });
                    regPlSelect.disabled = false;
                } else {
                    regPlSelect.innerHTML = '<option value="">Plan Único</option>';
                    regPlSelect.disabled = false;
                }
            })
            .catch(() => {
                regPlSelect.innerHTML = '<option value="">Plan General</option>';
                regPlSelect.disabled = false;
            });
    });
}

// Registro Completo de Paciente
const registerForm = document.getElementById('register-form');
if(registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const osSelect = document.getElementById('reg-obra-social');
        const plSelect = document.getElementById('reg-plan');
        const extraData = {
            nombre: document.getElementById('reg-nombre').value,
            apellido: document.getElementById('reg-apellido').value,
            dni: document.getElementById('reg-dni').value,
            fecha_nacimiento: document.getElementById('reg-fecha-nac').value,
            telefono: document.getElementById('reg-telefono').value,
            obra_social_id: osSelect && osSelect.value ? parseInt(osSelect.value) : null,
            plan_id: plSelect && plSelect.value ? parseInt(plSelect.value) : null
        };
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            localStorage.setItem('pending_patient_profile', JSON.stringify(extraData));
            await userCredential.user.sendEmailVerification();
            await auth.signOut();
            showError('Te enviamos un correo para verificar la cuenta. Abrí el enlace y luego iniciá sesión para terminar de vincular tu DNI.');
        } catch (error) {
            showError('No se pudo crear la cuenta: ' + error.message);
        }
    });
}

// Login con Google
if(googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        auth.signInWithPopup(googleProvider)
            .then((result) => {
                return handleBackendLogin(result.user);
            })
            .catch((error) => {
                showError('Error al iniciar sesión con Google: ' + error.message);
            });
    });
}

// Recuperar contraseña
const forgotPasswordLink = document.getElementById('forgot-password-link');
if(forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('login-identifier') || document.getElementById('login-email');
        const email = emailInput ? emailInput.value.trim() : '';
        if(!email || !email.includes('@')) {
            showError('Por favor, ingresa tu correo electrónico en el campo superior para enviarte el enlace de recuperación.');
            return;
        }
        
        auth.sendPasswordResetEmail(email)
            .then(() => {
                alert('Se ha enviado un correo para restablecer tu contraseña. Revisa tu bandeja de entrada.');
            })
            .catch((error) => {
                showError('Error al recuperar contraseña: ' + error.message);
            });
    });
}
