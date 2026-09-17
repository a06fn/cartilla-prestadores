import React, { useState, useMemo } from 'react';
import './App.css';
import { planes } from './data/planes';
import { geografia } from './data/geografia';
import { seccionales } from './data/seccionales';
import { etiquetas } from './data/etiquetas';
import { detectarMiUbicacion } from './utils/geolocalizacion';

const CartillaApp = () => {
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedPlanDescripcion, setSelectedPlanDescripcion] = useState('');
  const [planOpen, setPlanOpen] = useState(false);
  const [selectedProvincia, setSelectedProvincia] = useState('');
  const [selectedPartido, setSelectedPartido] = useState('');
  const [selectedLocalidad, setSelectedLocalidad] = useState('');
  const [selectedPrestacion, setSelectedPrestacion] = useState('');
  const [selectedDetalle, setSelectedDetalle] = useState('');

  const [provinciaSearch, setProvinciaSearch] = useState('');
  const [partidoSearch, setPartidoSearch] = useState('');
  const [localidadSearch, setLocalidadSearch] = useState('');

  const [provinciaOpen, setProvinciaOpen] = useState(false);
  const [partidoOpen, setPartidoOpen] = useState(false);
  const [localidadOpen, setLocalidadOpen] = useState(false);
  const [prestacionOpen, setPrestacionOpen] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);

  const [partidosDisponibles, setPartidosDisponibles] = useState([]);
  const [localidadesDisponibles, setLocalidadesDisponibles] = useState([]);

  // Estado de la geolocalización
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);
  const [avisoUbicacion, setAvisoUbicacion] = useState(null); // { tipo, texto }

  // Búsqueda de seccional con normalización y cascada
  const norm = (txt) =>
    (txt || '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  // Paso 1: obtener el código de seccional desde geografia
  const codigoSeccional = useMemo(() => {
    if (!selectedProvincia || !selectedPartido || !selectedLocalidad) return '';

    const fila = geografia.find((g) =>
      norm(g.provincia) === norm(selectedProvincia) &&
      norm(g.partido) === norm(selectedPartido) &&
      norm(g.localidad) === norm(selectedLocalidad)
    );

    return fila ? fila.seccional : '';
  }, [selectedProvincia, selectedPartido, selectedLocalidad]);

  // Paso 2: buscar en seccionales por el campo SECCIONAL
  const seccionalEncontrada = useMemo(() => {
    if (!codigoSeccional) return null;
    const lista = Array.isArray(seccionales) ? seccionales : [];
    return lista.find((item) => norm(item.SECCIONAL) === norm(codigoSeccional)) || null;
  }, [codigoSeccional]);

  const ubicacionCompleta = Boolean(selectedProvincia && selectedPartido && selectedLocalidad);

  // Obtener provincias únicas
  const provincias = [...new Set(geografia.map(g => g.provincia))].sort();
  const filteredProvincia = provincias.filter(p =>
    p.toLowerCase().includes(provinciaSearch.toLowerCase())
  );

  /* ---------------- Helpers de cascada reutilizables ---------------- */

  const calcularPartidos = (prov) =>
    [...new Set(
      geografia
        .filter(g => g.provincia === prov)
        .map(g => g.partido)
    )].sort();

  const calcularLocalidades = (prov, part) =>
    [...new Set(
      geografia
        .filter(g => g.provincia === prov && g.partido === part)
        .map(g => g.localidad)
    )].sort();

  // Obtener partidos cuando selecciona provincia
  const handleProvinciaSelect = (prov) => {
    setSelectedProvincia(prov);
    setProvinciaOpen(false);
    setProvinciaSearch('');
    setSelectedPartido('');
    setSelectedLocalidad('');
    setPartidosDisponibles(calcularPartidos(prov));
    setLocalidadesDisponibles([]);
    setAvisoUbicacion(null);
  };

  const filteredPartido = partidosDisponibles.filter(p =>
    p.toLowerCase().includes(partidoSearch.toLowerCase())
  );

  // Obtener localidades cuando selecciona partido
  const handlePartidoSelect = (part) => {
    setSelectedPartido(part);
    setPartidoOpen(false);
    setPartidoSearch('');
    setSelectedLocalidad('');
    setAvisoUbicacion(null);
    setLocalidadesDisponibles(calcularLocalidades(selectedProvincia, part));
  };

  const filteredLocalidad = localidadesDisponibles.filter(l =>
    l.toLowerCase().includes(localidadSearch.toLowerCase())
  );

  /* ---------------- Botón MI UBICACIÓN ---------------- */

  const handleMiUbicacion = async () => {
    setBuscandoUbicacion(true);
    setAvisoUbicacion(null);

    try {
      const r = await detectarMiUbicacion(geografia);

      if (!r.exito) {
        setAvisoUbicacion({ tipo: 'error', texto: r.motivo });
        return;
      }

      // Cerrar cualquier desplegable abierto y limpiar los textos de búsqueda
      setProvinciaOpen(false);
      setPartidoOpen(false);
      setLocalidadOpen(false);
      setProvinciaSearch('');
      setPartidoSearch('');
      setLocalidadSearch('');

      // Setear la cascada completa, incluyendo las listas disponibles
      // para que los desplegables queden usables al ajustar manualmente.
      setSelectedProvincia(r.provincia);
      setPartidosDisponibles(calcularPartidos(r.provincia));

      if (r.partido) {
        setSelectedPartido(r.partido);
        setLocalidadesDisponibles(calcularLocalidades(r.provincia, r.partido));
      } else {
        setSelectedPartido('');
        setLocalidadesDisponibles([]);
      }

      setSelectedLocalidad(r.localidad || '');

      // Mensajes según qué tan lejos llegó la detección
      if (r.localidad) {
        setAvisoUbicacion({
          tipo: 'ok',
          texto: `Ubicación detectada: ${r.localidad}, ${r.partido} (${r.provincia}).`,
        });
      } else if (r.partido) {
        setAvisoUbicacion({
          tipo: 'aviso',
          texto: `Detectamos ${r.partido}, ${r.provincia}. Elegí tu localidad para ver la seccional.`,
        });
      } else {
        setAvisoUbicacion({
          tipo: 'aviso',
          texto: `Detectamos ${r.provincia}. Completá partido y localidad para ver la seccional.`,
        });
      }
    } catch (error) {
      setAvisoUbicacion({ tipo: 'error', texto: error.message });
    } finally {
      setBuscandoUbicacion(false);
    }
  };

  const estilosAviso = {
    ok: { background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46' },
    aviso: { background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' },
    error: { background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' },
  };

  const filteredPrestaciones = etiquetas.PRESTACION || [];
  const filteredDetalles = selectedPrestacion ? etiquetas[selectedPrestacion] || [] : [];

  const handleClearFilters = () => {
    setSelectedPlan('');
    setSelectedPlanDescripcion('');
    setPlanOpen(false);
    setSelectedProvincia('');
    setSelectedPartido('');
    setSelectedLocalidad('');
    setSelectedPrestacion('');
    setSelectedDetalle('');
    setPartidosDisponibles([]);
    setLocalidadesDisponibles([]);
    setProvinciaSearch('');
    setPartidoSearch('');
    setLocalidadSearch('');
    setAvisoUbicacion(null);
  };

  return (
    <div className="cartilla-container">
      <div className="cartilla-content">
        {/* Header */}
        <div className="cartilla-header">
          <h1>Cartilla de Prestadores</h1>
          <p>Encuentra los mejores prestadores de salud en tu zona</p>
        </div>

        {/* Fila 1: Plan */}
        <div className="cartilla-row">
          <label className="cartilla-label">Plan</label>
          <div className="cartilla-dropdown">
            <div className="cartilla-input-wrapper">
              <button
                onClick={() => setPlanOpen(!planOpen)}
                className="cartilla-dropdown-button"
              >
                {selectedPlan || 'Seleccionar Plan'}
              </button>
              {selectedPlan && (
                <div className="cartilla-selected">✓ {selectedPlanDescripcion}</div>
              )}
              {planOpen && (
                <div className="cartilla-dropdown-menu">
                  {planes.map((plan) => (
                    <button
                      key={plan.nombre}
                      onClick={() => {
                        setSelectedPlan(plan.nombre);
                        setSelectedPlanDescripcion(plan.descripcion);
                        setPlanOpen(false);
                      }}
                      className="cartilla-dropdown-item"
                    >
                      {plan.nombre} - {plan.descripcion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fila 2: Geolocalización y Ubicación */}
        <div className="cartilla-row">
          <button
            onClick={handleMiUbicacion}
            disabled={buscandoUbicacion}
            className="cartilla-button-primary"
            style={buscandoUbicacion ? { opacity: 0.7, cursor: 'wait' } : undefined}
          >
            {buscandoUbicacion ? '⏳ Buscando ubicación...' : '📍 Mi Ubicación'}
          </button>

          {avisoUbicacion && !selectedLocalidad && (
            <div
              style={{
                marginTop: '10px',
                marginBottom: '4px',
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '14px',
                ...estilosAviso[avisoUbicacion.tipo],
              }}
            >
              {avisoUbicacion.texto}
            </div>
          )}

          <div className="cartilla-grid-3">
            {/* Provincia */}
            <div className="cartilla-dropdown">
              <label className="cartilla-label">Provincia</label>
              <div className="cartilla-input-wrapper">
                <input
                  type="text"
                  placeholder="Buscar provincia..."
                  value={provinciaSearch}
                  onChange={(e) => setProvinciaSearch(e.target.value)}
                  onFocus={() => setProvinciaOpen(true)}
                  className="cartilla-input"
                />
                {selectedProvincia && (
                  <div className="cartilla-selected">✓ {selectedProvincia}</div>
                )}
                {provinciaOpen && (
                  <div className="cartilla-dropdown-menu">
                    {filteredProvincia.map((prov) => (
                      <button
                        key={prov}
                        onClick={() => handleProvinciaSelect(prov)}
                        className="cartilla-dropdown-item"
                      >
                        {prov}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Partido */}
            <div className="cartilla-dropdown">
              <label className="cartilla-label">Partido</label>
              <div className="cartilla-input-wrapper">
                <input
                  type="text"
                  placeholder="Seleccionar partido..."
                  value={partidoSearch}
                  onChange={(e) => setPartidoSearch(e.target.value)}
                  onFocus={() => selectedProvincia && setPartidoOpen(true)}
                  disabled={!selectedProvincia}
                  className="cartilla-input"
                />
                {selectedPartido && (
                  <div className="cartilla-selected">✓ {selectedPartido}</div>
                )}
                {partidoOpen && selectedProvincia && (
                  <div className="cartilla-dropdown-menu">
                    {filteredPartido.map((part) => (
                      <button
                        key={part}
                        onClick={() => handlePartidoSelect(part)}
                        className="cartilla-dropdown-item"
                      >
                        {part}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Localidad */}
            <div className="cartilla-dropdown">
              <label className="cartilla-label">Localidad</label>
              <div className="cartilla-input-wrapper">
                <input
                  type="text"
                  placeholder="Seleccionar localidad..."
                  value={localidadSearch}
                  onChange={(e) => setLocalidadSearch(e.target.value)}
                  onFocus={() => selectedPartido && setLocalidadOpen(true)}
                  disabled={!selectedPartido}
                  className="cartilla-input"
                />
                {selectedLocalidad && (
                  <div className="cartilla-selected">✓ {selectedLocalidad}</div>
                )}
                {localidadOpen && selectedPartido && (
                  <div className="cartilla-dropdown-menu">
                    {filteredLocalidad.map((loc) => (
                      <button
                        key={loc}
                        onClick={() => {
                          setSelectedLocalidad(loc);
                          setLocalidadOpen(false);
                          setLocalidadSearch('');
                          setAvisoUbicacion(null);
                        }}
                        className="cartilla-dropdown-item"
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tarjeta de Seccional - Dentro de Fila 2 */}
          {ubicacionCompleta && (
            <div
              className="cartilla-seccional-card"
              style={{
                marginTop: '16px',
                padding: '16px',
                border: '1px solid #dbeafe',
                borderRadius: '8px',
                background: '#f8fbff'
              }}
            >
              {seccionalEncontrada ? (
                <>
                  <h3 className="cartilla-seccional-title" style={{ margin: '0 0 12px' }}>
                    ✓ {seccionalEncontrada['NOMBRE SECCIONAL'] || 'Seccional encontrada'}
                  </h3>
                  <div
                    className="cartilla-seccional-grid"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <p>Su Seccional es:</p>
                      <span className="cartilla-seccional-label">Nombre Seccional</span>
                      <p className="cartilla-seccional-value">
                        {seccionalEncontrada['NOMBRE SECCIONAL'] || '-'}
                      </p>
                    </div>
                    <div>
                      <span className="cartilla-seccional-label">Localidad</span>
                      <p className="cartilla-seccional-value">{seccionalEncontrada.LOCALIDAD || '-'}</p>
                    </div>
                    <div>
                      <span className="cartilla-seccional-label">Seccional</span>
                      <p className="cartilla-seccional-value">{seccionalEncontrada.SECCIONAL || '-'}</p>
                    </div>
                    <div>
                      <span className="cartilla-seccional-label">Dirección</span>
                      <p className="cartilla-seccional-value">{seccionalEncontrada.DIRECCION || '-'}</p>
                    </div>
                    <div>
                      <span className="cartilla-seccional-label">Teléfono</span>
                      <p className="cartilla-seccional-value">
                        {seccionalEncontrada.TELEFONO || 'Sin teléfono informado'}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p style={{ margin: 0, color: '#b45309' }}>
                  ⚠ No se encontró la sede para el código de seccional{' '}
                  <strong>{codigoSeccional || '(sin código en geografía)'}</strong>.
                  Verificá que exista un registro con ese valor en el campo SECCIONAL de
                  seccionales.js
                </p>
              )}
            </div>
          )}
        </div>

        {/* Fila 3: Prestación */}
        <div className="cartilla-row">
          <label className="cartilla-label">Prestación</label>
          <div className="cartilla-input-wrapper">
            <button
              onClick={() => setPrestacionOpen(!prestacionOpen)}
              className="cartilla-dropdown-button"
            >
              {selectedPrestacion || 'Seleccionar prestación'}
            </button>
            {prestacionOpen && (
              <div className="cartilla-dropdown-menu">
                {Array.isArray(filteredPrestaciones) && filteredPrestaciones.map((prest) => (
                  <button
                    key={typeof prest === 'object' ? prest.nombre : prest}
                    onClick={() => {
                      setSelectedPrestacion(typeof prest === 'object' ? prest.nombre : prest);
                      setSelectedDetalle('');
                      setPrestacionOpen(false);
                    }}
                    className="cartilla-dropdown-item"
                  >
                    {typeof prest === 'object' ? prest.nombre : prest}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fila 4: Detalle */}
        <div className="cartilla-row">
          <label className="cartilla-label">Detalle</label>
          <div className="cartilla-input-wrapper">
            <button
              onClick={() => selectedPrestacion && setDetalleOpen(!detalleOpen)}
              disabled={!selectedPrestacion}
              className="cartilla-dropdown-button"
            >
              {selectedDetalle || 'Seleccionar detalle'}
            </button>
            {detalleOpen && selectedPrestacion && (
              <div className="cartilla-dropdown-menu">
                {Array.isArray(filteredDetalles) && filteredDetalles.map((det) => (
                  <button
                    key={typeof det === 'object' ? det.nombre : det}
                    onClick={() => {
                      setSelectedDetalle(typeof det === 'object' ? det.nombre : det);
                      setDetalleOpen(false);
                    }}
                    className="cartilla-dropdown-item"
                  >
                    {typeof det === 'object' ? det.nombre : det}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Botón Limpiar Filtros */}
        <div className="cartilla-actions">
          <button
            onClick={handleClearFilters}
            className="cartilla-button-danger"
          >
            🗑️ Limpiar Filtros
          </button>
        </div>

        {/* Resumen de Filtros */}
        {(selectedPlan || selectedProvincia || selectedPrestacion) && (
          <div className="cartilla-summary">
            <p>
              <span className="summary-title">Búsqueda activa:</span>
              {selectedPlan && ` Plan: ${selectedPlan} |`}
              {selectedProvincia && ` Provincia: ${selectedProvincia} |`}
              {selectedPartido && ` Partido: ${selectedPartido} |`}
              {selectedLocalidad && ` Localidad: ${selectedLocalidad} |`}
              {selectedPrestacion && ` Prestación: ${selectedPrestacion}`}
              {selectedDetalle && ` - ${selectedDetalle}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartillaApp;
