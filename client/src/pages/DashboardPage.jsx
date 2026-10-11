import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import { obtenerAvatarDefault } from '../utils/avatar';
import { 
  Users, 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Plus, 
  Search, 
  Settings, 
  Building2, 
  Award, 
  CreditCard, 
  ShieldCheck, 
  Save, 
  Trash2,
  Edit,
  Eye,
  X
} from 'lucide-react';

const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];

export default function DashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('turnos');

  // Stats
  const [stats, setStats] = useState(null);

  // Turnos Tab
  const [turnos, setTurnos] = useState([]);
  const [filtroFecha, setFiltroFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [filtroMedico, setFiltroMedico] = useState('');
  const [filtroSede, setFiltroSede] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroSearch, setFiltroSearch] = useState('');

  // Médicos Tab
  const [medicos, setMedicos] = useState([]);
  const [showMedicoModal, setShowMedicoModal] = useState(false);
  const [medicoForm, setMedicoForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    dni: '',
    matricula: '',
    password: '',
    telefono: '',
    biografia: '',
    direccion: '',
    dias_antelacion_agenda: 60,
    dia_apertura_agenda: '',
    especialidades: []
  });

  // Obras Sociales & Planes Tab
  const [adminObrasSociales, setAdminObrasSociales] = useState([]);
  const [adminObrasSearch, setAdminObrasSearch] = useState('');
  const [adminObrasLoading, setAdminObrasLoading] = useState(false);
  const [adminObrasPage, setAdminObrasPage] = useState(1);
  const [showNewObraModal, setShowNewObraModal] = useState(false);
  const [newObraNombre, setNewObraNombre] = useState('');
  const [newObraPlanesTexto, setNewObraPlanesTexto] = useState('');
  const [selectedObraForPlanes, setSelectedObraForPlanes] = useState(null);
  const [modalPlanesList, setModalPlanesList] = useState([]);
  const [newPlanNombre, setNewPlanNombre] = useState('');
  const [editingObraId, setEditingObraId] = useState(null);
  const [editingObraNombre, setEditingObraNombre] = useState('');

  // Horarios Tab
  const [horariosMedicoId, setHorariosMedicoId] = useState('');
  const [horariosBloques, setHorariosBloques] = useState([]);
  const [savingHorarios, setSavingHorarios] = useState(false);

  // Reglas Tab & Configuración Global
  const [globalMesesAgenda, setGlobalMesesAgenda] = useState(3);
  const [savingGlobalConfig, setSavingGlobalConfig] = useState(false);
  const [reglasMedicoId, setReglasMedicoId] = useState('');
  const [reglasAntelacion, setReglasAntelacion] = useState('');
  const [reglasApertura, setReglasApertura] = useState('');
  const [savingReglas, setSavingReglas] = useState(false);

  // Especialidades & Sedes
  const [especialidades, setEspecialidades] = useState([]);
  const [newEspecialidad, setNewEspecialidad] = useState('');
  const [sedes, setSedes] = useState([]);
  const [newSede, setNewSede] = useState({ nombre: '', calle: '', numero: '', localidad: 'San Carlos de Bariloche' });

  // Usuarios Tab
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioSearch, setUsuarioSearch] = useState('');
  const [rolFiltro, setRolFiltro] = useState('');

  // Feedback Toast
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const fetchStats = () => {
    api.get('/admin/stats').then(res => setStats(res.data)).catch(console.error);
  };

  const fetchTurnos = () => {
    const params = new URLSearchParams();
    if (filtroFecha) params.append('fecha', filtroFecha);
    if (filtroMedico) params.append('medico_id', filtroMedico);
    if (filtroSede) params.append('unidad_id', filtroSede);
    if (filtroEstado) params.append('estado', filtroEstado);
    if (filtroSearch) params.append('q', filtroSearch);

    api.get(`/admin/turnos?${params.toString()}`)
      .then(res => setTurnos(res.data || []))
      .catch(console.error);
  };

  const fetchMedicos = () => {
    api.get('/admin/medicos')
      .then(res => setMedicos(res.data || []))
      .catch(console.error);
  };

  const fetchCatalogos = () => {
    api.get('/admin/especialidades').then(res => setEspecialidades(res.data || [])).catch(console.error);
    api.get('/admin/unidades').then(res => setSedes(res.data || [])).catch(console.error);
  };

  const fetchUsuarios = () => {
    const params = new URLSearchParams();
    if (usuarioSearch) params.append('q', usuarioSearch);
    if (rolFiltro) params.append('rol', rolFiltro);
    api.get(`/admin/usuarios?${params.toString()}`).then(res => setUsuarios(res.data || [])).catch(console.error);
  };

  const fetchObrasSociales = () => {
    setAdminObrasLoading(true);
    const params = adminObrasSearch ? `?q=${encodeURIComponent(adminObrasSearch)}` : '';
    api.get(`/admin/obras-sociales${params}`)
      .then(res => {
        setAdminObrasSociales(res.data || []);
        setAdminObrasPage(1);
      })
      .catch(console.error)
      .finally(() => setAdminObrasLoading(false));
  };

  const fetchConfig = () => {
    api.get('/admin/config')
      .then(res => {
        if (res.data && res.data.meses_agenda) {
          setGlobalMesesAgenda(parseInt(res.data.meses_agenda, 10) || 3);
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchStats();
    fetchTurnos();
    fetchMedicos();
    fetchCatalogos();
    fetchConfig();
    fetchObrasSociales();
  }, []);

  useEffect(() => {
    fetchTurnos();
  }, [filtroFecha, filtroMedico, filtroSede, filtroEstado, filtroSearch]);

  useEffect(() => {
    fetchUsuarios();
  }, [usuarioSearch, rolFiltro]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchObrasSociales();
    }, 250);
    return () => clearTimeout(timer);
  }, [adminObrasSearch]);

  const handleCreateObra = async (e) => {
    e.preventDefault();
    if (!newObraNombre.trim()) return;
    try {
      const planesArr = newObraPlanesTexto.split('\n').map(p => p.trim()).filter(Boolean);
      await api.post('/admin/obras-sociales', { nombre: newObraNombre.trim(), planes: planesArr });
      showToast('Obra social creada exitosamente');
      setShowNewObraModal(false);
      setNewObraNombre('');
      setNewObraPlanesTexto('');
      fetchObrasSociales();
    } catch (err) {
      showToast(err.message || 'Error al crear obra social');
    }
  };

  const handleOpenPlanesModal = async (obra) => {
    setSelectedObraForPlanes(obra);
    try {
      const res = await api.get(`/admin/obras-sociales/${obra.id}/planes`);
      setModalPlanesList(res.data || []);
    } catch {
      setModalPlanesList([]);
    }
  };

  const handleAddPlanToObra = async (e) => {
    e.preventDefault();
    if (!newPlanNombre.trim() || !selectedObraForPlanes) return;
    try {
      await api.post(`/admin/obras-sociales/${selectedObraForPlanes.id}/planes`, { nombre: newPlanNombre.trim() });
      showToast('Plan agregado exitosamente');
      setNewPlanNombre('');
      handleOpenPlanesModal(selectedObraForPlanes);
      fetchObrasSociales();
    } catch (err) {
      showToast(err.message || 'Error al agregar plan');
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm('¿Deseas eliminar este plan?')) return;
    try {
      await api.delete(`/admin/planes/${planId}`);
      showToast('Plan eliminado');
      handleOpenPlanesModal(selectedObraForPlanes);
      fetchObrasSociales();
    } catch (err) {
      showToast(err.message || 'Error al eliminar plan');
    }
  };

  const handleUpdateObra = async (id) => {
    if (!editingObraNombre.trim()) return;
    try {
      await api.put(`/admin/obras-sociales/${id}`, { nombre: editingObraNombre.trim() });
      showToast('Obra social actualizada');
      setEditingObraId(null);
      fetchObrasSociales();
    } catch (err) {
      showToast(err.message || 'Error al actualizar obra social');
    }
  };

  const handleDeleteObra = async (obraId) => {
    if (!window.confirm('¿Eliminar esta obra social y todos sus planes asociados?')) return;
    try {
      await api.delete(`/admin/obras-sociales/${obraId}`);
      showToast('Obra social eliminada');
      fetchObrasSociales();
    } catch (err) {
      showToast(err.message || 'Error al eliminar obra social');
    }
  };

  useEffect(() => {
    if (activeTab === 'usuarios') fetchUsuarios();
    if (activeTab === 'reglas') fetchConfig();
  }, [activeTab, usuarioSearch]);

  const handleUpdateEstadoTurno = async (turnoId, nuevoEstado) => {
    try {
      await api.put(`/admin/turnos/${turnoId}/estado`, { estado: nuevoEstado });
      showToast(`Turno actualizado a "${nuevoEstado}".`);
      fetchTurnos();
      fetchStats();
    } catch (err) {
      alert(err.message || 'Error al actualizar turno.');
    }
  };

  const handleSelectMedicoHorarios = (medicoId) => {
    setHorariosMedicoId(medicoId);
    if (!medicoId) {
      setHorariosBloques([]);
      return;
    }
    api.get(`/admin/horarios/${medicoId}`).then(res => {
      setHorariosBloques(res.data || []);
    }).catch(console.error);
  };

  const handleAddBloqueHorario = () => {
    setHorariosBloques([
      ...horariosBloques,
      {
        dia_semana: 'Lunes',
        hora_inicio: '09:00:00',
        hora_fin: '13:00:00',
        duracion_turno_minutos: 30,
        unidad_id: sedes[0]?.id || null
      }
    ]);
  };

  const handleRemoveBloqueHorario = (index) => {
    setHorariosBloques(horariosBloques.filter((_, i) => i !== index));
  };

  const handleSaveHorarios = async () => {
    if (!horariosMedicoId) return;
    setSavingHorarios(true);
    try {
      await api.put(`/admin/horarios/${horariosMedicoId}`, { bloques: horariosBloques });
      showToast('Horarios de atención guardados correctamente.');
    } catch (err) {
      alert(err.message || 'Error al guardar horarios.');
    } finally {
      setSavingHorarios(false);
    }
  };

  const handleSaveGlobalConfig = async () => {
    setSavingGlobalConfig(true);
    try {
      await api.post('/admin/config', {
        meses_agenda: parseInt(globalMesesAgenda, 10) || 3
      });
      showToast('Tope global de agenda actualizado exitosamente.');
      fetchConfig();
    } catch (err) {
      alert(err.message || 'Error al guardar configuración global.');
    } finally {
      setSavingGlobalConfig(false);
    }
  };

  const handleSelectMedicoReglas = (medicoId) => {
    setReglasMedicoId(medicoId);
    const m = medicos.find(x => String(x.id) === String(medicoId));
    if (m) {
      setReglasAntelacion(m.dias_antelacion_agenda !== null && m.dias_antelacion_agenda !== undefined ? m.dias_antelacion_agenda : '');
      setReglasApertura(m.dia_apertura_agenda || '');
    } else {
      setReglasAntelacion('');
      setReglasApertura('');
    }
  };

  const handleSaveReglas = async () => {
    if (!reglasMedicoId) return;
    setSavingReglas(true);
    try {
      await api.put(`/admin/medicos/${reglasMedicoId}`, {
        dias_antelacion_agenda: reglasAntelacion !== '' && !isNaN(parseInt(reglasAntelacion, 10)) ? parseInt(reglasAntelacion, 10) : null,
        dia_apertura_agenda: reglasApertura !== '' && !isNaN(parseInt(reglasApertura, 10)) ? parseInt(reglasApertura, 10) : null
      });
      showToast('Reglas de agenda actualizadas.');
      fetchMedicos();
    } catch (err) {
      alert(err.message || 'Error al guardar reglas.');
    } finally {
      setSavingReglas(false);
    }
  };

  const handleCreateEspecialidad = async (e) => {
    e.preventDefault();
    if (!newEspecialidad.trim()) return;
    try {
      await api.post('/admin/especialidades', { nombre: newEspecialidad.trim() });
      setNewEspecialidad('');
      fetchCatalogos();
      showToast('Especialidad agregada con éxito.');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateSede = async (e) => {
    e.preventDefault();
    if (!newSede.nombre.trim()) return;
    try {
      await api.post('/admin/unidades', newSede);
      setNewSede({ nombre: '', calle: '', numero: '', localidad: 'San Carlos de Bariloche' });
      fetchCatalogos();
      showToast('Sede de atención creada.');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleChangeUserRol = async (userId, nuevoRol) => {
    try {
      await api.put(`/admin/usuarios/${userId}/rol`, { rol: nuevoRol });
      showToast('Rol de usuario actualizado.');
      fetchUsuarios();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ padding: '32px 24px 80px' }}>
      
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Panel de Control Clínico</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem' }}>
            Gestión completa de agendas, profesionales, coberturas y pacientes
          </p>
        </div>
      </div>

      {toastMsg && (
        <div className="toast">
          <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4" style={{ marginBottom: '32px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Turnos Hoy</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '4px', color: 'var(--color-primary)' }}>
              {stats.hoy?.total || 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', marginTop: '4px' }}>
              Confirmados: {stats.hoy?.confirmados || 0}
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Asistieron Hoy</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '4px', color: 'var(--color-success)' }}>
              {stats.hoy?.asistieron || 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', marginTop: '4px' }}>
              Ausentes: {stats.hoy?.ausentes || 0}
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Médicos Activos</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '4px' }}>
              {stats.totales?.total_medicos || 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', marginTop: '4px' }}>
              En plantilla oficial
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Pacientes Registrados</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '4px' }}>
              {stats.totales?.total_pacientes || 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', marginTop: '4px' }}>
              Turnos futuros: {stats.totales?.turnos_futuros || 0}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2" style={{ borderBottom: '1px solid var(--color-border)', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
        {[
          { id: 'turnos', label: 'Agenda & Turnos', icon: Calendar, minRole: 'recepcionista' },
          { id: 'medicos', label: 'Médicos & Staff', icon: Users, minRole: 'recepcionista' },
          { id: 'usuarios', label: 'Pacientes & Usuarios', icon: ShieldCheck, minRole: 'recepcionista' },
          { id: 'obras', label: 'Obras Sociales & Planes', icon: CreditCard, minRole: 'admin' },
          { id: 'horarios', label: 'Configurador de Horarios', icon: Clock, minRole: 'admin' },
          { id: 'reglas', label: 'Reglas de Agenda', icon: Settings, minRole: 'admin' },
          { id: 'especialidades', label: 'Especialidades', icon: Award, minRole: 'admin' },
          { id: 'sedes', label: 'Sedes y Consultorios', icon: Building2, minRole: 'admin' }
        ].filter(tab => {
          const isUserAdmin = ['superadmin', 'admin'].includes(user?.rol) || (user?.email && ['oscarns@gmail.com', 'admin@oscarsoft.com.ar'].includes(user.email.toLowerCase()));
          if (tab.minRole === 'admin') return isUserAdmin;
          return true;
        }).map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="btn btn-sm"
              style={{
                borderRadius: '8px',
                border: 'none',
                background: isActive ? 'var(--color-primary-light)' : 'transparent',
                color: isActive ? 'var(--color-primary-dark)' : 'var(--color-text-muted)',
                fontWeight: isActive ? 700 : 500,
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: AGENDA Y TURNOS (con Select2 para médico, sede y estado) */}
      {activeTab === 'turnos' && (
        <div className="card" style={{ padding: '24px' }}>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3" style={{ marginBottom: '20px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Fecha</label>
              <input
                type="date"
                className="form-input"
                value={filtroFecha}
                onChange={e => setFiltroFecha(e.target.value)}
              />
            </div>

            {/* Select2 Profesional */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Profesional</label>
              <SearchableSelect
                options={medicos.map(m => ({ id: m.id, label: `Dr. ${m.nombre} ${m.apellido}` }))}
                value={filtroMedico}
                onChange={setFiltroMedico}
                placeholder="Todos los médicos"
                searchPlaceholder="Buscar médico..."
              />
            </div>

            {/* Select2 Centro / Sede */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Centro / Sede</label>
              <SearchableSelect
                options={sedes.map(s => ({ id: s.id, label: s.nombre }))}
                value={filtroSede}
                onChange={setFiltroSede}
                placeholder="Todos los centros"
                searchPlaceholder="Buscar sede..."
              />
            </div>

            {/* Select2 Estado */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Estado</label>
              <SearchableSelect
                options={[
                  { id: 'confirmado', label: 'Confirmado / Asignado' },
                  { id: 'asistio', label: 'Asistió' },
                  { id: 'ausente', label: 'Ausente' },
                  { id: 'cancelado', label: 'Cancelado' }
                ]}
                value={filtroEstado}
                onChange={setFiltroEstado}
                placeholder="Todos los estados"
                searchPlaceholder="Filtrar estado..."
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Buscar Paciente / DNI</label>
              <input
                type="text"
                className="form-input"
                placeholder="Nombre, apellido o DNI..."
                value={filtroSearch}
                onChange={e => setFiltroSearch(e.target.value)}
              />
            </div>
          </div>

          {turnos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
              No se encontraron turnos para los filtros seleccionados.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <tr>
                    <th style={{ padding: '12px 14px' }}>Hora</th>
                    <th style={{ padding: '12px 14px' }}>Paciente</th>
                    <th style={{ padding: '12px 14px' }}>DNI / Contacto</th>
                    <th style={{ padding: '12px 14px' }}>Profesional</th>
                    <th style={{ padding: '12px 14px' }}>Cobertura</th>
                    <th style={{ padding: '12px 14px' }}>Estado</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Acciones Rápidas</th>
                  </tr>
                </thead>
                <tbody>
                  {turnos.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {t.hora_inicio.substring(0, 5)} hs
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                        {t.paciente_nombre} {t.paciente_apellido}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div>DNI: {t.paciente_dni || 'Sin DNI'}</div>
                        {t.paciente_telefono && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            Tel: {t.paciente_telefono}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        Dr. {t.medico_nombre} {t.medico_apellido}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {t.obra_social_nombre || 'Particular'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span className={`badge ${
                          t.estado === 'asistio' ? 'badge-success' :
                          t.estado === 'ausente' ? 'badge-warning' :
                          t.estado === 'cancelado' ? 'badge-danger' : 'badge-primary'
                        }`}>
                          {t.estado}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div className="flex justify-end gap-1">
                          {t.estado !== 'asistio' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Marcar Asistió"
                              onClick={() => handleUpdateEstadoTurno(t.id, 'asistio')}
                              style={{ color: 'var(--color-success)', padding: '4px 8px' }}
                            >
                              <CheckCircle size={14} /> Asistió
                            </button>
                          )}
                          {t.estado !== 'ausente' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Marcar Ausente"
                              onClick={() => handleUpdateEstadoTurno(t.id, 'ausente')}
                              style={{ color: 'var(--color-warning)', padding: '4px 8px' }}
                            >
                              Ausente
                            </button>
                          )}
                          {t.estado !== 'cancelado' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Cancelar Turno"
                              onClick={() => handleUpdateEstadoTurno(t.id, 'cancelado')}
                              style={{ color: 'var(--color-danger)', padding: '4px 8px' }}
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

      {/* TAB 2: MÉDICOS Y STAFF (con foto redonda) */}
      {activeTab === 'medicos' && (
        <div className="card" style={{ padding: '24px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Plantilla de Profesionales</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowMedicoModal(true)}>
              <Plus size={16} /> Dar de Alta Médico
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {medicos.map(m => {
              const avatarSrc = m.foto_perfil || obtenerAvatarDefault(m.nombre, m.apellido);
              return (
                <div key={m.id} className="card" style={{ padding: '20px', background: 'var(--color-bg)' }}>
                  <div className="flex items-center gap-3" style={{ marginBottom: '12px' }}>
                    <img
                      src={avatarSrc}
                      alt={`Dr. ${m.nombre} ${m.apellido}`}
                      style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid white',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                      }}
                      onError={e => {
                        e.target.onerror = null;
                        e.target.src = '/turnos/assets/img/avatar_doctor.jpg';
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 700 }}>Dr. {m.nombre} {m.apellido}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{m.email}</div>
                      {m.matricula && (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)' }}>
                          M.N./M.P. {m.matricula}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                    <strong>Especialidades:</strong> {m.especialidades_nombres || 'General'}
                  </div>

                  <div className="flex gap-2">
                    <button 
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setActiveTab('horarios');
                        handleSelectMedicoHorarios(m.id);
                      }}
                    >
                      <Clock size={14} /> Horarios
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setActiveTab('reglas');
                        handleSelectMedicoReglas(m.id);
                      }}
                    >
                      <Settings size={14} /> Reglas
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: OBRAS SOCIALES & PLANES */}
      {activeTab === 'obras' && (
        <div className="card" style={{ padding: '24px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                Obras Sociales & Coberturas Médicas
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '4px', marginBottom: 0 }}>
                Catálogo general de coberturas y planes habilitados ({adminObrasSociales.length} registradas)
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowNewObraModal(true)}>
              <Plus size={16} /> Nueva Obra Social
            </button>
          </div>

          {/* Search bar & info */}
          <div className="flex items-center gap-3" style={{ marginBottom: '20px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '420px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '36px' }}
                placeholder="Buscar obra social (ej: OSDE, Swiss, Galeno)..."
                value={adminObrasSearch}
                onChange={e => setAdminObrasSearch(e.target.value)}
              />
            </div>
            {adminObrasLoading && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Buscando...</span>
            )}
          </div>

          {/* Table */}
          {adminObrasSociales.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
              No se encontraron obras sociales con el criterio de búsqueda.
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    <tr>
                      <th style={{ padding: '12px 14px', width: '80px' }}>ID</th>
                      <th style={{ padding: '12px 14px' }}>Obra Social / Cobertura</th>
                      <th style={{ padding: '12px 14px', width: '150px' }}>Planes</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', width: '220px' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminObrasSociales.slice((adminObrasPage - 1) * 20, adminObrasPage * 20).map(o => (
                      <tr key={o.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '12px 14px', color: 'var(--color-text-muted)' }}>#{o.id}</td>
                        <td style={{ padding: '12px 14px' }}>
                          {editingObraId === o.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                className="form-input"
                                value={editingObraNombre}
                                onChange={e => setEditingObraNombre(e.target.value)}
                                style={{ padding: '4px 8px', fontSize: '0.875rem' }}
                                autoFocus
                              />
                              <button
                                className="btn btn-primary btn-xs"
                                onClick={() => handleUpdateObra(o.id)}
                              >
                                <Save size={14} /> Guardar
                              </button>
                              <button
                                className="btn btn-secondary btn-xs"
                                onClick={() => setEditingObraId(null)}
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontWeight: 600 }}>{o.nombre}</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                            {o.total_planes || 0} {o.total_planes === 1 ? 'plan' : 'planes'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <div className="flex justify-end gap-1">
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Gestionar Planes"
                              onClick={() => handleOpenPlanesModal(o)}
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            >
                              <CreditCard size={14} /> Planes
                            </button>
                            {editingObraId !== o.id && (
                              <button
                                className="btn btn-secondary btn-sm"
                                title="Editar Nombre"
                                onClick={() => {
                                  setEditingObraId(o.id);
                                  setEditingObraNombre(o.nombre);
                                }}
                                style={{ padding: '4px 8px' }}
                              >
                                <Edit size={14} />
                              </button>
                            )}
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Eliminar Obra Social"
                              onClick={() => handleDeleteObra(o.id)}
                              style={{ color: 'var(--color-danger)', padding: '4px 8px' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {adminObrasSociales.length > 20 && (
                <div className="flex items-center justify-between" style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    Mostrando {(adminObrasPage - 1) * 20 + 1} a {Math.min(adminObrasPage * 20, adminObrasSociales.length)} de {adminObrasSociales.length} obras sociales
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={adminObrasPage <= 1}
                      onClick={() => setAdminObrasPage(p => Math.max(1, p - 1))}
                    >
                      Anterior
                    </button>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, padding: '0 8px' }}>
                      Página {adminObrasPage} de {Math.ceil(adminObrasSociales.length / 20)}
                    </span>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={adminObrasPage >= Math.ceil(adminObrasSociales.length / 20)}
                      onClick={() => setAdminObrasPage(p => p + 1)}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 3: CONFIGURADOR DE HORARIOS (con Select2 para médico y consultorio) */}
      {activeTab === 'horarios' && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
            Configuración de Horarios de Atención Semanal
          </h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '20px' }}>
            Define los bloques semanales en los que el médico atiende en cada consultorio.
          </p>

          <div className="form-group" style={{ maxWidth: '420px', marginBottom: '24px' }}>
            <label className="form-label">Selecciona el Profesional (Select2)</label>
            <SearchableSelect
              options={medicos.map(m => ({ id: m.id, label: `Dr. ${m.nombre} ${m.apellido}` }))}
              value={horariosMedicoId}
              onChange={handleSelectMedicoHorarios}
              placeholder="Selecciona un médico..."
              searchPlaceholder="Buscar médico..."
            />
          </div>

          {horariosMedicoId && (
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Bloques Semanales Configurados</h4>
                <button className="btn btn-secondary btn-sm" onClick={handleAddBloqueHorario}>
                  <Plus size={16} /> Añadir Bloque de Horario
                </button>
              </div>

              {horariosBloques.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', background: 'var(--color-bg)', borderRadius: '12px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
                  Este médico no tiene bloques de atención configurados. Haz clic en "Añadir Bloque" para habilitar su agenda.
                </div>
              ) : (
                <div className="flex flex-col gap-3" style={{ marginBottom: '24px' }}>
                  {horariosBloques.map((b, idx) => (
                    <div key={idx} className="flex items-center gap-3" style={{ background: 'var(--color-bg)', padding: '12px 16px', borderRadius: '12px' }}>
                      
                      <div style={{ width: '140px' }}>
                        <select
                          className="form-select"
                          value={b.dia_semana}
                          onChange={e => {
                            const updated = [...horariosBloques];
                            updated[idx].dia_semana = e.target.value;
                            setHorariosBloques(updated);
                          }}
                        >
                          {DIAS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>De:</span>
                        <input
                          type="time"
                          className="form-input"
                          style={{ width: '120px' }}
                          value={b.hora_inicio.substring(0, 5)}
                          onChange={e => {
                            const updated = [...horariosBloques];
                            updated[idx].hora_inicio = e.target.value + ':00';
                            setHorariosBloques(updated);
                          }}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>A:</span>
                        <input
                          type="time"
                          className="form-input"
                          style={{ width: '120px' }}
                          value={b.hora_fin.substring(0, 5)}
                          onChange={e => {
                            const updated = [...horariosBloques];
                            updated[idx].hora_fin = e.target.value + ':00';
                            setHorariosBloques(updated);
                          }}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Turno:</span>
                        <select
                          className="form-select"
                          style={{ width: '110px' }}
                          value={b.duracion_turno_minutos}
                          onChange={e => {
                            const updated = [...horariosBloques];
                            updated[idx].duracion_turno_minutos = parseInt(e.target.value, 10);
                            setHorariosBloques(updated);
                          }}
                        >
                          <option value="15">15 min</option>
                          <option value="20">20 min</option>
                          <option value="30">30 min</option>
                          <option value="45">45 min</option>
                          <option value="60">60 min</option>
                        </select>
                      </div>

                      <div style={{ flex: 1 }}>
                        <select
                          className="form-select"
                          value={b.unidad_id || ''}
                          onChange={e => {
                            const updated = [...horariosBloques];
                            updated[idx].unidad_id = e.target.value ? parseInt(e.target.value, 10) : null;
                            setHorariosBloques(updated);
                          }}
                        >
                          <option value="">Consultorio no asignado</option>
                          {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                      </div>

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleRemoveBloqueHorario(idx)}
                        style={{ color: 'var(--color-danger)' }}
                      >
                        <Trash2 size={16} />
                      </button>

                    </div>
                  ))}
                </div>
              )}

              <button
                className="btn btn-primary"
                onClick={handleSaveHorarios}
                disabled={savingHorarios}
              >
                <Save size={16} /> {savingHorarios ? 'Guardando...' : 'Guardar Horarios del Profesional'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: REGLAS DE AGENDA & TOPE GLOBAL */}
      {activeTab === 'reglas' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', alignItems: 'start' }}>
          {/* Card 1: Límite Global / Tope del Sistema */}
          <div className="card" style={{ padding: '24px' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={20} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                Tope Global de Agenda (Todos los Médicos)
              </h3>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '20px', lineHeight: 1.5 }}>
              Define el período máximo general hacia adelante (en meses o semanas) en el que los pacientes pueden consultar turnos si el profesional no tiene una regla personalizada.
            </p>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Meses de antelación general</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  max="24"
                  value={globalMesesAgenda}
                  onChange={e => setGlobalMesesAgenda(e.target.value)}
                  style={{ maxWidth: '140px', fontSize: '1.125rem', fontWeight: 700 }}
                />
                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>meses hacia adelante</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                Equivalente aproximado a {(parseInt(globalMesesAgenda, 10) || 1) * 30} días de agenda habilitada.
              </div>
            </div>

            <div className="flex flex-wrap gap-2" style={{ marginBottom: '24px' }}>
              <button type="button" className="btn btn-outline btn-xs" onClick={() => setGlobalMesesAgenda(1)}>1 Mes (30 d)</button>
              <button type="button" className="btn btn-outline btn-xs" onClick={() => setGlobalMesesAgenda(2)}>2 Meses (60 d)</button>
              <button type="button" className="btn btn-outline btn-xs" onClick={() => setGlobalMesesAgenda(3)}>3 Meses (90 d)</button>
              <button type="button" className="btn btn-outline btn-xs" onClick={() => setGlobalMesesAgenda(6)}>6 Meses (180 d)</button>
              <button type="button" className="btn btn-outline btn-xs" onClick={() => setGlobalMesesAgenda(12)}>12 Meses (1 año)</button>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSaveGlobalConfig}
              disabled={savingGlobalConfig}
              style={{ width: '100%' }}
            >
              <Save size={16} /> {savingGlobalConfig ? 'Guardando...' : 'Guardar Tope Global de Agenda'}
            </button>
          </div>

          {/* Card 2: Reglas Específicas por Profesional */}
          <div className="card" style={{ padding: '24px' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={20} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                Reglas Específicas por Profesional
              </h3>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '20px', lineHeight: 1.5 }}>
              Permite anular el tope general para un médico específico o configurar un día fijo de apertura mensual.
            </p>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Selecciona el Profesional (Select2)</label>
              <SearchableSelect
                options={medicos.map(m => ({ id: m.id, label: `Dr. ${m.nombre} ${m.apellido}` }))}
                value={reglasMedicoId}
                onChange={handleSelectMedicoReglas}
                placeholder="Selecciona un médico..."
                searchPlaceholder="Buscar médico..."
              />
            </div>

            {reglasMedicoId ? (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Días de Antelación Máxima</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    max="730"
                    placeholder="Vacío para usar tope general..."
                    value={reglasAntelacion}
                    onChange={e => setReglasAntelacion(e.target.value)}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    Si se deja vacío, aplica el tope global configurado a la izquierda.
                  </div>
                  <div className="flex flex-wrap gap-1" style={{ marginTop: '8px' }}>
                    <button type="button" className="btn btn-outline btn-xs" onClick={() => setReglasAntelacion(15)}>15 d</button>
                    <button type="button" className="btn btn-outline btn-xs" onClick={() => setReglasAntelacion(30)}>30 d</button>
                    <button type="button" className="btn btn-outline btn-xs" onClick={() => setReglasAntelacion(45)}>45 d</button>
                    <button type="button" className="btn btn-outline btn-xs" onClick={() => setReglasAntelacion(60)}>60 d</button>
                    <button type="button" className="btn btn-outline btn-xs" onClick={() => setReglasAntelacion(90)}>90 d</button>
                    <button type="button" className="btn btn-outline btn-xs" onClick={() => setReglasAntelacion(180)}>180 d</button>
                    <button type="button" className="btn btn-outline btn-xs" style={{ color: 'var(--color-error)' }} onClick={() => setReglasAntelacion('')}>Usar General</button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Día Mensual de Apertura de Agenda</label>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Día</span>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      max="31"
                      placeholder="Ej: 1, 10, 15..."
                      value={reglasApertura}
                      onChange={e => setReglasApertura(e.target.value)}
                      style={{ maxWidth: '120px' }}
                    />
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>de cada mes</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    Antes de este día de cada mes, los pacientes verán un aviso informando qué día abre la agenda.
                  </div>
                  <button type="button" className="btn btn-outline btn-xs" style={{ alignSelf: 'flex-start', marginTop: '6px' }} onClick={() => setReglasApertura('')}>
                    Sin día fijo (Siempre abierta)
                  </button>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleSaveReglas}
                  disabled={savingReglas}
                  style={{ marginTop: '8px' }}
                >
                  <Save size={16} /> {savingReglas ? 'Guardando...' : 'Guardar Reglas del Profesional'}
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--color-text-muted)', background: 'var(--color-bg)', borderRadius: '12px' }}>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>Selecciona un médico arriba para personalizar su ventana o día de apertura.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: ESPECIALIDADES */}
      {activeTab === 'especialidades' && (
        <div className="card" style={{ padding: '24px', maxWidth: '640px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px' }}>
            Gestión de Especialidades Médicas
          </h3>

          <form onSubmit={handleCreateEspecialidad} className="flex gap-2" style={{ marginBottom: '24px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Nueva especialidad (ej: Nutrición, Dermatología...)"
              value={newEspecialidad}
              onChange={e => setNewEspecialidad(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              <Plus size={16} /> Agregar
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {especialidades.map(e => (
              <span key={e.id} className="badge badge-primary" style={{ padding: '8px 12px', fontSize: '0.8125rem' }}>
                {e.nombre}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: SEDES */}
      {activeTab === 'sedes' && (
        <div className="card" style={{ padding: '24px', maxWidth: '640px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px' }}>
            Consultorios y Sedes de Atención
          </h3>

          <form onSubmit={handleCreateSede} className="flex flex-col gap-3" style={{ marginBottom: '24px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Nombre de la sede (ej: Sede Centro, Consultorios Externos)"
                required
                value={newSede.nombre}
                onChange={e => setNewSede({ ...newSede, nombre: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                className="form-input"
                placeholder="Calle (ej: Mitre)"
                value={newSede.calle}
                onChange={e => setNewSede({ ...newSede, calle: e.target.value })}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Número (ej: 124)"
                value={newSede.numero}
                onChange={e => setNewSede({ ...newSede, numero: e.target.value })}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              <Plus size={16} /> Crear Sede
            </button>
          </form>

          <div className="flex flex-col gap-2">
            {sedes.map(s => (
              <div key={s.id} className="card" style={{ padding: '12px 16px', background: 'var(--color-bg)' }}>
                <div style={{ fontWeight: 700 }}>{s.nombre}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  {s.calle} {s.numero} - {s.localidad}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: USUARIOS Y ROLES */}
      {activeTab === 'usuarios' && (
        <div className="card" style={{ padding: '24px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Administración de Usuarios y Permisos</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '4px', marginBottom: 0 }}>
                Roles del sistema: Paciente, Recepcionista / Telefonista, Administrador y Médico
              </p>
            </div>
            <input
              type="text"
              className="form-input"
              placeholder="Buscar por nombre, email o DNI..."
              style={{ maxWidth: '300px' }}
              value={usuarioSearch}
              onChange={e => setUsuarioSearch(e.target.value)}
            />
          </div>

          {/* Filtro rápido por rol */}
          <div className="flex flex-wrap gap-2" style={{ marginBottom: '20px' }}>
            {[
              { id: '', label: 'Todos los Usuarios' },
              { id: 'paciente', label: 'Pacientes' },
              { id: 'recepcionista', label: 'Recepcionistas / Telefonistas' },
              { id: 'admin', label: 'Administradores' },
              { id: 'medico', label: 'Médicos' }
            ].map(r => (
              <button
                key={r.id}
                type="button"
                className={`btn btn-xs ${rolFiltro === r.id ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setRolFiltro(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                <tr>
                  <th style={{ padding: '12px 14px' }}>ID</th>
                  <th style={{ padding: '12px 14px' }}>Nombre Completo</th>
                  <th style={{ padding: '12px 14px' }}>DNI</th>
                  <th style={{ padding: '12px 14px' }}>Email</th>
                  <th style={{ padding: '12px 14px' }}>Rol Actual</th>
                  <th style={{ padding: '12px 14px' }}>Asignar Rol</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => {
                  const rolBadgeClass = 
                    ['admin', 'superadmin'].includes(u.rol) ? 'badge-primary' :
                    u.rol === 'recepcionista' ? 'badge-warning' :
                    u.rol === 'medico' ? 'badge-success' : 'badge-secondary';
                  
                  const rolLabel =
                    ['admin', 'superadmin'].includes(u.rol) ? 'Administrador' :
                    u.rol === 'recepcionista' ? 'Recepcionista / Telefonista' :
                    u.rol === 'medico' ? 'Médico' : 'Paciente';

                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 14px', color: 'var(--color-text-muted)' }}>#{u.id}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{u.nombre} {u.apellido}</td>
                      <td style={{ padding: '12px 14px' }}>{u.dni || '-'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div>{u.email}</div>
                        {u.email === 'oscarns@gmail.com' && (
                          <span style={{ fontSize: '0.6875rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                            ★ Administrador Principal
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span className={`badge ${rolBadgeClass}`}>
                          {rolLabel}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <select
                          className="form-select"
                          style={{ padding: '4px 8px', fontSize: '0.8125rem' }}
                          value={u.rol}
                          onChange={e => handleChangeUserRol(u.id, e.target.value)}
                        >
                          <option value="paciente">Paciente</option>
                          <option value="recepcionista">Recepcionista / Telefonista</option>
                          <option value="admin">Administrador</option>
                          <option value="medico">Médico</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL NUEVO MÉDICO (con Select2 para especialidad) */}
      {showMedicoModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px' }}>
              Dar de Alta Nuevo Médico
            </h3>

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.post('/admin/medicos', medicoForm);
                setShowMedicoModal(false);
                fetchMedicos();
                fetchStats();
                showToast('Médico registrado exitosamente.');
              } catch (err) {
                alert(err.message || 'Error al crear médico.');
              }
            }}>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Nombre</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={medicoForm.nombre}
                    onChange={e => setMedicoForm({ ...medicoForm, nombre: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Apellido</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={medicoForm.apellido}
                    onChange={e => setMedicoForm({ ...medicoForm, apellido: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    required
                    value={medicoForm.email}
                    onChange={e => setMedicoForm({ ...medicoForm, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Matrícula (M.N. / M.P.)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej: 14590"
                    value={medicoForm.matricula}
                    onChange={e => setMedicoForm({ ...medicoForm, matricula: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">DNI</label>
                  <input
                    type="text"
                    className="form-input"
                    value={medicoForm.dni}
                    onChange={e => setMedicoForm({ ...medicoForm, dni: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Contraseña de Acceso</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Por defecto: Medico1234!"
                    value={medicoForm.password}
                    onChange={e => setMedicoForm({ ...medicoForm, password: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Especialidad Principal (Select2)</label>
                <SearchableSelect
                  options={especialidades.map(esp => ({ id: esp.id, label: esp.nombre }))}
                  value={medicoForm.especialidades[0] || ''}
                  onChange={val => setMedicoForm({ ...medicoForm, especialidades: val ? [parseInt(val, 10)] : [] })}
                  placeholder="Selecciona especialidad..."
                  searchPlaceholder="Buscar especialidad..."
                />
              </div>

              <div className="flex justify-end gap-3" style={{ marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowMedicoModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Registrar Médico
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVA OBRA SOCIAL */}
      {showNewObraModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '480px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                Nueva Obra Social / Prepaga
              </h3>
              <button className="btn btn-secondary btn-xs" onClick={() => setShowNewObraModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateObra}>
              <div className="form-group">
                <label className="form-label">Nombre o Razón Social</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: OSDE, Medicus, Sancor Salud..."
                  required
                  value={newObraNombre}
                  onChange={e => setNewObraNombre(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Planes Iniciales (Uno por renglón)</label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder={`Plan General / PMO\nPlan 210\nPlan 310`}
                  value={newObraPlanesTexto}
                  onChange={e => setNewObraPlanesTexto(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Si dejas este campo vacío, se creará automáticamente con el "Plan General".
                </div>
              </div>

              <div className="flex justify-end gap-3" style={{ marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewObraModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Crear Obra Social
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL GESTIONAR PLANES DE OBRA SOCIAL */}
      {selectedObraForPlanes && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '520px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  Planes de {selectedObraForPlanes.nombre}
                </h3>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  Gestión de planes habilitados para selección de turnos
                </div>
              </div>
              <button className="btn btn-secondary btn-xs" onClick={() => setSelectedObraForPlanes(null)}>
                <X size={16} />
              </button>
            </div>

            {/* Agregar nuevo plan */}
            <form onSubmit={handleAddPlanToObra} className="flex gap-2" style={{ marginBottom: '20px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Nombre del nuevo plan (ej: Plan Oro, 310, PMO)..."
                required
                value={newPlanNombre}
                onChange={e => setNewPlanNombre(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }}>
                <Plus size={16} /> Agregar
              </button>
            </form>

            {/* Lista de planes */}
            <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '8px' }}>
              {modalPlanesList.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  No hay planes registrados para esta obra social.
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {modalPlanesList.map(plan => (
                    <div
                      key={plan.id}
                      className="flex items-center justify-between"
                      style={{ padding: '8px 12px', background: 'var(--color-bg)', borderRadius: '6px' }}
                    >
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{plan.nombre}</span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-xs"
                        style={{ color: 'var(--color-danger)' }}
                        onClick={() => handleDeletePlan(plan.id)}
                        title="Eliminar este plan"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end" style={{ marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedObraForPlanes(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
