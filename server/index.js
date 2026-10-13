const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const pacienteRoutes = require('./routes/paciente');
const medicoRoutes = require('./routes/medico');
const adminRoutes = require('./routes/admin');
const whatsappRoutes = require('./routes/whatsapp');

const app = express();
const PORT = process.env.PORT || 5060;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get(['/health', '/api/health', '/api/turnos/health'], (req, res) => {
  res.json({ status: 'ok', service: 'oscarsoft-turnos-api', timestamp: new Date() });
});

// Registrar Rutas de la API (soporta tanto /api/* como /api/turnos/*)
app.use(['/api/auth', '/api/turnos/auth'], authRoutes);
app.use(['/api/public', '/api/turnos/public'], publicRoutes);
app.use(['/api/paciente', '/api/turnos/paciente'], pacienteRoutes);
app.use(['/api/medico', '/api/turnos/medico'], medicoRoutes);
app.use(['/api/admin', '/api/turnos/admin'], adminRoutes);
app.use(['/api/whatsapp', '/api/turnos/whatsapp'], whatsappRoutes);

// Servir frontend React compilado si existe
const distPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(distPath)) {
  app.use('/turnos', express.static(distPath));
  app.use(express.static(distPath));

  app.get('/turnos/*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
} else {
  app.get('/', (req, res) => {
    res.send('<h1>OscarSoft Turnos API</h1><p>El backend de Node.js está activo.</p>');
  });
}

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ status: 'error', message: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Turnos Backend corriendo en http://localhost:${PORT}`);
});
