import React, { useState, useEffect } from 'react';
import { api } from '../api';
import SearchableSelect from '../components/SearchableSelect';
import { obtenerAvatarDefault } from '../utils/avatar';
import { 
  Search, 
  Building2, 
  CreditCard, 
  Calendar, 
  MapPin, 
  Award, 
  ArrowRight,
  ShieldCheck,
  Clock,
  Sparkles,
  X
} from 'lucide-react';

export default function HomePage({ onSelectDoctor }) {
  const [especialidades, setEspecialidades] = useState([]);
  const [obrasSociales, setObrasSociales] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [allMedicosList, setAllMedicosList] = useState([]);
  const [medicos, setMedicos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros Select2
  const [selectedMedico, setSelectedMedico] = useState('');
  const [selectedUnidad, setSelectedUnidad] = useState('');
  const [selectedEspecialidad, setSelectedEspecialidad] = useState('');
  const [selectedObraSocial, setSelectedObraSocial] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal de Coberturas
  const [coberturasModalMedico, setCoberturasModalMedico] = useState(null);
  const [coberturasLoading, setCoberturasLoading] = useState(false);
  const [coberturasList, setCoberturasList] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/public/especialidades'),
      api.get('/public/obras-sociales'),
      api.get('/public/unidades'),
      api.get('/public/medicos')
    ]).then(([espRes, obrasRes, sedesRes, medsRes]) => {
      if (espRes.data) setEspecialidades(espRes.data);
      if (obrasRes.data) setObrasSociales(obrasRes.data);
      if (sedesRes.data) setSedes(sedesRes.data);
      if (medsRes.data) {
        setAllMedicosList(medsRes.data);
        setMedicos(medsRes.data);
      }
    }).catch(console.error)
    .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedMedico) params.append('medico_id', selectedMedico);
    if (selectedUnidad) params.append('unidad_id', selectedUnidad);
    if (selectedEspecialidad) params.append('especialidad_id', selectedEspecialidad);
    if (selectedObraSocial) params.append('obra_social_id', selectedObraSocial);
    if (searchTerm) params.append('q', searchTerm);

    api.get(`/public/medicos?${params.toString()}`)
      .then((res) => {
        if (res.data) setMedicos(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedMedico, selectedUnidad, selectedEspecialidad, selectedObraSocial, searchTerm]);

  const handleLimpiarFiltros = () => {
    setSelectedMedico('');
    setSelectedUnidad('');
    setSelectedEspecialidad('');
    setSelectedObraSocial('');
    setSearchTerm('');
  };

  const handleVerCoberturas = async (medico) => {
    setCoberturasModalMedico(medico);
    setCoberturasLoading(true);
    try {
      const res = await api.get(`/public/medicos/${medico.id}`);
      setCoberturasList(res.data?.obras_sociales || []);
    } catch {
      setCoberturasList([]);
    } finally {
      setCoberturasLoading(false);
    }
  };

  const hasActiveFilters = !!(selectedMedico || selectedUnidad || selectedEspecialidad || selectedObraSocial || searchTerm);

  return (
    <div className="animate-fade-in">
      {/* Hero Header */}
      <section className="hero-gradient">
        <div className="container">
          <div style={{ maxWidth: '820px', margin: '0 auto', textAlign: 'center', marginBottom: '32px' }}>
            <div className="badge badge-primary" style={{ marginBottom: '16px', padding: '6px 14px' }}>
              <Sparkles size={14} /> Red Médica San Carlos & OscarSoft
            </div>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 800, lineHeight: 1.15, color: 'var(--color-text-main)', marginBottom: '16px' }}>
              Elige el profesional que necesitas y <span style={{ color: 'var(--color-primary)' }}>agenda tu turno</span>
            </h1>
            <p style={{ fontSize: '1.125rem', color: 'var(--color-text-muted)' }}>
              Agenda tu cita de manera rápida y sencilla por profesional, centro de atención, especialidad o cobertura.
            </p>
          </div>

          {/* Buscador Select2 Moderno con 4 Filtros + Búsqueda por Texto */}
          <div className="glass-panel" style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto', boxShadow: 'var(--shadow-lg)' }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ alignItems: 'flex-end', marginBottom: '16px' }}>
              
              {/* 1. Profesional (Select2) */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label flex items-center gap-2" style={{ fontWeight: 600 }}>
                  <Search size={16} style={{ color: 'var(--color-primary)' }} /> Profesional
                </label>
                <SearchableSelect
                  options={allMedicosList.map(m => ({ id: m.id, label: `Dr. ${m.nombre} ${m.apellido}` }))}
                  value={selectedMedico}
                  onChange={setSelectedMedico}
                  placeholder="Todos los profesionales"
                  searchPlaceholder="Buscar médico..."
                />
              </div>

              {/* 2. Centro o Sede de Atención (Select2) */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label flex items-center gap-2" style={{ fontWeight: 600 }}>
                  <Building2 size={16} style={{ color: 'var(--color-primary)' }} /> Centro / Sede
                </label>
                <SearchableSelect
                  options={sedes.map(s => ({ id: s.id, label: s.nombre }))}
                  value={selectedUnidad}
                  onChange={setSelectedUnidad}
                  placeholder="Todos los centros"
                  searchPlaceholder="Buscar sede o consultorio..."
                />
              </div>

              {/* 3. Especialidad (Select2) */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label flex items-center gap-2" style={{ fontWeight: 600 }}>
                  <Award size={16} style={{ color: 'var(--color-primary)' }} /> Especialidad
                </label>
                <SearchableSelect
                  options={especialidades.map(e => ({ id: e.id, label: `${e.nombre} (${e.total_medicos})` }))}
                  value={selectedEspecialidad}
                  onChange={setSelectedEspecialidad}
                  placeholder="Todas las especialidades"
                  searchPlaceholder="Buscar especialidad..."
                />
              </div>

              {/* 4. Obra Social / Prepaga (Select2 con +2000 opciones completas) */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label flex items-center gap-2" style={{ fontWeight: 600 }}>
                  <CreditCard size={16} style={{ color: 'var(--color-primary)' }} /> Obra Social
                </label>
                <SearchableSelect
                  options={obrasSociales.map(os => ({ id: os.id, label: os.nombre }))}
                  value={selectedObraSocial}
                  onChange={setSelectedObraSocial}
                  placeholder="Todas las coberturas"
                  searchPlaceholder="Buscar OSDE, Swiss, Galeno..."
                />
              </div>

            </div>

            {/* Búsqueda rápida por texto libre */}
            <div className="flex items-center gap-3 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input 
                  type="text" 
                  className="form-input"
                  style={{ paddingLeft: '38px', fontSize: '0.875rem' }}
                  placeholder="O escribe para filtrar por nombre, calle (Mitre, Frey, Gutiérrez...), o especialidad..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {hasActiveFilters && (
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={handleLimpiarFiltros}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <X size={15} /> Limpiar Filtros
                </button>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* Listado de Médicos */}
      <section className="container" style={{ padding: '48px 24px 80px' }}>
        
        {/* Cabecera de resultados */}
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              Profesionales Disponibles
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              {loading ? 'Buscando especialistas...' : `Se encontraron ${medicos.length} profesionales`}
            </p>
          </div>

          {hasActiveFilters && (
            <button 
              className="btn btn-secondary btn-sm"
              onClick={handleLimpiarFiltros}
            >
              Limpiar Filtros
            </button>
          )}
        </div>

        {/* Grid de Médicos */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>Buscando profesionales...</div>
          </div>
        ) : medicos.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <Building2 size={48} style={{ color: 'var(--color-text-subtle)', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>No se encontraron profesionales</h3>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '20px' }}>
              Intenta cambiar los filtros de especialidad o la búsqueda por texto.
            </p>
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => { setSelectedEspecialidad(''); setSelectedObraSocial(''); setSearchTerm(''); }}
            >
              Ver todos los médicos
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-6">
            {medicos.map((med) => {
              const avatarSrc = med.foto_perfil || obtenerAvatarDefault(med.nombre, med.apellido);
              return (
                <div key={med.id} className="card flex flex-col justify-between" style={{ padding: '0', overflow: 'hidden' }}>
                  
                  {/* Encabezado con Foto Circular Real */}
                  <div style={{
                    padding: '28px 16px 12px',
                    textAlign: 'center',
                    background: 'radial-gradient(circle at center, rgba(14, 165, 233, 0.08) 0%, transparent 70%)'
                  }}>
                    <img 
                      src={avatarSrc} 
                      alt={`Dr. ${med.nombre} ${med.apellido}`} 
                      style={{
                        width: '110px',
                        height: '110px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '4px solid white',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                        margin: '0 auto 12px'
                      }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/turnos/assets/img/avatar_doctor.jpg';
                      }}
                    />
                    <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--color-text-main)', lineHeight: 1.25, marginBottom: '4px' }}>
                      Dr. {med.nombre} {med.apellido}
                    </h3>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                      {med.especialidades.map(e => e.nombre).join(', ') || 'Medicina General'}
                    </div>
                  </div>

                  {/* Cuerpo de la tarjeta */}
                  <div style={{ padding: '0 20px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    
                    {/* Botón Ver Coberturas */}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{
                        width: '100%',
                        marginBottom: '12px',
                        fontSize: '0.75rem',
                        color: 'var(--color-primary)',
                        borderColor: 'var(--color-primary-light)',
                        background: 'var(--color-primary-light)'
                      }}
                      onClick={() => handleVerCoberturas(med)}
                    >
                      <ShieldCheck size={14} /> Ver Obras Sociales Aceptadas
                    </button>

                    {/* Sedes de Atención */}
                    {med.sedes && med.sedes.length > 0 && (
                      <div className="flex items-center gap-1" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
                        <MapPin size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {med.sedes.map(s => s.nombre).join(', ')}
                        </span>
                      </div>
                    )}

                    {/* Botón Agendar */}
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => onSelectDoctor(med)}
                      style={{ width: '100%', marginTop: 'auto', fontWeight: 700 }}
                    >
                      <Calendar size={15} /> Agendar Turno
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </section>

      {/* Modal de Coberturas Médicas Aceptadas */}
      {coberturasModalMedico && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '520px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                Coberturas de Dr. {coberturasModalMedico.nombre} {coberturasModalMedico.apellido}
              </h3>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setCoberturasModalMedico(null)}
                style={{ padding: '6px', borderRadius: '50%' }}
              >
                <X size={16} />
              </button>
            </div>

            {coberturasLoading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                Cargando obras sociales aceptadas...
              </div>
            ) : coberturasList.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                El profesional atiende de manera particular o sus convenios están en actualización.
              </div>
            ) : (
              <div style={{ maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
                <div className="flex flex-col gap-2">
                  {coberturasList.map((os) => (
                    <div key={os.id} style={{ padding: '10px 14px', background: 'var(--color-bg)', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 500 }}>
                      <ShieldCheck size={14} style={{ color: 'var(--color-success)', marginRight: '8px', verticalAlign: 'middle' }} />
                      {os.nombre}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end" style={{ marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setCoberturasModalMedico(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
