import React from 'react';
import { HeartPulse, MapPin, Phone, Mail, Clock } from 'lucide-react';

export default function Footer() {
  return (
    <footer style={{ marginTop: 'auto', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '48px 0 24px' }}>
      <div className="container">
        <div className="grid grid-cols-4 gap-8" style={{ marginBottom: '40px' }}>
          
          {/* Brand Info */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div style={{
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
                padding: '8px',
                borderRadius: '10px',
                color: 'white'
              }}>
                <HeartPulse size={20} />
              </div>
              <span style={{ fontWeight: 800, fontSize: '1.2rem' }}>
                OscarSoft <span style={{ color: 'var(--color-primary)' }}>Turnos</span>
              </span>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Plataforma tecnológica de gestión clínica, turnos médicos y coberturas en tiempo real.
            </p>
          </div>

          {/* Sedes */}
          <div className="flex flex-col gap-2">
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '4px' }}>Sedes de Atención</h4>
            <div className="flex items-center gap-2" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              <MapPin size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              <span>Sede Central: Pasaje Gutiérrez 980</span>
            </div>
            <div className="flex items-center gap-2" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              <MapPin size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              <span>Consultorios Mitre: Mitre 124</span>
            </div>
            <div className="flex items-center gap-2" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              <MapPin size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              <span>Centro Frey: Frey 111</span>
            </div>
          </div>

          {/* Horarios */}
          <div className="flex flex-col gap-2">
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '4px' }}>Horario de Atención</h4>
            <div className="flex items-center gap-2" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              <Clock size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              <span>Lunes a Viernes: 08:00 a 20:00</span>
            </div>
          </div>

          {/* Contacto */}
          <div className="flex flex-col gap-2">
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '4px' }}>Contacto & Soporte</h4>
            <div className="flex items-center gap-2" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              <Phone size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              <span>+54 (294) 442-0000</span>
            </div>
            <div className="flex items-center gap-2" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              <Mail size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              <span>contacto@oscarsoft.com.ar</span>
            </div>
          </div>

        </div>

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--color-text-subtle)' }}>
          © {new Date().getFullYear()} OscarSoft Solutions. Todos los derechos reservados. San Carlos de Bariloche, Río Negro, Argentina.
        </div>
      </div>
    </footer>
  );
}
