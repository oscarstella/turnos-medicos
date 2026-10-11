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

function resolverCoordenadasSede(nombre, calle, numero, lat, lng) {
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
  return { lat: -41.1336564, lng: -71.3078764 };
}

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

  // Modal de Mapa de Sede & Cómo llegar
  const [mapaSedeModal, setMapaSedeModal] = useState({ visible: false, nombre: '', direccion: '', lat: null, lng: null });

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

  const handleVerCoberturas = (medico) => {
    setCoberturasModalMedico(medico);
    if (medico.obras_sociales && medico.obras_sociales.length > 0) {
      setCoberturasList(medico.obras_sociales);
      setCoberturasLoading(false);
    } else {
      setCoberturasLoading(true);
      api.get(`/public/medicos/${medico.id}`)
        .then(res => setCoberturasList(res.data?.obras_sociales || []))
        .catch(() => setCoberturasList([]))
        .finally(() => setCoberturasLoading(false));
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
                    
                    {/* Botón Ver Coberturas con contador */}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{
                        width: '100%',
                        marginBottom: '10px',
                        fontSize: '0.75rem',
                        color: 'var(--color-primary)',
                        borderColor: 'var(--color-primary-light)',
                        background: 'var(--color-primary-light)',
                        fontWeight: 600
                      }}
                      onClick={() => handleVerCoberturas(med)}
                    >
                      <ShieldCheck size={14} /> Ver Coberturas {med.obras_sociales ? `(${med.obras_sociales.length})` : ''}
                    </button>

                    {/* Horarios de Atención Semanales (Lunes a Viernes) */}
                    {med.horarios && med.horarios.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '10px', background: 'var(--color-bg)', padding: '6px 10px', borderRadius: '8px' }}>
                        <div className="flex items-center gap-1 font-semibold" style={{ color: 'var(--color-text-main)' }}>
                          <Clock size={12} style={{ color: 'var(--color-primary)' }} />
                          <span>Atención: {med.horarios[0].hora_inicio ? med.horarios[0].hora_inicio.substring(0, 5) : '09:00'} a {med.horarios[0].hora_fin ? med.horarios[0].hora_fin.substring(0, 5) : '13:00'} hs</span>
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)', marginTop: '2px' }}>
                          Lunes a Viernes
                        </div>
                      </div>
                    )}

                    {/* Sedes de Atención con botón clickeable para abrir mapa */}
                    {med.sedes && med.sedes.length > 0 && (
                      <div className="flex flex-wrap gap-1" style={{ marginBottom: '14px' }}>
                        {med.sedes.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            className="btn btn-secondary btn-xs"
                            style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: '12px' }}
                            onClick={() => setMapaSedeModal({ visible: true, nombre: s.nombre, direccion: s.direccion || s.nombre, lat: s.latitud, lng: s.longitud })}
                            title="Ver en Google Maps y Cómo llegar"
                          >
                            <MapPin size={11} style={{ color: 'var(--color-danger)' }} /> {s.nombre}
                          </button>
                        ))}
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

      {/* Modal Ver Mapa de Sede & Cómo llegar */}
      {mapaSedeModal.visible && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '640px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
              <div className="flex items-center gap-2">
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={20} style={{ color: 'var(--color-danger)' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0 }}>
                    {mapaSedeModal.nombre}
                  </h3>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    {mapaSedeModal.direccion}
                  </div>
                </div>
              </div>
              <button className="btn btn-secondary btn-xs" onClick={() => setMapaSedeModal({ visible: false, nombre: '', direccion: '', lat: null, lng: null })}>
                <X size={16} />
              </button>
            </div>

            {/* Iframe Google Maps */}
            <div style={{ height: '340px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--color-border)', marginBottom: '16px' }}>
              <iframe
                title="Mapa de Sede"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://maps.google.com/maps?q=${resolverCoordenadasSede(mapaSedeModal.nombre, mapaSedeModal.direccion, '', mapaSedeModal.lat, mapaSedeModal.lng).lat},${resolverCoordenadasSede(mapaSedeModal.nombre, mapaSedeModal.direccion, '', mapaSedeModal.lat, mapaSedeModal.lng).lng}&hl=es&z=17&output=embed`}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Ubicación exacta en San Carlos de Bariloche.
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setMapaSedeModal({ visible: false, nombre: '', direccion: '', lat: null, lng: null })}
                >
                  Cerrar
                </button>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${resolverCoordenadasSede(mapaSedeModal.nombre, mapaSedeModal.direccion, '', mapaSedeModal.lat, mapaSedeModal.lng).lat},${resolverCoordenadasSede(mapaSedeModal.nombre, mapaSedeModal.direccion, '', mapaSedeModal.lat, mapaSedeModal.lng).lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                >
                  <MapPin size={14} /> Cómo llegar
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
