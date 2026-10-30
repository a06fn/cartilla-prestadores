import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { norm } from '../utils/prestadores';

const LIMITE_MARCADORES = 1000;

// Color por clasificación del prestador (columna "Clasificacion prestador").
// Las seccionales usan otro color (negro) para distinguirse de los prestadores.
const CLASIFICACIONES = {
  'clinicas y sanatorios': { color: '#dc2626', etiqueta: 'Clínicas y Sanatorios' },
  'centros medicos': { color: '#facc15', etiqueta: 'Centros Médicos' },
  especialistas: { color: '#f97316', etiqueta: 'Especialistas' },
  'salud mental': { color: '#8b5cf6', etiqueta: 'Salud Mental' },
  rehabilitacion: { color: '#16a34a', etiqueta: 'Rehabilitación' },
  pediatria: { color: '#38bdf8', etiqueta: 'Pediatría' },
  'asociacion/circulo': { color: '#92400e', etiqueta: 'Asociaciones/Círculos' },
  odontologia: { color: '#64748b', etiqueta: 'Odontología' },
  varios: { color: '#94a3b8', etiqueta: 'Varios' },
};

const COLOR_SIN_CLASIFICAR = '#cbd5e1';
const COLOR_SECCIONAL = '#111827';
const COLOR_USUARIO = '#2563eb';

function colorPrestador(clasificacion) {
  const info = CLASIFICACIONES[norm(clasificacion)];
  return info ? info.color : COLOR_SIN_CLASIFICAR;
}

function etiquetaPrestador(clasificacion) {
  const info = CLASIFICACIONES[norm(clasificacion)];
  return info ? info.etiqueta : 'Sin clasificar';
}

function escapar(texto) {
  return String(texto ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// Puntos que cubre un radio (para que el zoom incluya el círculo completo).
function esquinasDelRadio(centro, radioKm) {
  const dLat = radioKm / 111;
  const dLon = radioKm / (111 * Math.max(0.2, Math.cos((centro.lat * Math.PI) / 180)));
  return [
    [centro.lat + dLat, centro.lon + dLon],
    [centro.lat + dLat, centro.lon - dLon],
    [centro.lat - dLat, centro.lon + dLon],
    [centro.lat - dLat, centro.lon - dLon],
  ];
}

export default function MapaPrestadores({ prestadores, centros, radioKm, onClose }) {
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
    const centrosValidos = (centros || []).filter(
      (c) => Number.isFinite(c.lat) && Number.isFinite(c.lon)
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(mapa);

    // 1) Área de cobertura. Va primero por dos motivos:
    //    queda dibujada debajo de los marcadores y, con interactive:false,
    //    no se queda con los clics (antes tapaba todos los puntos).
    if (radioKm && centrosValidos.length) {
      centrosValidos.forEach((centro) => {
        L.circle([centro.lat, centro.lon], {
          radius: radioKm * 1000,
          color: '#ef4444',
          weight: 1,
          fillColor: '#ef4444',
          fillOpacity: 0.05,
          interactive: false,
        }).addTo(mapa);
      });
    }

    const puntos = [];

    // 2) Prestadores, con el color de su clasificación.
    prestadores.slice(0, LIMITE_MARCADORES).forEach((p) => {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return;

      puntos.push([p.lat, p.lon]);

      const prestaciones = [...p.prestaciones, ...p.guardias].join(', ');
      const distancia =
        Number.isFinite(p.distancia) ? `<div>A ${p.distancia.toFixed(1)} km de la referencia</div>` : '';
      const color = colorPrestador(p.clasificacion);

      L.circleMarker([p.lat, p.lon], {
        radius: 6.5,
        color: '#ffffff',
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.95,
      })
        .bindPopup(
          `<div class="mapa-popup">
             <strong>${escapar(p.nombre)}</strong>
             <div>
               <span class="mapa-popup-color" style="background:${color}"></span>
               ${escapar(etiquetaPrestador(p.clasificacion))}
             </div>
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

    // 3) Seccionales / ubicación del usuario, por encima de todo y en otro color.
    centrosValidos.forEach((centro) => {
      const color = centro.esUsuario ? COLOR_USUARIO : COLOR_SECCIONAL;
      L.circleMarker([centro.lat, centro.lon], {
        radius: 9,
        color: '#ffffff',
        weight: 3,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindPopup(
          `<div class="mapa-popup">
             <strong>${escapar(centro.titulo)}</strong>
             ${centro.detalle ? `<div>${escapar(centro.detalle)}</div>` : ''}
             ${centro.telefono ? `<div>Tel: ${escapar(centro.telefono)}</div>` : ''}
           </div>`
        )
        .addTo(mapa);
    });

    // 4) Leyenda de colores.
    const presentes = new Set(prestadores.map((p) => norm(p.clasificacion)));
    const leyenda = L.control({ position: 'bottomleft' });
    leyenda.onAdd = () => {
      const div = L.DomUtil.create('div', 'mapa-leyenda');
      const items = [];
      Object.entries(CLASIFICACIONES).forEach(([clave, info]) => {
        if (!presentes.has(clave)) return;
        items.push(
          `<div class="mapa-leyenda-item">
             <span class="mapa-leyenda-color" style="background:${info.color}"></span>
             ${escapar(info.etiqueta)}
           </div>`
        );
      });
      if (presentes.has('')) {
        items.push(
          `<div class="mapa-leyenda-item">
             <span class="mapa-leyenda-color" style="background:${COLOR_SIN_CLASIFICAR}"></span>
             Sin clasificar
           </div>`
        );
      }
      if (centrosValidos.length) {
        items.push(
          `<div class="mapa-leyenda-item mapa-leyenda-sep">
             <span class="mapa-leyenda-color" style="background:${COLOR_SECCIONAL}"></span>
             Sede de seccional
           </div>`
        );
      }
      if (centrosValidos.some((c) => c.esUsuario)) {
        items.push(
          `<div class="mapa-leyenda-item">
             <span class="mapa-leyenda-color" style="background:${COLOR_USUARIO}"></span>
             Tu ubicación
           </div>`
        );
      }
      div.innerHTML = items.join('');
      return div;
    };
    leyenda.addTo(mapa);

    const limites = [...puntos, ...centrosValidos.map((c) => [c.lat, c.lon])];
    if (radioKm) {
      centrosValidos.forEach((c) => limites.push(...esquinasDelRadio(c, radioKm)));
    }

    if (limites.length > 0) {
      mapa.fitBounds(L.latLngBounds(limites).pad(0.1), { maxZoom: 14 });
    } else {
      mapa.setView([-38.4, -63.6], 4);
    }

    // El modal recién se muestra: hay que recalcular el tamaño del contenedor.
    setTimeout(() => mapa.invalidateSize(), 60);

    return () => mapa.remove();
  }, [prestadores, centros, radioKm]);

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
