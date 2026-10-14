import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import TimeInput24 from '../components/TimeInput24';
import DurationPicker5Min from '../components/DurationPicker5Min';
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
  EyeOff,
  Key,
  X,
  Sparkles,
  Stethoscope,
  Copy,
  ExternalLink,
  DollarSign,
  MessageSquare,
  Upload,
  Phone,
  RefreshCw
} from 'lucide-react';

const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];

function formatearFechaArg(fechaStr) {
  if (!fechaStr) return '';
  const clean = String(fechaStr).split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return fechaStr;
}

export default function DashboardPage() {
  const { user, setUser } = useAuth();
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
    username: '',
    email: '',
    dni: '',
    matricula: '',
    password: '',
    telefono: '',
    biografia: '',
    direccion: '',
    dias_antelacion_agenda: 60,
    dia_apertura_agenda: '',
    acepta_particular: true,
    honorarios_particular: '',
    mostrar_honorarios: false,
    especialidades: []
  });

  // Modal Ficha del Médico y Honorarios Particulares
  const [editingFichaMedico, setEditingFichaMedico] = useState(null);
  const [fichaForm, setFichaForm] = useState({
    nombre: '',
    apellido: '',
    username: '',
    email: '',
    dni: '',
    password: '',
    matricula: '',
    telefono: '',
    biografia: '',
    direccion: '',
    foto_perfil: '',
    mensaje_paciente: '',
    acepta_particular: true,
    honorarios_particular: '',
    mostrar_honorarios: false,
    dias_antelacion_agenda: '',
    dia_apertura_agenda: ''
  });
  const [savingFicha, setSavingFicha] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  // Suspensión de Turnos (Médico)
  const [suspensiones, setSuspensiones] = useState([]);
  const [loadingSuspensiones, setLoadingSuspensiones] = useState(false);
  const [suspFechaInicio, setSuspFechaInicio] = useState('');
  const [suspFechaFin, setSuspFechaFin] = useState('');
  const [suspMotivo, setSuspMotivo] = useState('');
  const [suspCancelarTurnos, setSuspCancelarTurnos] = useState(true);
  const [afectadosPreview, setAfectadosPreview] = useState([]);
  const [loadingAfectados, setLoadingAfectados] = useState(false);
  const [savingSuspension, setSavingSuspension] = useState(false);

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

  // Asignar credenciales a médico (Admin)
  const [credMedicoId, setCredMedicoId] = useState('');
  const [credUsername, setCredUsername] = useState('');
  const [credEmail, setCredEmail] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [showCredPassword, setShowCredPassword] = useState(false);
  const [savingCred, setSavingCred] = useState(false);

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

  // Coberturas Modal para Médicos
  const [coberturasMedico, setCoberturasMedico] = useState(null);
  const [coberturasAllObras, setCoberturasAllObras] = useState([]);
  const [selectedOSIds, setSelectedOSIds] = useState(new Set());
  const [selectedPlanIds, setSelectedPlanIds] = useState(new Set());
  const [loadingDoctorCoberturas, setLoadingDoctorCoberturas] = useState(false);
  const [savingDoctorCoberturas, setSavingDoctorCoberturas] = useState(false);
  const [coberturasSearch, setCoberturasSearch] = useState('');
  const [coberturasFiltroTipo, setCoberturasFiltroTipo] = useState('todas'); // 'todas', 'marcadas', 'desmarcadas'

  // Metadata y turnos agenda completa (vacíos + ocupados)
  const [agendaMeta, setAgendaMeta] = useState(null);

  // Bot WhatsApp Q&A Tab
  const [botRespuestas, setBotRespuestas] = useState([]);
  const [botLoading, setBotLoading] = useState(false);
  const [botSearch, setBotSearch] = useState('');
  const [botFiltroActivo, setBotFiltroActivo] = useState('todos');
  const [showBotModal, setShowBotModal] = useState(false);
  const [editingBotId, setEditingBotId] = useState(null);
  const [botForm, setBotForm] = useState({
    clave: '',
    titulo: '',
    descripcion: '',
    disparador: '',
    mensaje: '',
    activo: 1
  });
  const [botSaving, setBotSaving] = useState(false);

  // Feedback Toast
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const isDoctor = user?.rol === 'medico';

  const fetchStats = () => {
    if (isDoctor) {
      api.get('/medico/stats')
        .then(res => setStats(res.data?.data || res.data))
        .catch(console.error);
    } else {
      api.get('/admin/stats').then(res => setStats(res.data)).catch(console.error);
    }
  };

  const fetchTurnos = () => {
    const params = new URLSearchParams();
    if (filtroFecha) params.append('fecha', filtroFecha);
    if (isDoctor) {
      params.append('medico_id', user.id);
      params.append('incluir_vacios', '1');
    } else if (filtroMedico) {
      params.append('medico_id', filtroMedico);
    }
    if (filtroSede) params.append('unidad_id', filtroSede);
    if (filtroEstado) params.append('estado', filtroEstado);
    if (filtroSearch) params.append('q', filtroSearch);

    if (isDoctor) {
      api.get(`/medico/agenda?${params.toString()}`)
        .then(res => {
          setTurnos(res.data?.data || []);
          if (res.data?.meta) {
            setAgendaMeta(res.data.meta);
          }
        })
        .catch(console.error);
    } else {
      api.get(`/admin/turnos?${params.toString()}`)
        .then(res => setTurnos(res.data || []))
        .catch(console.error);
    }
  };

  const fetchMedicos = () => {
    if (isDoctor) {
      setMedicos([user]);
      return;
    }
    api.get('/admin/medicos')
      .then(res => setMedicos(res.data || []))
      .catch(console.error);
  };

  const fetchCatalogos = () => {
    api.get('/public/especialidades').then(res => setEspecialidades(res.data || [])).catch(() => {
      api.get('/admin/especialidades').then(res => setEspecialidades(res.data || [])).catch(console.error);
    });
    api.get('/admin/unidades').then(res => setSedes(res.data || [])).catch(console.error);
  };

  const fetchUsuarios = () => {
    if (isDoctor) return;
    const params = new URLSearchParams();
    if (usuarioSearch) params.append('q', usuarioSearch);
    if (rolFiltro) params.append('rol', rolFiltro);
    api.get(`/admin/usuarios?${params.toString()}`).then(res => setUsuarios(res.data || [])).catch(console.error);
  };

  const fetchObrasSociales = () => {
    if (isDoctor) {
      api.get('/public/obras-sociales')
        .then(res => setCoberturasAllObras(res.data || []))
        .catch(console.error);
      return;
    }
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
    if (isDoctor) return;
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
    if (!isDoctor) {
      fetchConfig();
      fetchObrasSociales();
      fetchBotRespuestas();
    } else {
      // Cargar ficha y honorarios del médico
      api.get('/medico/perfil')
        .then(res => {
          const m = res.data?.data || res.data;
          if (m && typeof m === 'object' && m.id) {
            setFichaForm({
              nombre: m.nombre || '',
              apellido: m.apellido || '',
              username: m.username || '',
              email: m.email || '',
              dni: m.dni || '',
              password: '',
              matricula: m.matricula || '',
              telefono: m.telefono || '',
              biografia: m.biografia || '',
              direccion: m.direccion || '',
              foto_perfil: m.foto_perfil || '',
              mensaje_paciente: m.mensaje_paciente || '',
              acepta_particular: m.acepta_particular !== 0 && m.acepta_particular !== false,
              honorarios_particular: m.honorarios_particular !== null && m.honorarios_particular !== undefined ? m.honorarios_particular : '',
              mostrar_honorarios: !!m.mostrar_honorarios,
              dias_antelacion_agenda: m.dias_antelacion_agenda !== null && m.dias_antelacion_agenda !== undefined ? m.dias_antelacion_agenda : '',
              dia_apertura_agenda: m.dia_apertura_agenda || ''
            });
          }
        })
        .catch(console.error);

      // Cargar horarios del médico
      api.get('/medico/horarios')
        .then(res => {
          const list = res.data?.data || res.data;
          if (Array.isArray(list)) {
            setHorariosBloques(list);
            setHorariosMedicoId(user?.id);
          }
        })
        .catch(console.error);

      // Cargar suspensiones del médico
      fetchSuspensiones();

      // Cargar todas las obras sociales y las seleccionadas por este médico
      api.get('/public/obras-sociales')
        .then(res => {
          const list = res.data?.data || res.data || [];
          setCoberturasAllObras(list);
          setSelectedOSIds(prev => {
            if (prev.size === 0 && list.length > 0) {
              return new Set(list.map(o => Number(o.id)));
            }
            return prev;
          });
        })
        .catch(console.error);

      api.get('/medico/coberturas')
        .then(res => {
          const cob = res.data?.data || res.data;
          if (cob && Array.isArray(cob.obras_sociales) && cob.obras_sociales.length > 0) {
            setSelectedOSIds(new Set(cob.obras_sociales.map(Number)));
            setSelectedPlanIds(new Set((cob.planes || []).map(Number)));
          }
        })
        .catch(console.error);
    }
  }, [isDoctor, user?.id]);

  useEffect(() => {
    if (activeTab === 'horarios' && isDoctor && user?.id) {
      setHorariosMedicoId(user.id);
      api.get('/medico/horarios')
        .then(res => {
          const list = res.data?.data || res.data;
          if (Array.isArray(list)) setHorariosBloques(list);
        })
        .catch(console.error);
    }
    if (activeTab === 'suspensiones' && isDoctor) {
      fetchSuspensiones();
    }
  }, [activeTab, isDoctor, user?.id]);

  useEffect(() => {
    fetchTurnos();
  }, [filtroFecha, filtroMedico, filtroSede, filtroEstado, filtroSearch]);

  useEffect(() => {
    if (!isDoctor) {
      fetchUsuarios();
    }
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

  const handleOpenDoctorCoberturas = async (medico) => {
    setCoberturasMedico(medico);
    setLoadingDoctorCoberturas(true);
    setCoberturasSearch('');
    try {
      if (coberturasAllObras.length === 0) {
        const obRes = await api.get('/public/obras-sociales');
        setCoberturasAllObras(obRes.data || []);
      }
      const res = await api.get(`/admin/medicos/${medico.id}/coberturas`);
      const activeOS = new Set((res.data?.obras_sociales || []).map(Number));
      const activePlanes = new Set((res.data?.planes || []).map(Number));
      setSelectedOSIds(activeOS);
      setSelectedPlanIds(activePlanes);
    } catch (err) {
      console.error(err);
      showToast('Error al cargar coberturas del profesional.');
    } finally {
      setLoadingDoctorCoberturas(false);
    }
  };

  const handleSaveDoctorCoberturas = async () => {
    if (!coberturasMedico) return;
    setSavingDoctorCoberturas(true);
    try {
      await api.put(`/admin/medicos/${coberturasMedico.id}/coberturas`, {
        obras_sociales: Array.from(selectedOSIds),
        planes: Array.from(selectedPlanIds)
      });
      showToast('Coberturas médicas actualizadas correctamente.');
      setCoberturasMedico(null);
      fetchMedicos();
    } catch (err) {
      showToast(err.message || 'Error al guardar coberturas.');
    } finally {
      setSavingDoctorCoberturas(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'usuarios') fetchUsuarios();
    if (activeTab === 'reglas') fetchConfig();
  }, [activeTab, usuarioSearch, rolFiltro]);

  const handleUpdateEstadoTurno = async (turnoId, nuevoEstado) => {
    try {
      if (isDoctor) {
        await api.put(`/medico/turnos/${turnoId}/estado`, { estado: nuevoEstado });
      } else {
        await api.put(`/admin/turnos/${turnoId}/estado`, { estado: nuevoEstado });
      }
      showToast(`Turno actualizado a "${nuevoEstado}".`);
      fetchTurnos();
      fetchStats();
    } catch (err) {
      alert(err.message || 'Error al actualizar turno.');
    }
  };

  const fetchSuspensiones = () => {
    if (!isDoctor) return;
    setLoadingSuspensiones(true);
    api.get('/medico/suspensiones')
      .then(res => {
        const list = res.data?.data || res.data || [];
        setSuspensiones(Array.isArray(list) ? list : []);
      })
      .catch(console.error)
      .finally(() => setLoadingSuspensiones(false));
  };

  const handleConsultarAfectados = (desde, hasta) => {
    if (!desde || !hasta) {
      setAfectadosPreview([]);
      return;
    }
    setLoadingAfectados(true);
    api.get(`/medico/suspensiones/afectados?desde=${desde}&hasta=${hasta}`)
      .then(res => {
        const list = res.data?.data || res.data || [];
        setAfectadosPreview(Array.isArray(list) ? list : []);
      })
      .catch(err => {
        console.error(err);
        setAfectadosPreview([]);
      })
      .finally(() => setLoadingAfectados(false));
  };

  const handleCrearSuspension = async (e) => {
    e.preventDefault();
    if (!suspFechaInicio || !suspFechaFin) {
      alert('Por favor selecciona fecha de inicio y fin.');
      return;
    }
    if (suspFechaFin < suspFechaInicio) {
      alert('La fecha de fin no puede ser anterior a la de inicio.');
      return;
    }
    setSavingSuspension(true);
    try {
      const res = await api.post('/medico/suspensiones', {
        fecha_inicio: suspFechaInicio,
        fecha_fin: suspFechaFin,
        motivo: suspMotivo || 'Suspensión de atención',
        cancelar_turnos: suspCancelarTurnos
      });
      showToast(res.message || 'Suspensión guardada exitosamente.');
      fetchSuspensiones();
      fetchTurnos();
      handleConsultarAfectados(suspFechaInicio, suspFechaFin);
      setSuspMotivo('');
    } catch (err) {
      alert(err.message || 'Error al registrar suspensión.');
    } finally {
      setSavingSuspension(false);
    }
  };

  const handleEliminarSuspension = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta suspensión y volver a habilitar los turnos para estas fechas?')) return;
    try {
      await api.delete(`/medico/suspensiones/${id}`);
      showToast('Suspensión eliminada con éxito. Las fechas están nuevamente disponibles.');
      fetchSuspensiones();
      fetchTurnos();
      if (suspFechaInicio && suspFechaFin) {
        handleConsultarAfectados(suspFechaInicio, suspFechaFin);
      }
    } catch (err) {
      alert(err.message || 'Error al eliminar suspensión.');
    }
  };

  const handleUploadFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (JPG, PNG o WEBP).');
      return;
    }
    setSubiendoFoto(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const base64 = ev.target.result;
        const res = await api.post('/medico/foto', { foto: base64 });
        const newUrl = res.foto_perfil;
        setFichaForm(prev => ({ ...prev, foto_perfil: newUrl }));
        showToast('Foto de perfil actualizada correctamente.');
        if (user) {
          const updatedUser = { ...user, foto_perfil: newUrl };
          setUser?.(updatedUser);
          localStorage.setItem('turnos_user', JSON.stringify(updatedUser));
        }
      } catch (err) {
        alert(err.message || 'Error al subir foto.');
      } finally {
        setSubiendoFoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFoto = async () => {
    if (!window.confirm('¿Deseas quitar tu foto de perfil?')) return;
    setSubiendoFoto(true);
    try {
      await api.post('/medico/foto', { foto: null });
      setFichaForm(prev => ({ ...prev, foto_perfil: null }));
      showToast('Foto de perfil eliminada.');
      if (user) {
        const updatedUser = { ...user, foto_perfil: null };
        setUser?.(updatedUser);
        localStorage.setItem('turnos_user', JSON.stringify(updatedUser));
      }
    } catch (err) {
      alert(err.message || 'Error al quitar foto.');
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleSaveDoctorPersonalFicha = async (e) => {
    e.preventDefault();
    setSavingFicha(true);
    try {
      const res = await api.put('/medico/perfil', fichaForm);
      showToast('Tu ficha profesional y perfil fueron actualizados correctamente.');
      if (res.data) {
        const m = res.data;
        setFichaForm(prev => ({
          ...prev,
          nombre: m.nombre || '',
          apellido: m.apellido || '',
          username: m.username || '',
          email: m.email || '',
          dni: m.dni || '',
          password: '',
          matricula: m.matricula || '',
          telefono: m.telefono || '',
          biografia: m.biografia || '',
          direccion: m.direccion || '',
          foto_perfil: m.foto_perfil || '',
          mensaje_paciente: m.mensaje_paciente || ''
        }));
        if (user) {
          const updatedUser = { ...user, nombre: m.nombre, apellido: m.apellido, username: m.username, email: m.email, foto_perfil: m.foto_perfil };
          setUser?.(updatedUser);
          localStorage.setItem('turnos_user', JSON.stringify(updatedUser));
        }
      }
      fetchStats();
    } catch (err) {
      showToast(err.message || 'Error al guardar tu perfil.');
    } finally {
      setSavingFicha(false);
    }
  };

  const handleSaveDoctorPersonalHorarios = async () => {
    setSavingHorarios(true);
    try {
      await api.put('/medico/horarios', { bloques: horariosBloques });
      showToast('Tus horarios de atención fueron guardados correctamente.');
    } catch (err) {
      showToast(err.message || 'Error al guardar horarios.');
    } finally {
      setSavingHorarios(false);
    }
  };

  const handleSaveDoctorPersonalCoberturas = async () => {
    setSavingDoctorCoberturas(true);
    try {
      await api.put('/medico/coberturas', {
        obras_sociales: Array.from(selectedOSIds),
        planes: Array.from(selectedPlanIds)
      });
      showToast('Tus coberturas médicas fueron guardadas correctamente.');
    } catch (err) {
      showToast(err.message || 'Error al guardar coberturas.');
    } finally {
      setSavingDoctorCoberturas(false);
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
        unidad_id: sedes[0]?.id || null,
        consultorio: ''
      }
    ]);
  };

  const handleRemoveBloqueHorario = (index) => {
    setHorariosBloques(horariosBloques.filter((_, i) => i !== index));
  };

  const handleSaveHorarios = async () => {
    if (isDoctor) {
      return handleSaveDoctorPersonalHorarios();
    }
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

  const handleGuardarCredencialesMedico = async (e) => {
    e.preventDefault();
    if (!credMedicoId) {
      alert('Por favor selecciona un profesional de la lista.');
      return;
    }
    if (!credUsername.trim() && !credEmail.trim()) {
      alert('Por favor ingresa al menos un nombre de usuario o un correo electrónico.');
      return;
    }
    if (credPassword.trim() && credPassword.trim().length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setSavingCred(true);
    try {
      const res = await api.put(`/admin/medicos/${credMedicoId}/credenciales`, {
        username: credUsername.trim(),
        email: credEmail.trim(),
        password: credPassword.trim() ? credPassword.trim() : undefined
      });
      showToast(res.data?.message || 'Credenciales asignadas exitosamente al médico.');
      setCredPassword('');
      fetchMedicos();
    } catch (err) {
      alert(err.message || 'Error al asignar credenciales.');
    } finally {
      setSavingCred(false);
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

  const handleOpenEditFicha = (medico) => {
    setEditingFichaMedico(medico);
    setFichaForm({
      nombre: medico.nombre || '',
      apellido: medico.apellido || '',
      username: medico.username || '',
      email: medico.email || '',
      dni: medico.dni || '',
      password: '',
      matricula: medico.matricula || '',
      telefono: medico.telefono || '',
      biografia: medico.biografia || '',
      direccion: medico.direccion || '',
      acepta_particular: medico.acepta_particular !== 0 && medico.acepta_particular !== false,
      honorarios_particular: medico.honorarios_particular !== null && medico.honorarios_particular !== undefined ? medico.honorarios_particular : '',
      mostrar_honorarios: !!medico.mostrar_honorarios,
      dias_antelacion_agenda: medico.dias_antelacion_agenda !== null && medico.dias_antelacion_agenda !== undefined ? medico.dias_antelacion_agenda : '',
      dia_apertura_agenda: medico.dia_apertura_agenda || ''
    });
  };

  const handleSaveFicha = async (e) => {
    e.preventDefault();
    if (!editingFichaMedico) return;
    setSavingFicha(true);
    try {
      await api.put(`/admin/medicos/${editingFichaMedico.id}`, {
        nombre: fichaForm.nombre,
        apellido: fichaForm.apellido,
        username: fichaForm.username?.trim() ? fichaForm.username.trim() : null,
        email: fichaForm.email?.trim() ? fichaForm.email.trim() : null,
        dni: fichaForm.dni || null,
        password: fichaForm.password?.trim() ? fichaForm.password.trim() : undefined,
        matricula: fichaForm.matricula,
        telefono: fichaForm.telefono,
        biografia: fichaForm.biografia,
        direccion: fichaForm.direccion,
        acepta_particular: fichaForm.acepta_particular,
        honorarios_particular: fichaForm.honorarios_particular !== '' && !isNaN(Number(fichaForm.honorarios_particular)) ? Number(fichaForm.honorarios_particular) : null,
        mostrar_honorarios: fichaForm.mostrar_honorarios,
        dias_antelacion_agenda: fichaForm.dias_antelacion_agenda !== '' && !isNaN(parseInt(fichaForm.dias_antelacion_agenda, 10)) ? parseInt(fichaForm.dias_antelacion_agenda, 10) : null,
        dia_apertura_agenda: fichaForm.dia_apertura_agenda !== '' && !isNaN(parseInt(fichaForm.dia_apertura_agenda, 10)) ? parseInt(fichaForm.dia_apertura_agenda, 10) : null
      });
      showToast('Ficha del profesional, credenciales y honorarios actualizados correctamente.');
      setEditingFichaMedico(null);
      fetchMedicos();
    } catch (err) {
      alert(err.message || 'Error al guardar ficha del profesional.');
    } finally {
      setSavingFicha(false);
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

  useEffect(() => {
    if (activeTab === 'bot' && !isDoctor) {
      fetchBotRespuestas();
    }
  }, [activeTab]);

  const fetchBotRespuestas = async () => {
    setBotLoading(true);
    try {
      const res = await api.get('/admin/bot-respuestas');
      const items = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res?.data?.data || []));
      setBotRespuestas(items);
    } catch (err) {
      console.error('Error al cargar respuestas del bot:', err);
      showToast('Error al cargar mensajes del bot');
    } finally {
      setBotLoading(false);
    }
  };

  const handleOpenNewBotModal = () => {
    setEditingBotId(null);
    setBotForm({
      clave: '',
      titulo: '',
      descripcion: '',
      disparador: '',
      mensaje: '',
      activo: 1
    });
    setShowBotModal(true);
  };

  const handleOpenEditBotModal = (item) => {
    setEditingBotId(item.id);
    setBotForm({
      clave: item.clave || '',
      titulo: item.titulo || '',
      descripcion: item.descripcion || '',
      disparador: item.disparador || '',
      mensaje: item.mensaje || '',
      activo: item.activo ? 1 : 0
    });
    setShowBotModal(true);
  };

  const handleSaveBotRespuesta = async (e) => {
    e.preventDefault();
    if (!botForm.clave.trim() || !botForm.titulo.trim() || !botForm.mensaje.trim()) {
      showToast('Clave, título y mensaje son obligatorios.');
      return;
    }
    setBotSaving(true);
    try {
      if (editingBotId) {
        await api.put(`/admin/bot-respuestas/${editingBotId}`, botForm);
        showToast('Respuesta del bot actualizada exitosamente.');
      } else {
        await api.post('/admin/bot-respuestas', botForm);
        showToast('Respuesta del bot creada exitosamente.');
      }
      setShowBotModal(false);
      fetchBotRespuestas();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Error al guardar respuesta');
    } finally {
      setBotSaving(false);
    }
  };

  const handleToggleBotActivo = async (item) => {
    try {
      const nuevoActivo = item.activo ? 0 : 1;
      await api.put(`/admin/bot-respuestas/${item.id}`, {
        ...item,
        activo: nuevoActivo
      });
      setBotRespuestas(prev => prev.map(r => r.id === item.id ? { ...r, activo: nuevoActivo } : r));
      showToast(nuevoActivo ? 'Respuesta activada.' : 'Respuesta pausada.');
    } catch (err) {
      showToast(err.message || 'Error al cambiar estado');
    }
  };

  const handleDeleteBotRespuesta = async (id, titulo) => {
    if (!window.confirm(`¿Estás seguro de eliminar "${titulo}"?`)) return;
    try {
      await api.delete(`/admin/bot-respuestas/${id}`);
      showToast('Mensaje eliminado correctamente.');
      fetchBotRespuestas();
    } catch (err) {
      showToast(err.message || 'Error al eliminar');
    }
  };

  const filteredBotList = botRespuestas.filter(item => {
    if (botFiltroActivo === 'activos' && !item.activo) return false;
    if (botFiltroActivo === 'inactivos' && item.activo) return false;
    if (botSearch.trim()) {
      const q = botSearch.toLowerCase();
      const matchClave = item.clave?.toLowerCase().includes(q);
      const matchTitulo = item.titulo?.toLowerCase().includes(q);
      const matchDisparador = item.disparador?.toLowerCase().includes(q);
      const matchMensaje = item.mensaje?.toLowerCase().includes(q);
      return matchClave || matchTitulo || matchDisparador || matchMensaje;
    }
    return true;
  });

  return (
    <div className="container animate-fade-in" style={{ padding: '32px 24px 80px' }}>
      
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>
            {isDoctor ? 'Portal Profesional Médico' : 'Panel de Control Clínico'}
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem' }}>
            {isDoctor 
              ? 'Gestión exclusiva de tu agenda médica, pacientes y honorarios particulares' 
              : 'Gestión completa de agendas, profesionales, coberturas y pacientes'}
          </p>
        </div>
      </div>

      {/* Banner de Enlace Personal para Médicos */}
      {isDoctor && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08), rgba(5, 150, 105, 0.08))',
          border: '1px solid rgba(2, 132, 199, 0.25)',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--color-primary), #059669)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.25rem',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
            }}>
              {user.nombre?.[0] || 'D'}{user.apellido?.[0] || 'R'}
            </div>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: 'var(--color-text-main)' }}>
                Dr/a. {user.nombre} {user.apellido}
              </h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                <span className="badge badge-success">
                  <Stethoscope size={12} /> Médico Profesional
                </span>
                {user.matricula && (
                  <span className="badge badge-neutral">
                    Matrícula: {user.matricula}
                  </span>
                )}
                {user.slug && (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    Enlace de turnos: <strong style={{ color: 'var(--color-primary)' }}>oscarsoft.com.ar/turnos/{user.slug}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                const url = `${window.location.origin}/turnos/${user.slug || ''}`;
                navigator.clipboard.writeText(url);
                showToast('¡Enlace de turnos copiado al portapapeles!');
              }}
              title="Copiar enlace para tus pacientes"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Copy size={15} /> Copiar mi Enlace
            </button>
            {user.slug && (
              <a
                href={`/turnos/${user.slug}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <ExternalLink size={15} /> Ver Ficha Pública
              </a>
            )}
          </div>
        </div>
      )}

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
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              {isDoctor ? 'Turnos Futuros' : 'Médicos Activos'}
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '4px' }}>
              {isDoctor ? (stats.totales?.turnos_futuros || 0) : (stats.totales?.total_medicos || 0)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', marginTop: '4px' }}>
              {isDoctor ? 'Agendados en adelante' : 'En plantilla oficial'}
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              {isDoctor ? 'Pacientes Atendidos' : 'Pacientes Registrados'}
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '4px' }}>
              {isDoctor ? (stats.totales?.total_pacientes || 0) : (stats.totales?.total_pacientes || 0)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', marginTop: '4px' }}>
              {isDoctor ? 'Historial de pacientes' : `Turnos futuros: ${stats.totales?.turnos_futuros || 0}`}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2" style={{ borderBottom: '1px solid var(--color-border)', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
        {(isDoctor ? [
          { id: 'turnos', label: 'Mi Agenda y Turnos', icon: Calendar },
          { id: 'ficha', label: 'Mi Ficha & Perfil', icon: Sparkles },
          { id: 'horarios', label: 'Mis Horarios de Atención', icon: Clock },
          { id: 'suspensiones', label: 'Suspensión de Turnos', icon: AlertTriangle },
          { id: 'coberturas', label: 'Mis Obras Sociales y Coberturas', icon: CreditCard },
          { id: 'link', label: 'Mi Enlace Directo', icon: Eye }
        ] : [
          { id: 'turnos', label: 'Agenda & Turnos', icon: Calendar, minRole: 'recepcionista' },
          { id: 'medicos', label: 'Médicos & Staff', icon: Users, minRole: 'recepcionista' },
          { id: 'usuarios', label: 'Pacientes & Usuarios', icon: ShieldCheck, minRole: 'recepcionista' },
          { id: 'obras', label: 'Obras Sociales & Planes', icon: CreditCard, minRole: 'admin' },
          { id: 'especialidades', label: 'Especialidades', icon: Award, minRole: 'admin' },
          { id: 'sedes', label: 'Sedes y Consultorios', icon: Building2, minRole: 'admin' },
          { id: 'bot', label: 'Bot WhatsApp (Q&A)', icon: MessageSquare, minRole: 'admin' }
        ]).filter(tab => {
          if (isDoctor) return true;
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
            {isDoctor ? (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Profesional</label>
                <div className="form-input" style={{ background: 'var(--color-bg)', display: 'flex', alignItems: 'center' }}>
                  <span className="badge badge-success" style={{ margin: 0 }}>
                    <Stethoscope size={12} /> Dr/a. {user.nombre} {user.apellido}
                  </span>
                </div>
              </div>
            ) : (
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
            )}

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
                options={isDoctor ? [
                  { id: '', label: 'Todos (Vacíos y Ocupados)' },
                  { id: 'ocupado', label: 'Solo Ocupados' },
                  { id: 'libre', label: 'Solo Vacíos / Disponibles' },
                  { id: 'confirmado', label: 'Confirmado / Asignado' },
                  { id: 'asistio', label: 'Asistió' },
                  { id: 'ausente', label: 'Ausente' },
                  { id: 'cancelado', label: 'Cancelado' }
                ] : [
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

          {/* Métricas y resumen del día para el médico */}
          {isDoctor && (
            <div style={{ marginBottom: '20px' }}>
              <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                <span className="badge badge-secondary" style={{ fontSize: '0.8125rem', padding: '6px 12px' }}>
                  Total slots del día: <strong>{agendaMeta?.total_slots ?? turnos.length}</strong>
                </span>
                <span className="badge badge-primary" style={{ fontSize: '0.8125rem', padding: '6px 12px' }}>
                  Ocupados: <strong>{agendaMeta?.ocupados ?? turnos.filter(t => t.tipo === 'ocupado').length}</strong>
                </span>
                <span className="badge badge-success" style={{ fontSize: '0.8125rem', padding: '6px 12px', background: 'rgba(16, 185, 129, 0.12)', color: '#059669', border: '1px solid #10b981' }}>
                  Vacíos / Disponibles: <strong>{agendaMeta?.libres ?? turnos.filter(t => t.tipo === 'vacio' || t.estado === 'libre').length}</strong>
                </span>
              </div>

              {agendaMeta?.suspendido && (
                <div style={{ marginTop: '12px', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-danger)', borderRadius: '8px', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} />
                  <span>
                    <strong>Atención médica suspendida para esta fecha:</strong> {agendaMeta.motivo_suspension}
                  </span>
                </div>
              )}

              {agendaMeta && !agendaMeta.tiene_bloques && turnos.length === 0 && (
                <div style={{ marginTop: '12px', padding: '12px 16px', background: 'rgba(2, 132, 199, 0.08)', border: '1px solid var(--color-primary)', borderRadius: '8px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} />
                  <span>
                    No tenés bloques semanales configurados para los días <strong>{agendaMeta.dia_semana || 'de esta fecha'}</strong>. Podés configurarlos en la pestaña <strong>"Mis Horarios de Atención"</strong>.
                  </span>
                </div>
              )}
            </div>
          )}

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
                    {!isDoctor && <th style={{ padding: '12px 14px' }}>Profesional</th>}
                    <th style={{ padding: '12px 14px' }}>Cobertura</th>
                    <th style={{ padding: '12px 14px' }}>Centro / Cons.</th>
                    <th style={{ padding: '12px 14px' }}>Estado</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Acciones Rápidas</th>
                  </tr>
                </thead>
                <tbody>
                  {turnos.map((t, idx) => {
                    const isVacio = t.tipo === 'vacio' || t.estado === 'libre';
                    return (
                      <tr
                        key={t.id || `slot_${idx}`}
                        style={{
                          borderBottom: '1px solid var(--color-border)',
                          background: isVacio ? 'rgba(16, 185, 129, 0.02)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: isVacio ? 'var(--color-success)' : 'var(--color-primary)' }}>
                          <div className="flex items-center gap-1">
                            <Clock size={14} style={{ opacity: 0.7 }} />
                            <span>{t.hora_inicio.substring(0, 5)} hs</span>
                            {t.hora_fin && (
                              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                                - {t.hora_fin.substring(0, 5)} hs
                              </span>
                            )}
                          </div>
                          {t.fecha && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                              {formatearFechaArg(t.fecha)}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '12px 14px', fontWeight: isVacio ? 400 : 600 }}>
                          {isVacio ? (
                            <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)' }}></span>
                              Turno Disponible (Vacío)
                            </span>
                          ) : (
                            <div>
                              <div style={{ color: 'var(--color-text-main)' }}>{t.paciente_nombre} {t.paciente_apellido}</div>
                              {t.notas && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                                  Nota: {t.notas}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '12px 14px' }}>
                          {isVacio ? (
                            <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                          ) : (
                            <div>
                              <div>DNI: {t.paciente_dni || 'Sin DNI'}</div>
                              {t.paciente_telefono && (
                                <div className="flex items-center gap-1" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                  <span>Tel: {t.paciente_telefono}</span>
                                  {Boolean(t.paciente_whatsapp) && (
                                    <a
                                      href={`https://wa.me/549${String(t.paciente_telefono).replace(/\D/g, '')}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ color: '#25D366', display: 'inline-flex', alignItems: 'center', marginLeft: '4px' }}
                                      title="Abrir chat de WhatsApp"
                                    >
                                      <MessageSquare size={13} />
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {!isDoctor && (
                          <td style={{ padding: '12px 14px' }}>
                            Dr. {t.medico_nombre} {t.medico_apellido}
                          </td>
                        )}

                        <td style={{ padding: '12px 14px' }}>
                          {isVacio ? (
                            <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                          ) : (
                            <div>
                              <strong style={{ color: 'var(--color-text-main)' }}>{t.obra_social_nombre || 'Particular'}</strong>
                              {t.plan_nombre && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                  Plan: {t.plan_nombre}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-main)' }}>
                            {t.unidad_nombre || 'Centro no asignado'}
                          </div>
                          {t.consultorio && (
                            <span className="badge badge-secondary" style={{ fontSize: '0.75rem', padding: '2px 6px', marginTop: '3px', display: 'inline-block' }}>
                              Cons. {t.consultorio}
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '12px 14px' }}>
                          {isVacio ? (
                            <span className="badge badge-success" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669', border: '1px solid #10b981' }}>
                              Libre / Vacío
                            </span>
                          ) : (
                            <span className={`badge ${
                              t.estado === 'asistio' ? 'badge-success' :
                              t.estado === 'ausente' ? 'badge-warning' :
                              t.estado === 'cancelado' ? 'badge-danger' : 'badge-primary'
                            }`}>
                              {t.estado}
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          {isVacio ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              Disponible
                            </span>
                          ) : (
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
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

      {/* VISTA DOCTOR: MI PERFIL, FICHA & HONORARIOS */}
      {isDoctor && activeTab === 'ficha' && (
        <div className="card" style={{ padding: '28px', maxWidth: '840px', margin: '0 auto' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)' }}>
            <div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--color-text-main)' }}>
                Mi Ficha Profesional & Perfil
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: '4px 0 0' }}>
                Gestioná tu información personal, foto de perfil, matrícula, contacto y mensajes para tus pacientes
              </p>
            </div>
            <span className="badge badge-primary">
              <Sparkles size={14} /> Ficha Oficial
            </span>
          </div>

          <form onSubmit={handleSaveDoctorPersonalFicha}>
            {/* FOTO DE PERFIL */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              padding: '16px 20px',
              borderRadius: '12px',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              marginBottom: '24px'
            }}>
              <div style={{ position: 'relative', width: '84px', height: '84px', flexShrink: 0 }}>
                <img
                  src={fichaForm.foto_perfil || obtenerAvatarDefault(fichaForm.nombre, fichaForm.apellido)}
                  alt="Avatar Médico"
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid var(--color-primary-light)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                  }}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = obtenerAvatarDefault(fichaForm.nombre, fichaForm.apellido);
                  }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text-main)', marginBottom: '4px' }}>
                  Foto de Perfil Profesional
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                  Subí una foto nítida de tu rostro. Se mostrará en tu agenda pública y en la lista de profesionales.
                </div>
                <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Upload size={14} /> {subiendoFoto ? 'Cargando foto...' : 'Subir / Cambiar Foto'}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      disabled={subiendoFoto}
                      onChange={handleUploadFoto}
                    />
                  </label>

                  {fichaForm.foto_perfil && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={handleRemoveFoto}
                      disabled={subiendoFoto}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Trash2 size={14} /> Quitar Foto
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* NOMBRE Y APELLIDO */}
            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nombre <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: Pablo"
                  value={fichaForm.nombre}
                  onChange={e => setFichaForm({ ...fichaForm, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Apellido <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: Albano"
                  value={fichaForm.apellido}
                  onChange={e => setFichaForm({ ...fichaForm, apellido: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* USUARIO Y EMAIL */}
            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nombre de Usuario (Login)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: palbano"
                  value={fichaForm.username || ''}
                  onChange={e => setFichaForm({ ...fichaForm, username: e.target.value })}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Permite iniciar sesión sin recordar tu correo.
                </span>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Correo Electrónico (Email)</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="Ej: pablo.albano@sancarlos.com"
                  value={fichaForm.email || ''}
                  onChange={e => setFichaForm({ ...fichaForm, email: e.target.value })}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Recibirás avisos y notificaciones del sistema.
                </span>
              </div>
            </div>

            {/* DNI Y MATRÍCULA */}
            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">DNI</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: 28456789"
                  value={fichaForm.dni || ''}
                  onChange={e => setFichaForm({ ...fichaForm, dni: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Matrícula Profesional (M.P. / M.N.)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: MP 14590"
                  value={fichaForm.matricula || ''}
                  onChange={e => setFichaForm({ ...fichaForm, matricula: e.target.value })}
                />
              </div>
            </div>

            {/* TELÉFONO Y DIRECCIÓN */}
            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Teléfono / WhatsApp de Contacto</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="Ej: 2944123456"
                  value={fichaForm.telefono || ''}
                  onChange={e => setFichaForm({ ...fichaForm, telefono: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Dirección / Consultorio de Atención</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: Av. San Martín 450, Consultorio 3"
                  value={fichaForm.direccion || ''}
                  onChange={e => setFichaForm({ ...fichaForm, direccion: e.target.value })}
                />
              </div>
            </div>

            {/* BIOGRAFÍA */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Presentación / Biografía Profesional</label>
              <textarea
                className="form-input"
                rows="3"
                placeholder="Breve descripción de tu trayectoria, especialidad o enfoque de atención..."
                value={fichaForm.biografia || ''}
                onChange={e => setFichaForm({ ...fichaForm, biografia: e.target.value })}
              />
            </div>

            {/* MENSAJE AL PACIENTE */}
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={16} style={{ color: 'var(--color-primary)' }} /> Mensaje e Indicaciones Previas para el Paciente
              </label>
              <textarea
                className="form-input"
                rows="3"
                placeholder="Instrucciones para los pacientes al momento de agendar (ej: 'Por favor concurrir con 15 minutos de anticipación, con estudios previos de laboratorio y carnet de obra social')..."
                value={fichaForm.mensaje_paciente || ''}
                onChange={e => setFichaForm({ ...fichaForm, mensaje_paciente: e.target.value })}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Este mensaje se mostrará de manera destacada a los pacientes cuando reserven un turno con vos en la web.
              </span>
            </div>

            {/* CAMBIO DE CONTRASEÑA */}
            <div className="form-group" style={{ marginBottom: '20px', maxWidth: '380px' }}>
              <label className="form-label">Modificar Contraseña (Opcional)</label>
              <input
                type="password"
                className="form-input"
                placeholder="Dejar en blanco si no deseas cambiarla"
                value={fichaForm.password || ''}
                onChange={e => setFichaForm({ ...fichaForm, password: e.target.value })}
              />
            </div>

            {/* SECCIÓN ATENCIÓN PARTICULAR Y HONORARIOS */}
            <div style={{
              margin: '20px 0',
              padding: '20px',
              borderRadius: '12px',
              background: 'rgba(2, 132, 199, 0.05)',
              border: '1px solid rgba(2, 132, 199, 0.2)'
            }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <DollarSign size={18} /> Atención Particular & Honorarios
              </h4>

              <label className="flex items-center gap-2" style={{ cursor: 'pointer', marginBottom: '12px', fontSize: '0.875rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={fichaForm.acepta_particular}
                  onChange={e => setFichaForm({ ...fichaForm, acepta_particular: e.target.checked })}
                />
                <span>Acepto pacientes de forma <strong>Particular (Privado)</strong></span>
              </label>

              {fichaForm.acepta_particular && (
                <div style={{ paddingLeft: '12px', borderLeft: '2px solid var(--color-primary-light)' }}>
                  <div className="form-group" style={{ marginBottom: '12px', maxWidth: '320px' }}>
                    <label className="form-label">Valor de los Honorarios de Consulta Particular ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      className="form-input"
                      placeholder="Ej: 25000"
                      value={fichaForm.honorarios_particular}
                      onChange={e => setFichaForm({ ...fichaForm, honorarios_particular: e.target.value })}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      Si dejas este campo vacío, la reserva aparecerá solo como "Particular".
                    </span>
                  </div>

                  <label className="flex items-center gap-2" style={{ cursor: 'pointer', fontSize: '0.8125rem' }}>
                    <input
                      type="checkbox"
                      checked={fichaForm.mostrar_honorarios}
                      onChange={e => setFichaForm({ ...fichaForm, mostrar_honorarios: e.target.checked })}
                    />
                    <span>Mostrar el valor de mis honorarios a los pacientes en el formulario de reserva</span>
                  </label>
                </div>
              )}
            </div>

            {/* REGLAS DE ANTELACIÓN */}
            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '24px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Antelación de Agenda (Días hacia adelante)</label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  className="form-input"
                  placeholder="Por defecto: 60 días"
                  value={fichaForm.dias_antelacion_agenda}
                  onChange={e => setFichaForm({ ...fichaForm, dias_antelacion_agenda: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Día del Mes en que abre la Agenda (Opcional)</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  className="form-input"
                  placeholder="Ej: 20 (Día 20 del mes)"
                  value={fichaForm.dia_apertura_agenda}
                  onChange={e => setFichaForm({ ...fichaForm, dia_apertura_agenda: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingFicha}
                style={{ padding: '10px 28px', fontWeight: 700 }}
              >
                {savingFicha ? 'Guardando cambios...' : 'Guardar Mi Ficha y Perfil'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VISTA DOCTOR: SUSPENSIÓN DE TURNOS & FECHAS */}
      {isDoctor && activeTab === 'suspensiones' && (
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Tarjeta de Nueva Suspensión */}
          <div className="card" style={{ padding: '28px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={22} /> Suspensión de Turnos y Fechas de Atención
                </h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: '4px 0 0' }}>
                  Seleccioná el día o período en que no podrás atender (vacaciones, congresos, fuerza mayor). Se bloqueará tu agenda pública y se armará la lista de pacientes a notificar.
                </p>
              </div>
              <span className="badge badge-warning" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                Bloqueo de Agenda
              </span>
            </div>

            <form onSubmit={handleCrearSuspension}>
              <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Fecha Desde</label>
                  <input
                    type="date"
                    className="form-input"
                    value={suspFechaInicio}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => {
                      const val = e.target.value;
                      setSuspFechaInicio(val);
                      if (!suspFechaFin || suspFechaFin < val) setSuspFechaFin(val);
                      handleConsultarAfectados(val, suspFechaFin || val);
                    }}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Fecha Hasta</label>
                  <input
                    type="date"
                    className="form-input"
                    value={suspFechaFin}
                    min={suspFechaInicio || new Date().toISOString().split('T')[0]}
                    onChange={e => {
                      const val = e.target.value;
                      setSuspFechaFin(val);
                      handleConsultarAfectados(suspFechaInicio, val);
                    }}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Motivo de la Suspensión (Opcional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: Congreso Médico, Vacaciones, Motivos de fuerza mayor..."
                  value={suspMotivo}
                  onChange={e => setSuspMotivo(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="flex items-center gap-2" style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={suspCancelarTurnos}
                    onChange={e => setSuspCancelarTurnos(e.target.checked)}
                  />
                  <span>Cancelar automáticamente los turnos de los pacientes en ese período (se marcan cancelados para liberar el horario y se conserva el listado para avisarles)</span>
                </label>
              </div>

              {/* Pacientes Afectados Preview */}
              {suspFechaInicio && suspFechaFin && (
                <div style={{
                  padding: '20px',
                  borderRadius: '12px',
                  background: afectadosPreview.length > 0 ? '#fffbeb' : '#f0fdf4',
                  border: `1px solid ${afectadosPreview.length > 0 ? '#fde68a' : '#bbf7d0'}`,
                  marginBottom: '20px'
                }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9375rem', color: afectadosPreview.length > 0 ? '#92400e' : '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {afectadosPreview.length > 0 ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
                      {loadingAfectados ? 'Consultando turnos...' : (
                        afectadosPreview.length > 0
                          ? `Se encontraron ${afectadosPreview.length} paciente(s) con turnos en este período:`
                          : 'No hay pacientes con turnos reservados en este rango de fechas.'
                      )}
                    </div>
                  </div>

                  {afectadosPreview.length > 0 && (
                    <div style={{ overflowX: 'auto', maxHeight: '350px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                        <thead style={{ background: '#fef3c7', borderBottom: '1px solid #fde68a' }}>
                          <tr>
                            <th style={{ padding: '8px 12px' }}>Paciente</th>
                            <th style={{ padding: '8px 12px' }}>Fecha y Hora</th>
                            <th style={{ padding: '8px 12px' }}>Cobertura</th>
                            <th style={{ padding: '8px 12px' }}>Teléfono / WhatsApp</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Avisar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {afectadosPreview.map(p => {
                            const cleanPhone = (p.paciente_telefono || '').replace(/\D+/g, '');
                            const msgWa = `Hola ${p.paciente_nombre}, nos comunicamos del consultorio del Dr. ${fichaForm.nombre} ${fichaForm.apellido}. Le informamos que por ${suspMotivo ? `motivos de ${suspMotivo}` : 'razones de fuerza mayor'}, su turno programado para el día ${formatearFechaArg(p.fecha)} a las ${p.hora_inicio.substring(0, 5)} hs ha debido suspenderse. Nos pondremos en contacto a la brevedad para coordinar la reprogramación. Sepa disculpar las molestias.`;
                            const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`}?text=${encodeURIComponent(msgWa)}` : null;

                            return (
                              <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                                  {p.paciente_nombre} {p.paciente_apellido}
                                  {p.paciente_dni && <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>DNI: {p.paciente_dni}</div>}
                                </td>
                                <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                                  {formatearFechaArg(p.fecha)} - {p.hora_inicio.substring(0, 5)} hs
                                </td>
                                <td style={{ padding: '8px 12px' }}>
                                  {p.obra_social_nombre || 'Particular'}
                                </td>
                                <td style={{ padding: '8px 12px' }}>
                                  {p.paciente_telefono || 'Sin teléfono'}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                  <div className="flex items-center justify-end gap-1">
                                    {waUrl ? (
                                      <a
                                        href={waUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-sm"
                                        style={{
                                          background: '#25D366',
                                          color: 'white',
                                          fontWeight: 700,
                                          fontSize: '0.75rem',
                                          padding: '4px 10px',
                                          borderRadius: '6px'
                                        }}
                                        title="Abrir WhatsApp con mensaje pre-armado"
                                      >
                                        <MessageSquare size={13} /> WhatsApp
                                      </a>
                                    ) : null}

                                    {p.paciente_telefono && (
                                      <a
                                        href={`tel:${p.paciente_telefono}`}
                                        className="btn btn-sm btn-secondary"
                                        style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '6px' }}
                                        title="Llamar al paciente"
                                      >
                                        <Phone size={13} /> Llamar
                                      </a>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={savingSuspension || !suspFechaInicio || !suspFechaFin}
                  style={{ padding: '10px 24px', fontWeight: 700 }}
                >
                  {savingSuspension ? 'Guardando suspensión...' : 'Confirmar Suspensión y Bloquear Fechas'}
                </button>
              </div>
            </form>
          </div>

          {/* Tarjeta de Historial de Suspensiones */}
          <div className="card" style={{ padding: '28px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
              <div>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--color-text-main)' }}>
                  Mis Suspensiones Registradas
                </h4>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', margin: '2px 0 0' }}>
                  Períodos en que tu agenda permanece bloqueada
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={fetchSuspensiones}
                disabled={loadingSuspensiones}
              >
                <RefreshCw size={14} className={loadingSuspensiones ? 'spin' : ''} /> Actualizar
              </button>
            </div>

            {loadingSuspensiones ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-muted)' }}>
                Cargando suspensiones...
              </div>
            ) : suspensiones.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-muted)', background: 'var(--color-bg)', borderRadius: '8px' }}>
                No tenés suspensiones activas registradas. Tu agenda atiende con normalidad en tus días y horarios configurados.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    <tr>
                      <th style={{ padding: '10px 14px' }}>Período Suspendido</th>
                      <th style={{ padding: '10px 14px' }}>Motivo</th>
                      <th style={{ padding: '10px 14px' }}>Fecha Registro</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suspensiones.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--color-danger)' }}>
                          {formatearFechaArg(s.fecha_inicio)} al {formatearFechaArg(s.fecha_fin)}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {s.motivo || 'Suspensión médica'}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                          {formatearFechaArg(s.creado_en)}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => {
                                setSuspFechaInicio(s.fecha_inicio);
                                setSuspFechaFin(s.fecha_fin);
                                handleConsultarAfectados(s.fecha_inicio, s.fecha_fin);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              title="Ver pacientes con turnos en este período"
                            >
                              <Users size={14} /> Ver Pacientes
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleEliminarSuspension(s.id)}
                              title="Levantar suspensión y reanudar atención"
                            >
                              <Trash2 size={14} /> Reanudar Atención
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VISTA DOCTOR: MIS COBERTURAS Y OBRAS SOCIALES */}
      {isDoctor && activeTab === 'coberturas' && (
        <div className="card" style={{ padding: '28px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--color-text-main)' }}>
                Mis Obras Sociales y Coberturas Médicas
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: '4px 0 0' }}>
                Por default todos los planes y obras sociales están <strong>marcados (activos)</strong>. Destildá aquellos con los que no desees atender.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-primary"
                disabled={savingDoctorCoberturas}
                onClick={handleSaveDoctorPersonalCoberturas}
              >
                {savingDoctorCoberturas ? 'Guardando...' : 'Guardar Mis Coberturas'}
              </button>
            </div>
          </div>

          {/* Barra de herramientas y filtros */}
          <div className="flex items-center justify-between gap-4" style={{ marginBottom: '20px', flexWrap: 'wrap' }}>
            <div className="flex items-center gap-3" style={{ flex: 1, minWidth: '280px', maxWidth: '480px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Buscar obra social o plan (ej: Swiss, OSDE, Galeno)..."
                value={coberturasSearch}
                onChange={e => setCoberturasSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedOSIds(new Set(coberturasAllObras.map(o => Number(o.id))))}
                title="Marcar todas las obras sociales como aceptadas"
              >
                <CheckCircle size={14} style={{ color: 'var(--color-success)' }} /> Marcar Todas
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedOSIds(new Set())}
                title="Desmarcar todas"
              >
                <XCircle size={14} style={{ color: 'var(--color-danger)' }} /> Desmarcar Todas
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between" style={{ marginBottom: '16px', padding: '8px 12px', background: 'var(--color-bg)', borderRadius: '8px', fontSize: '0.875rem', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              Habilitadas para atender: <strong style={{ color: 'var(--color-primary)' }}>{selectedOSIds.size}</strong> de <strong>{coberturasAllObras.length}</strong> obras sociales y prepagas
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className={`btn btn-sm ${coberturasFiltroTipo === 'todas' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                onClick={() => setCoberturasFiltroTipo('todas')}
              >
                Todas ({coberturasAllObras.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${coberturasFiltroTipo === 'marcadas' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                onClick={() => setCoberturasFiltroTipo('marcadas')}
              >
                Marcadas ({selectedOSIds.size})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${coberturasFiltroTipo === 'desmarcadas' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                onClick={() => setCoberturasFiltroTipo('desmarcadas')}
              >
                Desmarcadas ({coberturasAllObras.length - selectedOSIds.size})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '4px' }}>
            {coberturasAllObras
              .filter(o => {
                const matchesSearch = !coberturasSearch || o.nombre.toLowerCase().includes(coberturasSearch.toLowerCase());
                if (!matchesSearch) return false;
                const isChecked = selectedOSIds.has(Number(o.id));
                if (coberturasFiltroTipo === 'marcadas') return isChecked;
                if (coberturasFiltroTipo === 'desmarcadas') return !isChecked;
                return true;
              })
              .map(o => {
                const isChecked = selectedOSIds.has(Number(o.id));
                return (
                  <div
                    key={o.id}
                    className="card"
                    style={{
                      padding: '12px 16px',
                      background: isChecked ? 'rgba(2, 132, 199, 0.05)' : 'var(--color-bg)',
                      border: isChecked ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onClick={() => {
                      const next = new Set(selectedOSIds);
                      if (next.has(Number(o.id))) {
                        next.delete(Number(o.id));
                      } else {
                        next.add(Number(o.id));
                      }
                      setSelectedOSIds(next);
                    }}
                  >
                    <label className="flex items-center gap-3" style={{ cursor: 'pointer', margin: 0, width: '100%' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // controlado por el card onClick
                      />
                      <span style={{ fontWeight: isChecked ? 700 : 500, fontSize: '0.9375rem', color: isChecked ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}>
                        {o.nombre}
                      </span>
                    </label>
                  </div>
                );
              })}
          </div>

          <div className="flex justify-between items-center" style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              Recordá hacer clic en "Guardar Mis Coberturas" para aplicar los cambios a tu agenda de pacientes.
            </span>
            <button
              className="btn btn-primary"
              disabled={savingDoctorCoberturas}
              onClick={handleSaveDoctorPersonalCoberturas}
            >
              {savingDoctorCoberturas ? 'Guardando...' : 'Guardar Mis Coberturas'}
            </button>
          </div>
        </div>
      )}

      {/* VISTA DOCTOR: MI ENLACE DIRECTO */}
      {isDoctor && activeTab === 'link' && (
        <div className="card" style={{ padding: '32px', maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-primary), #059669)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 24px rgba(2, 132, 199, 0.25)'
          }}>
            <ExternalLink size={30} />
          </div>

          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>
            Tu Enlace Personal de Turnos Médicos
          </h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem', marginBottom: '24px' }}>
            Tus pacientes pueden ingresar a este link para reservar turnos directamente con vos, consultar tus horarios y conocer tus honorarios o coberturas aceptadas.
          </p>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--color-bg)',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid var(--color-border)',
            marginBottom: '24px'
          }}>
            <input
              type="text"
              readOnly
              className="form-input"
              style={{ border: 'none', background: 'transparent', fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.95rem' }}
              value={`${window.location.origin}/turnos/${user.slug || 'bocianjorge'}`}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                const url = `${window.location.origin}/turnos/${user.slug || 'bocianjorge'}`;
                navigator.clipboard.writeText(url);
                showToast('¡Enlace copiado al portapapeles!');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            >
              <Copy size={16} /> Copiar Enlace
            </button>
          </div>

          <div className="flex justify-center gap-3">
            <a
              href={`/turnos/${user.slug || 'bocianjorge'}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Eye size={16} /> Ver mi Ficha de Reserva
            </a>
          </div>

          <div style={{
            marginTop: '32px',
            padding: '16px',
            borderRadius: '12px',
            background: 'rgba(2, 132, 199, 0.04)',
            border: '1px dashed rgba(2, 132, 199, 0.25)',
            textAlign: 'left',
            fontSize: '0.8125rem',
            color: 'var(--color-text-muted)'
          }}>
            <strong style={{ color: 'var(--color-text-main)', display: 'block', marginBottom: '4px' }}>
              💡 Sugerencia para tus pacientes:
            </strong>
            Podés agregar este enlace en tu perfil de Instagram, en tu estado o mensaje de bienvenida de WhatsApp Business, o en tu tarjeta personal para que tus pacientes se autogestionen el turno en cualquier horario sin demoras telefónicas.
          </div>
        </div>
      )}

      {/* TAB 2: MÉDICOS Y STAFF (ADMIN ONLY) */}
      {!isDoctor && activeTab === 'medicos' && (
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
                      {m.username && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                          Usuario: <strong>@{m.username}</strong>
                        </div>
                      )}
                      {m.matricula && (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)' }}>
                          M.N./M.P. {m.matricula}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                    <strong>Especialidades:</strong> {m.especialidades_nombres || 'General'}
                  </div>

                  {/* Estado de Atención Particular y Honorarios */}
                  <div style={{
                    fontSize: '0.75rem',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: m.acepta_particular !== 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                    color: m.acepta_particular !== 0 ? '#059669' : '#dc2626',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>
                      {m.acepta_particular !== 0 ? '✓ Atiende Particular' : '✗ No atiende particular'}
                    </span>
                    {m.acepta_particular !== 0 && m.honorarios_particular && (
                      <span style={{ fontWeight: 700 }}>
                        ${Number(m.honorarios_particular).toLocaleString('es-AR')}
                        {m.mostrar_honorarios ? ' (Visible)' : ' (Oculto)'}
                      </span>
                    )}
                  </div>

                  <button 
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%', marginBottom: '8px' }}
                    onClick={() => handleOpenEditFicha(m)}
                  >
                    <Edit size={14} /> Ficha & Honorarios
                  </button>

                  <div className="flex gap-2">
                    <button 
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => handleOpenDoctorCoberturas(m)}
                    >
                      <ShieldCheck size={14} /> Coberturas
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      onClick={() => {
                        setCredMedicoId(m.id);
                        setCredUsername(m.username || '');
                        setCredEmail(m.email || '');
                        setCredPassword('');
                        const el = document.getElementById('seccion-credenciales-medico');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      title="Asignar o Modificar Credenciales de Acceso"
                    >
                      <Key size={14} /> Credenciales
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* SECCIÓN ASIGNAR O CAMBIAR USUARIO Y CONTRASEÑA A UN MÉDICO */}
          <div id="seccion-credenciales-medico" style={{ marginTop: '32px', padding: '24px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-3" style={{ marginBottom: '18px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15), rgba(5, 150, 105, 0.15))',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Key size={22} />
              </div>
              <div>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--color-text-main)' }}>
                  Asignar o Modificar Usuario y Contraseña a un Médico
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  Configura las credenciales para que el profesional ingrese a su Portal Médico exclusivo
                </p>
              </div>
            </div>

            <form onSubmit={handleGuardarCredencialesMedico}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Seleccionar Médico <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                  <SearchableSelect
                    options={medicos.map(m => ({
                      id: m.id,
                      label: `Dr. ${m.nombre} ${m.apellido} (${m.username ? `@${m.username}` : 'Sin usuario'} | ${m.email || 'Sin correo'})`
                    }))}
                    value={credMedicoId}
                    onChange={(val) => {
                      setCredMedicoId(val);
                      const med = medicos.find(m => String(m.id) === String(val));
                      if (med) {
                        setCredUsername(med.username || '');
                        setCredEmail(med.email || '');
                        setCredPassword('');
                      }
                    }}
                    placeholder="Selecciona el profesional..."
                    searchPlaceholder="Buscar médico..."
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Nombre Simple de Usuario</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej: drperez o bocian"
                    value={credUsername}
                    onChange={e => setCredUsername(e.target.value)}
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Para acceso rápido sin escribir correo.
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Correo Electrónico (Email)</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="Ej: doctor@sancarlos.com"
                    value={credEmail}
                    onChange={e => setCredEmail(e.target.value)}
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Email de notificaciones y login alternativo.
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Nueva Contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCredPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Mínimo 6 caracteres"
                      value={credPassword}
                      onChange={e => setCredPassword(e.target.value)}
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCredPassword(!showCredPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-text-muted)'
                      }}
                    >
                      {showCredPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Vacío = mantiene contraseña actual.
                  </div>
                </div>
              </div>

              <div style={{ padding: '10px 14px', background: 'rgba(2, 132, 199, 0.05)', borderRadius: '10px', border: '1px solid rgba(2, 132, 199, 0.15)', marginBottom: '16px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                💡 <strong>Flexibilidad de Acceso:</strong> Podés asignarle al profesional un nombre de usuario simple (ej: <em>drperez</em>), su correo electrónico oficial, o ambos. El médico podrá ingresar en su portal con su usuario simple, correo o DNI.
              </div>

              <div className="flex items-center justify-between" style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  {credMedicoId ? (
                    <span>Médico seleccionado: <strong style={{ color: 'var(--color-primary)' }}>Dr. {medicos.find(m => String(m.id) === String(credMedicoId))?.nombre} {medicos.find(m => String(m.id) === String(credMedicoId))?.apellido}</strong></span>
                  ) : (
                    <span>Selecciona un médico de la lista o presiona el botón "Credenciales" en su tarjeta superior.</span>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingCred || !credMedicoId}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Key size={16} /> {savingCred ? 'Guardando...' : 'Guardar Credenciales'}
                </button>
              </div>
            </form>
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
            {isDoctor ? 'Mis Horarios de Atención Semanal' : 'Configuración de Horarios de Atención Semanal'}
          </h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '20px' }}>
            {isDoctor 
              ? 'Define tus bloques semanales y la duración de cada consulta para que los pacientes puedan agendar turnos.'
              : 'Define los bloques semanales en los que el médico atiende en cada consultorio.'}
          </p>

          {isDoctor ? (
            <div style={{ padding: '14px 18px', background: 'rgba(2, 132, 199, 0.08)', borderRadius: '12px', border: '1px solid rgba(2, 132, 199, 0.2)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Stethoscope size={24} color="var(--color-primary)" />
              <div>
                <strong style={{ color: 'var(--color-primary)', fontSize: '1rem', display: 'block' }}>
                  Agenda de Atención Semanal: Dr/a. {user?.nombre} {user?.apellido}
                </strong>
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  Configurá tus días de atención, el rango de horarios y la duración que tendrá cada consulta (15, 20, 30, 45 o 60 min).
                </span>
              </div>
            </div>
          ) : (
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
          )}

          {(isDoctor || horariosMedicoId) && (
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Bloques Semanales Configurados</h4>
                <button className="btn btn-secondary btn-sm" onClick={handleAddBloqueHorario}>
                  <Plus size={16} /> Añadir Bloque de Horario
                </button>
              </div>

              {horariosBloques.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', background: 'var(--color-bg)', borderRadius: '12px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
                  {isDoctor 
                    ? 'Aún no configuraste tus bloques de atención semanal. Haz clic en "Añadir Bloque de Horario" para habilitar tu agenda.' 
                    : 'Este médico no tiene bloques de atención configurados. Haz clic en "Añadir Bloque" para habilitar su agenda.'}
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
                        <TimeInput24
                          value={b.hora_inicio}
                          onChange={newTime => {
                            const updated = [...horariosBloques];
                            updated[idx].hora_inicio = newTime + ':00';
                            setHorariosBloques(updated);
                          }}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>A:</span>
                        <TimeInput24
                          value={b.hora_fin}
                          onChange={newTime => {
                            const updated = [...horariosBloques];
                            updated[idx].hora_fin = newTime + ':00';
                            setHorariosBloques(updated);
                          }}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Turno:</span>
                        <DurationPicker5Min
                          value={b.duracion_turno_minutos}
                          onChange={newDur => {
                            const updated = [...horariosBloques];
                            updated[idx].duracion_turno_minutos = newDur;
                            setHorariosBloques(updated);
                          }}
                        />
                      </div>

                      {/* Selector de Centro / Sede */}
                      <div style={{ flex: 1, minWidth: '170px' }}>
                        <select
                          className="form-select"
                          value={b.unidad_id || ''}
                          onChange={e => {
                            const updated = [...horariosBloques];
                            updated[idx].unidad_id = e.target.value ? parseInt(e.target.value, 10) : null;
                            setHorariosBloques(updated);
                          }}
                          title="Seleccionar Centro o Sede médica de atención"
                        >
                          <option value="">Centro no asignado</option>
                          {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                      </div>

                      {/* Consultorio (Opcional, 2 o 3 dígitos) */}
                      <div className="flex items-center gap-1" style={{ width: '120px' }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Cons:</span>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="N° (opc.)"
                          maxLength={3}
                          value={b.consultorio || ''}
                          onChange={e => {
                            const val = e.target.value.replace(/[^0-9a-zA-Z]/g, '').slice(0, 3);
                            const updated = [...horariosBloques];
                            updated[idx].consultorio = val;
                            setHorariosBloques(updated);
                          }}
                          style={{ width: '70px', padding: '6px 8px', textAlign: 'center', fontSize: '0.875rem' }}
                          title="Número de consultorio (opcional, hasta 3 dígitos)"
                        />
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
                <Save size={16} /> {savingHorarios ? 'Guardando...' : (isDoctor ? 'Guardar Mis Horarios' : 'Guardar Horarios del Profesional')}
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
          {/* Header y Barra de Búsqueda Responsive */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ marginBottom: '24px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Administración de Usuarios y Permisos</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '4px', marginBottom: 0 }}>
                Control y asignación de roles: Paciente, Recepcionista / Telefonista, Administrador y Médico
              </p>
            </div>

            {/* Barra de Búsqueda Moderna y Responsive */}
            <div className="flex items-center gap-2 w-full md:w-auto" style={{ maxWidth: '420px', minWidth: '280px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search 
                  size={18} 
                  style={{ 
                    position: 'absolute', 
                    left: '12px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: 'var(--color-text-muted)',
                    pointerEvents: 'none' 
                  }} 
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Buscar por nombre, email o DNI..."
                  style={{ 
                    paddingLeft: '38px', 
                    paddingRight: usuarioSearch ? '36px' : '14px',
                    width: '100%'
                  }}
                  value={usuarioSearch}
                  onChange={e => setUsuarioSearch(e.target.value)}
                />
                {usuarioSearch && (
                  <button
                    type="button"
                    onClick={() => setUsuarioSearch('')}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px'
                    }}
                    title="Limpiar búsqueda"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Filtro rápido por rol + Contador de usuarios encontrados */}
          <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginBottom: '20px' }}>
            <div className="flex flex-wrap gap-2">
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

            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              Mostrando <strong style={{ color: 'var(--color-text-main)' }}>{usuarios.length}</strong> usuarios
            </div>
          </div>

          {usuarios.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', background: 'var(--color-bg)', borderRadius: '12px' }}>
              <Search size={36} style={{ color: 'var(--color-text-muted)', margin: '0 auto 12px', opacity: 0.5 }} />
              <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-text-main)', marginBottom: '4px' }}>
                No se encontraron usuarios
              </div>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: 0 }}>
                {usuarioSearch || rolFiltro 
                  ? 'No hay registros que coincidan con la búsqueda o filtro seleccionado.' 
                  : 'No hay usuarios registrados en el sistema.'}
              </p>
              {(usuarioSearch || rolFiltro) && (
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ marginTop: '16px' }}
                  onClick={() => { setUsuarioSearch(''); setRolFiltro(''); }}
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
              <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <tr>
                    <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>ID</th>
                    <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Nombre Completo</th>
                    <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>DNI</th>
                    <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Email / Usuario</th>
                    <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Rol Actual</th>
                    <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Asignar Rol</th>
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
                        <td style={{ padding: '12px 14px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>#{u.id}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 600, whiteSpace: 'nowrap' }}>{u.nombre} {u.apellido}</td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>{u.dni || '-'}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <div>{u.email}</div>
                          {u.username && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                              @{u.username}
                            </div>
                          )}
                          {u.email === 'oscarns@gmail.com' && (
                            <span style={{ fontSize: '0.6875rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                              ★ Administrador Principal
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <span className={`badge ${rolBadgeClass}`}>
                            {rolLabel}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
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
          )}
        </div>
      )}

      {/* TAB 8: BOT WHATSAPP PREGUNTAS Y RESPUESTAS */}
      {activeTab === 'bot' && (
        <div className="card" style={{ padding: '24px' }}>
          {/* Header de la Sección */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ marginBottom: '24px' }}>
            <div>
              <div className="flex items-center gap-2">
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(37, 211, 102, 0.15)',
                  color: '#128C7E',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <MessageSquare size={20} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  Bot WhatsApp: Preguntas, Respuestas & Disparadores
                </h3>
              </div>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '6px', marginBottom: 0 }}>
                Administrá las plantillas de mensajes del flujo interactivo y configurá respuestas automáticas personalizadas activadas por palabras clave.
              </p>
            </div>

            <button
              onClick={handleOpenNewBotModal}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
            >
              <Plus size={18} /> Nueva Respuesta / Pregunta
            </button>
          </div>

          {/* Filtros y Buscador */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3" style={{ marginBottom: '20px' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '420px' }}>
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)',
                  pointerEvents: 'none'
                }}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Buscar por clave, título, palabras clave o texto..."
                style={{ paddingLeft: '38px', width: '100%' }}
                value={botSearch}
                onChange={e => setBotSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                className="form-select"
                style={{ fontSize: '0.875rem' }}
                value={botFiltroActivo}
                onChange={e => setBotFiltroActivo(e.target.value)}
              >
                <option value="todos">Todos los estados</option>
                <option value="activos">Solo Activos</option>
                <option value="inactivos">Solo Inactivos</option>
              </select>

              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                Total: <strong>{botRespuestas.length}</strong>
              </div>
            </div>
          </div>

          {/* Mensaje Informativo o Tip */}
          <div style={{
            background: 'rgba(37, 211, 102, 0.08)',
            border: '1px solid rgba(37, 211, 102, 0.3)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '0.875rem'
          }}>
            <Sparkles size={20} style={{ color: '#128C7E', flexShrink: 0 }} />
            <div>
              <strong>¿Cómo funciona?</strong> Si definís <em>Palabras Disparadoras</em> (ej: <code>estacionamiento, auto, cochera</code>), cuando un paciente escriba esa palabra en WhatsApp, el bot le responderá automáticamente este mensaje. Además, podés personalizar los textos oficiales del sistema (ej: <code>menu_principal</code>, <code>sedes_info</code>, <code>solicitar_dni</code>).
            </div>
          </div>

          {/* Tabla de Preguntas y Respuestas */}
          {botLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
              Cargando respuestas del bot...
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left', color: 'var(--color-text-muted)' }}>
                    <th style={{ padding: '12px 14px', width: '220px' }}>Clave & Título</th>
                    <th style={{ padding: '12px 14px', width: '200px' }}>Disparadores (Keywords)</th>
                    <th style={{ padding: '12px 14px' }}>Mensaje que envía el Bot</th>
                    <th style={{ padding: '12px 14px', width: '100px', textAlign: 'center' }}>Estado</th>
                    <th style={{ padding: '12px 14px', width: '110px', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBotList.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                        No se encontraron respuestas o preguntas que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredBotList.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)', verticalAlign: 'top' }}>
                        <td style={{ padding: '14px 14px' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>
                            {item.titulo}
                          </div>
                          <div style={{ marginTop: '4px' }}>
                            <code style={{
                              fontSize: '0.75rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'var(--color-bg-secondary, rgba(0,0,0,0.06))',
                              color: 'var(--color-primary)',
                              fontFamily: 'monospace'
                            }}>
                              {item.clave}
                            </code>
                          </div>
                          {item.descripcion && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                              {item.descripcion}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '14px 14px' }}>
                          {item.disparador ? (
                            <div className="flex flex-wrap gap-1">
                              {item.disparador.split(',').map((trig, idx) => (
                                <span
                                  key={idx}
                                  className="badge"
                                  style={{
                                    fontSize: '0.72rem',
                                    background: 'rgba(37, 99, 235, 0.1)',
                                    color: 'var(--color-primary)',
                                    border: '1px solid rgba(37, 99, 235, 0.2)'
                                  }}
                                >
                                  {trig.trim()}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                              ⚡ Flujo interno
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '14px 14px' }}>
                          <div style={{
                            background: '#F0FDF4',
                            border: '1px solid #BBF7D0',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            maxHeight: '130px',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            fontSize: '0.8125rem',
                            color: '#14532D',
                            lineHeight: '1.45',
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                          }}>
                            {item.mensaje}
                          </div>
                        </td>

                        <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleBotActivo(item)}
                            title="Hacer clic para activar o pausar"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0
                            }}
                          >
                            <span className={`badge ${item.activo ? 'badge-success' : 'badge-secondary'}`} style={{ cursor: 'pointer' }}>
                              {item.activo ? '● Activo' : '○ Pausado'}
                            </span>
                          </button>
                        </td>

                        <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditBotModal(item)}
                              className="btn btn-sm btn-secondary"
                              title="Editar respuesta"
                              style={{ padding: '6px 8px' }}
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteBotRespuesta(item.id, item.titulo)}
                              className="btn btn-sm btn-danger"
                              title="Eliminar respuesta"
                              style={{ padding: '6px 8px' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
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
                  <label className="form-label">Nombre de Usuario Simple (Login)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej: drperez o bocian"
                    value={medicoForm.username}
                    onChange={e => setMedicoForm({ ...medicoForm, username: e.target.value })}
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Para ingresar rápido con su usuario corto.
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Email Oficial / Notificaciones <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                  <input
                    type="email"
                    className="form-input"
                    required
                    placeholder="medico@clinica.com"
                    value={medicoForm.email}
                    onChange={e => setMedicoForm({ ...medicoForm, email: e.target.value })}
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Correo electrónico institucional o personal.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                <div className="form-group">
                  <label className="form-label">Teléfono de Contacto</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="Ej: 2944123456"
                    value={medicoForm.telefono}
                    onChange={e => setMedicoForm({ ...medicoForm, telefono: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">DNI (Login alternativo)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej: 30123456"
                    value={medicoForm.dni}
                    onChange={e => setMedicoForm({ ...medicoForm, dni: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Contraseña Asignada</label>
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

              <div style={{ padding: '12px', background: 'var(--color-bg)', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--color-border)' }}>
                <label className="flex items-center gap-2" style={{ cursor: 'pointer', marginBottom: '10px', fontSize: '0.875rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={medicoForm.acepta_particular}
                    onChange={e => setMedicoForm({ ...medicoForm, acepta_particular: e.target.checked })}
                  />
                  <span>Atiende pacientes particulares</span>
                </label>

                {medicoForm.acepta_particular && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Honorarios Particulares ($)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Ej: 25000"
                        value={medicoForm.honorarios_particular}
                        onChange={e => setMedicoForm({ ...medicoForm, honorarios_particular: e.target.value })}
                      />
                    </div>
                    <div className="form-group flex flex-col justify-end" style={{ margin: 0 }}>
                      <label className="flex items-center gap-2" style={{ cursor: 'pointer', fontSize: '0.8125rem' }}>
                        <input
                          type="checkbox"
                          checked={medicoForm.mostrar_honorarios}
                          onChange={e => setMedicoForm({ ...medicoForm, mostrar_honorarios: e.target.checked })}
                        />
                        <span>Mostrar honorarios en reserva</span>
                      </label>
                    </div>
                  </div>
                )}
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

      {/* MODAL COBERTURAS MÉDICAS DEL PROFESIONAL */}
      {coberturasMedico && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content animate-fade-in" style={{ maxWidth: '640px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                  Coberturas Médicas Aceptadas
                </h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: '4px 0 0' }}>
                  Dr. {coberturasMedico.nombre} {coberturasMedico.apellido}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCoberturasMedico(null)}
                style={{ padding: '6px' }}
              >
                <X size={18} />
              </button>
            </div>

            {loadingDoctorCoberturas ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                Cargando coberturas del profesional...
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Filtrar coberturas (OSDE, Swiss, Galeno, Sancor...)"
                      style={{ paddingLeft: '36px', width: '100%' }}
                      value={coberturasSearch}
                      onChange={e => setCoberturasSearch(e.target.value)}
                    />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                    Seleccionadas: <strong>{selectedOSIds.size}</strong> coberturas
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '380px', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px' }}>
                  {coberturasAllObras
                    .filter(os => !coberturasSearch || os.nombre.toLowerCase().includes(coberturasSearch.toLowerCase()))
                    .slice(0, 150)
                    .map(os => {
                      const isChecked = selectedOSIds.has(os.id);
                      return (
                        <label
                          key={os.id}
                          className="flex items-center gap-2"
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            background: isChecked ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            marginBottom: '4px'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const next = new Set(selectedOSIds);
                              if (next.has(os.id)) next.delete(os.id);
                              else next.add(os.id);
                              setSelectedOSIds(next);
                            }}
                          />
                          <span style={{ fontWeight: isChecked ? 600 : 400, color: isChecked ? 'var(--color-primary)' : 'inherit' }}>
                            {os.nombre}
                          </span>
                        </label>
                      );
                    })}
                </div>

                <div className="flex items-center justify-between" style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      if (selectedOSIds.size > 0) setSelectedOSIds(new Set());
                      else setSelectedOSIds(new Set(coberturasAllObras.map(o => o.id)));
                    }}
                  >
                    {selectedOSIds.size > 0 ? 'Deseleccionar todas' : 'Seleccionar todas'}
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setCoberturasMedico(null)}
                      disabled={savingDoctorCoberturas}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSaveDoctorCoberturas}
                      disabled={savingDoctorCoberturas}
                    >
                      {savingDoctorCoberturas ? 'Guardando...' : 'Guardar Coberturas'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL FICHA DEL MÉDICO & HONORARIOS PARTICULARES */}
      {editingFichaMedico && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content animate-fade-in" style={{ maxWidth: '640px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  Ficha Profesional & Honorarios
                </h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: '4px 0 0' }}>
                  Dr. {editingFichaMedico.nombre} {editingFichaMedico.apellido}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingFichaMedico(null)}
                style={{ padding: '6px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveFicha}>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Nombre</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={fichaForm.nombre}
                    onChange={e => setFichaForm({ ...fichaForm, nombre: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Apellido</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={fichaForm.apellido}
                    onChange={e => setFichaForm({ ...fichaForm, apellido: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Matrícula (M.N. / M.P.)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej: 14590"
                    value={fichaForm.matricula}
                    onChange={e => setFichaForm({ ...fichaForm, matricula: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono de Contacto</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="Ej: 2944123456"
                    value={fichaForm.telefono}
                    onChange={e => setFichaForm({ ...fichaForm, telefono: e.target.value })}
                  />
                </div>
              </div>

              {/* SECCIÓN CREDENCIALES ADJUDICADAS POR ADMIN */}
              <div style={{
                padding: '14px',
                background: 'rgba(2, 132, 199, 0.04)',
                borderRadius: '10px',
                border: '1px solid rgba(2, 132, 199, 0.2)',
                marginBottom: '14px'
              }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '8px' }}>
                  Credenciales de Acceso Adjudicadas (Usuario, Email y Contraseña)
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Usuario Simple</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: drperez"
                      value={fichaForm.username || ''}
                      onChange={e => setFichaForm({ ...fichaForm, username: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Correo Electrónico</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="doctor@clinica.com"
                      value={fichaForm.email || ''}
                      onChange={e => setFichaForm({ ...fichaForm, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>DNI (Login alt.)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: 30123456"
                      value={fichaForm.dni || ''}
                      onChange={e => setFichaForm({ ...fichaForm, dni: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Nueva Contraseña</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Vacío = no cambia"
                      value={fichaForm.password || ''}
                      onChange={e => setFichaForm({ ...fichaForm, password: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN ATENCIÓN PARTICULAR Y HONORARIOS */}
              <div style={{
                margin: '18px 0',
                padding: '16px',
                borderRadius: '10px',
                background: 'rgba(37, 99, 235, 0.05)',
                border: '1px solid rgba(37, 99, 235, 0.2)'
              }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Sparkles size={18} /> Configuración de Particular & Honorarios
                </h4>

                <label className="flex items-center gap-2" style={{ cursor: 'pointer', marginBottom: '12px', fontSize: '0.875rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={fichaForm.acepta_particular}
                    onChange={e => setFichaForm({ ...fichaForm, acepta_particular: e.target.checked })}
                  />
                  <span>¿Atiende pacientes particulares (privado)?</span>
                </label>

                {fichaForm.acepta_particular && (
                  <>
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label className="form-label">Valor de los Honorarios de Consulta Particular ($)</label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        className="form-input"
                        placeholder="Ej: 25000 (opcional)"
                        value={fichaForm.honorarios_particular}
                        onChange={e => setFichaForm({ ...fichaForm, honorarios_particular: e.target.value })}
                      />
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        Monto de honorarios para la consulta médica privada.
                      </div>
                    </div>

                    <label className="flex items-center gap-2" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>
                      <input
                        type="checkbox"
                        checked={fichaForm.mostrar_honorarios}
                        onChange={e => setFichaForm({ ...fichaForm, mostrar_honorarios: e.target.checked })}
                      />
                      <span>
                        <strong>¿Desea que aparezca el valor de los honorarios en la reserva?</strong>
                      </span>
                    </label>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginLeft: '22px' }}>
                      Si se activa, el paciente verá: <em>"Particular (Sus honorarios son $XXXX)"</em>. Si se desactiva, solo verá <em>"Particular"</em> sin mostrar el importe.
                    </div>
                  </>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Dirección de Consultorio</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: Mitre 124, Consultorio 3"
                  value={fichaForm.direccion}
                  onChange={e => setFichaForm({ ...fichaForm, direccion: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Biografía / Perfil Profesional</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Breve reseña sobre experiencia o trayectoria..."
                  value={fichaForm.biografia}
                  onChange={e => setFichaForm({ ...fichaForm, biografia: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3" style={{ marginTop: '24px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingFichaMedico(null)}
                  disabled={savingFicha}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingFicha}
                >
                  {savingFicha ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR RESPUESTA DEL BOT */}
      {showBotModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '640px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
              <div className="flex items-center gap-2">
                <MessageSquare size={20} style={{ color: '#128C7E' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  {editingBotId ? 'Editar Mensaje del Bot' : 'Nueva Respuesta / Pregunta del Bot'}
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setShowBotModal(false)}
                style={{ padding: '4px 8px' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveBotRespuesta} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Clave Identificadora <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="ej: faq_estacionamiento"
                    value={botForm.clave}
                    onChange={e => setBotForm({ ...botForm, clave: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    Código único en minúsculas y sin espacios.
                  </span>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Título Descriptivo <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="ej: Información sobre Cocheras"
                    value={botForm.titulo}
                    onChange={e => setBotForm({ ...botForm, titulo: e.target.value })}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    Nombre para identificarlo en el panel.
                  </span>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Palabras o Frases Disparadoras (Opcional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ej: estacionamiento, auto, cochera, parquimetro"
                  value={botForm.disparador}
                  onChange={e => setBotForm({ ...botForm, disparador: e.target.value })}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  Separadas por coma. Si el usuario escribe alguna de estas palabras, el bot responderá este mensaje.
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Descripción o Notas Internas (Opcional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ej: Explicación de dónde dejar el vehículo en la sede centro"
                  value={botForm.descripcion}
                  onChange={e => setBotForm({ ...botForm, descripcion: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Mensaje que Enviará el Bot <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <textarea
                  className="form-textarea"
                  rows={6}
                  required
                  placeholder="Escribí aquí el texto que enviará el bot en WhatsApp... Podés usar saltos de línea y emojis."
                  value={botForm.mensaje}
                  onChange={e => setBotForm({ ...botForm, mensaje: e.target.value })}
                  style={{ fontFamily: 'inherit', fontSize: '0.875rem' }}
                />
                <div className="flex justify-between" style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  <span>Tip: Podés usar *negrita* o _cursiva_ como en WhatsApp.</span>
                  <span>{botForm.mensaje.length} caracteres</span>
                </div>
              </div>

              {/* Vista previa tipo WhatsApp */}
              {botForm.mensaje && (
                <div style={{ marginTop: '8px' }}>
                  <label className="form-label" style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    Vista Previa en WhatsApp:
                  </label>
                  <div style={{
                    background: '#ECE5DD',
                    padding: '14px',
                    borderRadius: '10px',
                    backgroundImage: 'radial-gradient(#d4cbc1 1px, transparent 1px)',
                    backgroundSize: '16px 16px'
                  }}>
                    <div style={{
                      background: '#FFFFFF',
                      borderRadius: '8px 8px 8px 2px',
                      padding: '10px 14px',
                      maxWidth: '85%',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                      fontSize: '0.875rem',
                      lineHeight: '1.45',
                      whiteSpace: 'pre-wrap',
                      color: '#111827'
                    }}>
                      {botForm.mensaje}
                      <div style={{ textAlign: 'right', fontSize: '0.6875rem', color: '#9CA3AF', marginTop: '4px' }}>
                        12:00 ✓✓
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '4px' }}>
                <label className="flex items-center gap-2" style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(botForm.activo)}
                    onChange={e => setBotForm({ ...botForm, activo: e.target.checked ? 1 : 0 })}
                  />
                  <span>Habilitar esta respuesta en el Bot (Activo)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2" style={{ marginTop: '16px', borderTop: '1px solid var(--color-border)', paddingTop: '14px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowBotModal(false)}
                  disabled={botSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={botSaving}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Save size={16} /> {botSaving ? 'Guardando...' : (editingBotId ? 'Actualizar Respuesta' : 'Crear Respuesta')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
