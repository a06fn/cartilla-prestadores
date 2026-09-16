import React, { useState, useMemo } from 'react';
import './App.css';
import { planes } from './data/planes';
import { geografia } from './data/geografia';
import { seccionales } from './data/seccionales';
import { etiquetas } from './data/etiquetas';

const CartillaApp = () => {
  const [selectedPlan, setSelectedPlan] = useState('');
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



  // Búsqueda de seccional con normalización
  const seccionalEncontrada = useMemo(() => {
    const norm = (txt) =>
      (txt || '')
        .toString()
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (!selectedProvincia || !selectedPartido || !selectedLocalidad) return null;

    return seccionales.find((item) =>
      norm(item.provincia) === norm(selectedProvincia) &&
      norm(item.partido) === norm(selectedPartido) &&
      norm(item.localidad) === norm(selectedLocalidad)
    ) || null;
  }, [selectedProvincia, selectedPartido, selectedLocalidad]);

  // Obtener provincias únicas
  const provincias = [...new Set(geografia.map(g => g.provincia))].sort();
  const filteredProvincia = provincias.filter(p =>
    p.toLowerCase().includes(provinciaSearch.toLowerCase())
  );

  // Obtener partidos cuando selecciona provincia
  const handleProvinciaSelect = (prov) => {
    setSelectedProvincia(prov);
    setProvinciaOpen(false);
    setProvinciaSearch('');
    setSelectedPartido('');
    setSelectedLocalidad('');
    const partidos = [...new Set(
      geografia
        .filter(g => g.provincia === prov)
        .map(g => g.partido)
    )].sort();
    setPartidosDisponibles(partidos);
    setLocalidadesDisponibles([]);
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
    const localidades = [...new Set(
      geografia
        .filter(g => g.provincia === selectedProvincia && g.partido === part)
        .map(g => g.localidad)
    )].sort();
    setLocalidadesDisponibles(localidades);
  };

  const filteredLocalidad = localidadesDisponibles.filter(l =>
    l.toLowerCase().includes(localidadSearch.toLowerCase())
  );

  const filteredPrestaciones = etiquetas.PRESTACION;
  const filteredDetalles = selectedPrestacion ? etiquetas[selectedPrestacion] : [];

  const handleClearFilters = () => {
    setSelectedPlan('');
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
          <select
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
            className="cartilla-select"
          >
            <option value="">Seleccionar Plan</option>
            {planes.map(plan => (
              <option key={plan} value={plan}>{plan}</option>
            ))}
          </select>
        </div>

        {/* Fila 2: Geolocalización y Ubicación */}
        <div className="cartilla-row">
          <button className="cartilla-button-primary">
            📍 Mi Ubicación
          </button>

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
        </div>

        {/* Tarjeta de Seccional Encontrada */}
        {seccionalEncontrada && (
          <div className="cartilla-seccional-card">
            <h3 className="cartilla-seccional-title">✓ Seccional encontrada</h3>
            <div className="cartilla-seccional-grid">
              <div>
                <span className="cartilla-seccional-label">Seccional</span>
                <p className="cartilla-seccional-value">{seccionalEncontrada.seccional}</p>
              </div>
              <div>
                <span className="cartilla-seccional-label">Dirección</span>
                <p className="cartilla-seccional-value">{seccionalEncontrada.direccion}</p>
              </div>
              <div>
                <span className="cartilla-seccional-label">Teléfono</span>
                <p className="cartilla-seccional-value">{seccionalEncontrada.telefono || 'Sin teléfono informado'}</p>
              </div>
            </div>
          </div>
        )}

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
                {filteredPrestaciones.map((prest) => (
                  <button
                    key={prest}
                    onClick={() => {
                      setSelectedPrestacion(prest);
                      setSelectedDetalle('');
                      setPrestacionOpen(false);
                    }}
                    className="cartilla-dropdown-item"
                  >
                    {prest}
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
                {filteredDetalles.map((det) => (
                  <button
                    key={det}
                    onClick={() => {
                      setSelectedDetalle(det);
                      setDetalleOpen(false);
                    }}
                    className="cartilla-dropdown-item"
                  >
                    {det}
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