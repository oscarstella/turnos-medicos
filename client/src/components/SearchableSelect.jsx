import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Selecciona una opción...',
  searchPlaceholder = 'Buscar...',
  allowClear = true,
  disabled = false,
  className = '',
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Autofocus en el input de búsqueda al abrir
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Filtrado de opciones
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase().trim();
    return options.filter((opt) => {
      const label = String(opt.label || opt.nombre || '').toLowerCase();
      return label.includes(term);
    });
  }, [options, searchTerm]);

  // Opción actualmente seleccionada
  const selectedOption = useMemo(() => {
    return options.find((opt) => String(opt.value ?? opt.id) === String(value));
  }, [options, value]);

  const handleSelect = (opt) => {
    const val = opt.value ?? opt.id;
    onChange(val);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div
      ref={containerRef}
      className={`select2-container ${className}`}
      style={{ position: 'relative', width: '100%', userSelect: 'none', ...style }}
    >
      {/* Botón Principal (Input Trigger) */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'var(--color-surface)',
          border: `1px solid ${isOpen ? 'var(--color-primary)' : 'var(--color-border)'}`,
          boxShadow: isOpen ? '0 0 0 3px rgba(2, 132, 199, 0.15)' : 'var(--shadow-sm)',
          borderRadius: 'var(--radius-md)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.15s ease'
        }}
      >
        <span
          style={{
            color: selectedOption ? 'var(--color-text-main)' : 'var(--color-text-muted)',
            fontSize: '0.9375rem',
            fontWeight: selectedOption ? 600 : 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginRight: '8px'
          }}
        >
          {selectedOption ? (selectedOption.label || selectedOption.nombre) : placeholder}
        </span>

        <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
          {allowClear && selectedOption && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: '2px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Borrar selección"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={16}
            style={{
              color: 'var(--color-text-muted)',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }}
          />
        </div>
      </div>

      {/* Menú Desplegable con Buscador (Select2 Dropdown) */}
      {isOpen && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1050,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-xl)',
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          {/* Campo de búsqueda interno Select2 */}
          <div style={{ padding: '8px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search
                size={15}
                style={{ position: 'absolute', left: '10px', color: 'var(--color-text-muted)' }}
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 32px',
                  fontSize: '0.875rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  outline: 'none',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-main)'
                }}
              />
            </div>
          </div>

          {/* Lista de Resultados con Scroll */}
          <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '4px' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                No se encontraron resultados
              </div>
            ) : (
              filteredOptions.slice(0, 150).map((opt) => {
                const optVal = opt.value ?? opt.id;
                const isSelected = String(optVal) === String(value);
                const optLabel = opt.label || opt.nombre;

                return (
                  <div
                    key={optVal}
                    onClick={() => handleSelect(opt)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isSelected ? 'var(--color-primary-light)' : 'transparent',
                      color: isSelected ? 'var(--color-primary-dark)' : 'var(--color-text-main)',
                      fontWeight: isSelected ? 600 : 400,
                      transition: 'background 0.1s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--color-surface-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span>{optLabel}</span>
                    {isSelected && <Check size={14} style={{ color: 'var(--color-primary)' }} />}
                  </div>
                );
              })
            )}
            {filteredOptions.length > 150 && (
              <div style={{ padding: '8px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-subtle)', borderTop: '1px solid var(--color-border)' }}>
                Mostrando los primeros 150 resultados. Escribe para afinar la búsqueda.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
