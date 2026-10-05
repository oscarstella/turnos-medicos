// Determinar a dónde redirigir según el rol del usuario
function redirigirSegunRol(u, urlParams) {
    if (urlParams.get('redirect') === 'agendar' && urlParams.get('medico_id')) {
        window.location.href = 'agendar.php?medico_id=' + urlParams.get('medico_id');
        return;
    }
    const esAdmin = ['superadmin', 'admin', 'recepcionista'].includes(u.rol);
    if (esAdmin) {
        window.location.href = 'dashboard.php';
    } else {
        // Los pacientes y clientes van a la página principal de la clínica
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
            // Intentar primero autenticación local con DB (soporta DNI o Email)
            const resp = await fetch(`${API_URL}/db_login.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: identifier, password: password })
            });
            const dbData = await resp.json().catch(() => ({}));

            if (dbData.status === 'success' && dbData.user) {
                localStorage.setItem('user', JSON.stringify(dbData.user));
                const urlParams = new URLSearchParams(window.location.search);
                redirigirSegunRol(dbData.user, urlParams);
                return;
            }

            // Si el backend indica que debe autenticarse con Firebase o no se encontró contraseña local
            const firebaseEmail = (dbData.email && dbData.email.includes('@')) ? dbData.email : identifier;
            if (!firebaseEmail.includes('@')) {
                showError(dbData.message || 'Contraseña o credenciales incorrectas.');
                return;
            }

            // Intentar login con Firebase usando el email resuelto
            auth.signInWithEmailAndPassword(firebaseEmail, password)
                .then((userCredential) => {
                    handleBackendLogin(userCredential.user);
                })
                .catch((fbErr) => {
                    showError('Error al iniciar sesión: ' + (dbData.message || fbErr.message));
                });

        } catch (err) {
            showError('Error al conectar con el servidor.');
        }
    });
}

// Reutilizable para enviar datos extra al backend
function handleBackendLogin(user, extraData = {}) {
    fetch(`${API_URL}/auth.php`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            firebase_uid: user.uid,
            email: user.email,
            nombre: extraData.nombre || user.displayName || user.email.split('@')[0],
            apellido: extraData.apellido || "",
            dni: extraData.dni || null,
            fecha_nacimiento: extraData.fecha_nacimiento || null,
            telefono: extraData.telefono || null,
            obra_social_id: extraData.obra_social_id || null,
            plan_id: extraData.plan_id || null
        })
    })
    .then(response => response.json())
    .then(data => {
        if(data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Check for redirect params
            const urlParams = new URLSearchParams(window.location.search);
            redirigirSegunRol(data.user, urlParams);
        } else {
            showError(data.message || 'Error al conectar con el servidor.');
        }
    })
    .catch(error => {
        showError('Ocurrió un error en el servidor.');
    });
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
    registerForm.addEventListener('submit', (e) => {
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

        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                handleBackendLogin(userCredential.user, extraData);
            })
            .catch((error) => {
                showError('Error al crear cuenta: ' + error.message);
            });
    });
}

// Login con Google
if(googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => {
        auth.signInWithPopup(googleProvider)
            .then((result) => {
                // El login de google no tiene DNI ni los otros campos en esta etapa,
                // idealmente se debería redirigir a "Completar Perfil". 
                // Por ahora se envía lo básico.
                handleBackendLogin(result.user);
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
