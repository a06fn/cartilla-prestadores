import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const LIMITE_MARCADORES = 1000;

function escapar(texto) {
  return String(texto ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

export default function MapaPrestadores({ prestadores, centro, radioKm, onClose }) {
  const contenedorRef = useRef(null);

  // Cerrar con Escape
  useEffect(() => {
    const alPresionar = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, [onClose]);

  useEffect(() => {
    const mapa = L.map(contenedorRef.current, { preferCanvas: true });
    const puntos = [];

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(mapa);

    prestadores.slice(0, LIMITE_MARCADORES).forEach((p) => {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return;

      puntos.push([p.lat, p.lon]);

      const prestaciones = [...p.prestaciones, ...p.guardias].join(', ');
      const distancia =
        Number.isFinite(p.distancia) ? `<div>A ${p.distancia.toFixed(1)} km de tu ubicación</div>` : '';

      L.circleMarker([p.lat, p.lon], {
        radius: 6,
        color: '#1d4ed8',
        weight: 1,
        fillColor: '#3b82f6',
        fillOpacity: 0.85,
      })
        .bindPopup(
          `<div class="mapa-popup">
             <strong>${escapar(p.nombre)}</strong>
             <div>${escapar(p.domicilio || 'Sin dirección')}</div>
             <div>${escapar([p.localidad, p.partido].filter(Boolean).join(', '))}</div>
             <div>Tel: ${escapar(p.telefono || 'Sin teléfono')}</div>
             <div>Planes: ${escapar(p.planes.join(', ') || '-')}</div>
             <div>${escapar(prestaciones || '-')}</div>
             ${distancia}
           </div>`
        )
        .addTo(mapa);
    });

    if (centro) {
      L.circleMarker([centro.lat, centro.lon], {
        radius: 8,
        color: '#7f1d1d',
        weight: 2,
        fillColor: '#ef4444',
        fillOpacity: 1,
      })
        .bindPopup('Tu ubicación')
        .addTo(mapa);

      if (radioKm) {
        L.circle([centro.lat, centro.lon], {
          radius: radioKm * 1000,
          color: '#ef4444',
          weight: 1,
          fillColor: '#ef4444',
          fillOpacity: 0.05,
        }).addTo(mapa);
      }
    }

    if (puntos.length > 0) {
      mapa.fitBounds(L.latLngBounds(puntos).pad(0.15), { maxZoom: 14 });
    } else if (centro) {
      mapa.setView([centro.lat, centro.lon], 11);
    } else {
      mapa.setView([-38.4, -63.6], 4);
    }

    // El modal recién se muestra: hay que recalcular el tamaño del contenedor.
    setTimeout(() => mapa.invalidateSize(), 60);

    return () => mapa.remove();
  }, [prestadores, centro, radioKm]);

  const sinCoords = prestadores.filter(
    (p) => !Number.isFinite(p.lat) || !Number.isFinite(p.lon)
  ).length;
  const geolocalizados = prestadores.length - sinCoords;
  const mostrados = Math.min(geolocalizados, LIMITE_MARCADORES);

  return (
    <div className="cartilla-mapa-overlay" onClick={onClose}>
      <div className="cartilla-mapa-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cartilla-mapa-header">
          <div>
            <h2>Prestadores en el mapa</h2>
            <span>
              {mostrados} de {geolocalizados} geolocalizados
              {sinCoords ? ` · ${sinCoords} sin coordenadas` : ''}
            </span>
          </div>
          <button className="cartilla-mapa-cerrar" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="cartilla-mapa" ref={contenedorRef} />
      </div>
    </div>
  );
}
