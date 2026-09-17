import React, { useState, useMemo, useEffect, useRef } from 'react';
import './App.css';
import { planes } from './data/planes';
import { geografia } from './data/geografia';
import { seccionales } from './data/seccionales';
import { etiquetas } from './data/etiquetas';
import { detectarMiUbicacion } from './utils/geolocalizacion';
import { guardias } from './data/guardias'; 

const CartillaApp = () => {
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedPlanDescripcion, setSelectedPlanDescripcion] = useState('');
  const [planOpen, setPlanOpen] = useState(false);
  const [selectedGuardia, setSelectedGuardia] = useState('');
  const [guardiaOpen, setGuardiaOpen] = useState(false);
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
  
  const [cargandoUbicacion, setCargandoUbicacion] = useState(false);
  const [avisoUbicacion, setAvisoUbicacion] = useState('');
  const containerRef = React.useRef(null);

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

  // Funciones auxiliares para calcular partidos y localidades
  const calcularPartidos = (prov) => {
    return [...new Set(
      geografia
        .filter(g => g.provincia === prov)
        .map(g => g.partido)
    )].sort();
  };

  const calcularLocalidades = (prov, part) => {
    return [...new Set(
      geografia
        .filter(g => g.provincia === prov && g.partido === part)
        .map(g => g.localidad)
    )].sort();
  };

  // Obtener partidos cuando selecciona provincia
  const handleProvinciaSelect = (prov) => {
    setSelectedProvincia(prov);
    setProvinciaOpen(false);
    setProvinciaSearch('');
    setSelectedPartido('');
    setSelectedLocalidad('');
    setPartidosDisponibles(calcularPartidos(prov));
    setLocalidadesDisponibles([]);
    setAvisoUbicacion('');
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
    setLocalidadesDisponibles(calcularLocalidades(selectedProvincia, part));
    setAvisoUbicacion('');
  };

  const filteredLocalidad = localidadesDisponibles.filter(l =>
    l.toLowerCase().includes(localidadSearch.toLowerCase())
  );

  const filteredPrestaciones = etiquetas.PRESTACION || [];
  const filteredDetalles = selectedPrestacion ? etiquetas[selectedPrestacion] || [] : [];
  const filteredGuardias = guardias || [];

  const handleClearFilters = () => {
    setSelectedPlan('');
    setSelectedPlanDescripcion('');
    setPlanOpen(false);
    setSelectedGuardia('');
    setGuardiaOpen(false);
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
    setAvisoUbicacion('');
  };

  // Handler para el botón Mi Ubicación
  const handleMiUbicacion = async () => {
    setCargandoUbicacion(true);
    setAvisoUbicacion('');
    
    try {
      const resultado = await detectarMiUbicacion(geografia);
      
      if (resultado.exito) {
        setSelectedProvincia(resultado.provincia);
        setSelectedPartido(resultado.partido);
        setSelectedLocalidad(resultado.localidad);
        setPartidosDisponibles(calcularPartidos(resultado.provincia));
        setLocalidadesDisponibles(calcularLocalidades(resultado.provincia, resultado.partido));
      } else {
        setAvisoUbicacion(resultado.aviso);
      }
    } catch (error) {
      setAvisoUbicacion('Error al detectar ubicación. Intenta manualmente.');
    } finally {
      setCargandoUbicacion(false);
    }
  };

  // Cerrar dropdowns al clickear fuera
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setPlanOpen(false);
        setGuardiaOpen(false);
        setProvinciaOpen(false);
        setPartidoOpen(false);
        setLocalidadOpen(false);
        setPrestacionOpen(false);
        setDetalleOpen(false);
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setPlanOpen(false);
        setGuardiaOpen(false);
        setProvinciaOpen(false);
        setPartidoOpen(false);
        setLocalidadOpen(false);
        setPrestacionOpen(false);
        setDetalleOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div className="cartilla-container" ref={containerRef}>
      <div className="cartilla-content">
        {/* Header */}
        <div className="cartilla-header">
          <h1>Cartilla de Prestadores</h1>
          <p>OBRA SOCIAL DEL PERSONAL DE TELEVISION</p>
        </div>

        {/* Fila 1: Plan */}
        <div className="cartilla-row">
          <label className="cartilla-label">Plan</label>
          <div className="cartilla-dropdown">
            <div className="cartilla-input-wrapper">
              <button
                onClick={() => setPlanOpen(!planOpen)}
                onBlur={() => setTimeout(() => setPlanOpen(false), 150)}
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
      <div className="cartilla-row" >
        {/* Fila 2: Geolocalización - LAYOUT VERTICAL */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
          {/* Sección izquierda: Provincia, Partido, Localidad */}
          <div style={{ flex: 1 }}>
            {/* Provincia */}
            <div className="cartilla-dropdown" style={{ marginBottom: '16px' }}>
              <label className="cartilla-label">Provincia</label>
              <div className="cartilla-input-wrapper">
                <input
                  type="text"
                  placeholder="Buscar provincia..."
                  value={provinciaSearch}
                  onChange={(e) => setProvinciaSearch(e.target.value)}
                  onFocus={() => setProvinciaOpen(true)}
                  onBlur={() => setTimeout(() => setProvinciaOpen(false), 150)}
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
            <div className="cartilla-dropdown" style={{ marginBottom: '16px' }}>
              <label className="cartilla-label">Partido</label>
              <div className="cartilla-input-wrapper">
                <input
                  type="text"
                  placeholder="Seleccionar partido..."
                  value={partidoSearch}
                  onChange={(e) => setPartidoSearch(e.target.value)}
                  onFocus={() => selectedProvincia && setPartidoOpen(true)}
                  onBlur={() => setTimeout(() => setPartidoOpen(false), 150)}
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
                  onBlur={() => setTimeout(() => setLocalidadOpen(false), 150)}
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
                          setAvisoUbicacion('');
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

          {/* Centro: Botón Mi Ubicación */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button
              className="cartilla-button-primary"
              onClick={handleMiUbicacion}
              disabled={cargandoUbicacion}
              style={{
                whiteSpace: 'nowrap',
                height: 'fit-content',
                flexShrink: 0
              }}
            >
              {cargandoUbicacion ? '⏳ Detectando...' : '📍 Mi Ubicación'}
            </button>
          </div>

          {/* Derecha: Tarjeta de Seccional */}
          {ubicacionCompleta && (
            <div
              style={{
                minWidth: '280px',
                padding: '14px',
                border: '2px solid #3b82f6',
                borderRadius: '8px',
                background: '#eff6ff',
                flexShrink: 0
              }}
            >
              {seccionalEncontrada ? (
                <>
                  <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#666', fontWeight: '500' }}>
                    Su seccional más cercana es:
                  </p>
                  <p style={{ margin: '0 0 9px 0', fontSize: '13px', fontWeight: 'bold', color: '#1e40af' }}>
                    ✓ {seccionalEncontrada['NOMBRE SECCIONAL'] || 'Seccional'}
                  </p>
                  <div style={{ fontSize: '11px', lineHeight: '1.5', color: '#333' }}>
                    <div><span style={{ fontWeight: '600' }}>Localidad:</span> {seccionalEncontrada.LOCALIDAD || '-'}</div>
                    <div><span style={{ fontWeight: '600' }}>Código:</span> {seccionalEncontrada.SECCIONAL || '-'}</div>
                    <div><span style={{ fontWeight: '600' }}>Dirección:</span> {seccionalEncontrada.DIRECCION || '-'}</div>
                    <div><span style={{ fontWeight: '600' }}>Teléfono:</span> {seccionalEncontrada.TELEFONO || 'Sin teléfono'}</div>
                  </div>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: '11px', color: '#b45309' }}>
                  ⚠ No encontrada
                </p>
              )}
            </div>
          )}
        </div>
      </div>
        {/* Aviso de ubicación aproximada */}
        {avisoUbicacion && !selectedLocalidad && (
          <div style={{
            padding: '12px',
            marginBottom: '16px',
            backgroundColor: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#92400e'
          }}>
            {avisoUbicacion}
          </div>
        )}

        {/* Fila 3: GUARDIA - PRIORIDAD MÁXIMA */}
        <div className="cartilla-guardia-row">
          <label className="cartilla-label">Guardia</label>
          <div className="cartilla-input-wrapper">
            <button
              onClick={() => setGuardiaOpen(!guardiaOpen)}
              onBlur={() => setTimeout(() => setGuardiaOpen(false), 150)}
              className="cartilla-dropdown-button"
            >
              {selectedGuardia || 'Seleccionar guardia'}
            </button>
            {selectedGuardia && (
              <div className="cartilla-selected">✓ {selectedGuardia}</div>
            )}
            {guardiaOpen && (
              <div className="cartilla-dropdown-menu">
                {Array.isArray(filteredGuardias) && filteredGuardias.map((guard) => (
                  <button
                    key={guard}
                    onClick={() => {
                      setSelectedGuardia(guard);
                      setGuardiaOpen(false);
                    }}
                    className="cartilla-dropdown-item"
                  >
                    {guard}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fila 4: Prestación */}
        <div className="cartilla-row">
          <label className="cartilla-label">Prestación</label>
          <div className="cartilla-input-wrapper">
            <button
              onClick={() => setPrestacionOpen(!prestacionOpen)}
              onBlur={() => setTimeout(() => setPrestacionOpen(false), 150)}
              className="cartilla-dropdown-button"
            >
              {selectedPrestacion || 'Seleccionar prestación'}
            </button>
            {selectedPrestacion && (
              <div className="cartilla-selected">✓ {selectedPrestacion}</div>
            )}
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

        {/* Fila 5: Detalle */}
        <div className="cartilla-row">
          <label className="cartilla-label">Detalle</label>
          <div className="cartilla-input-wrapper">
            <button
              onClick={() => selectedPrestacion && setDetalleOpen(!detalleOpen)}
              onBlur={() => setTimeout(() => setDetalleOpen(false), 150)}
              disabled={!selectedPrestacion}
              className="cartilla-dropdown-button"
            >
              {selectedDetalle || 'Seleccionar detalle'}
            </button>
            {selectedDetalle && (
              <div className="cartilla-selected">✓ {selectedDetalle}</div>
            )}
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
        {(selectedPlan || selectedProvincia || selectedGuardia || selectedPrestacion) && (
          <div className="cartilla-summary">
            <p>
              <span className="summary-title">Búsqueda activa:</span>
              {selectedPlan && ` Plan: ${selectedPlan} |`}
              {selectedGuardia && ` Guardia: ${selectedGuardia} |`}
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