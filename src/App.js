import React, { useState } from 'react';
import './App.css';

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

  // Datos mock - REEMPLAZAR CON DATOS REALES
  const planes = ['Plan A', 'Plan B', 'Plan C'];
  
  const geografia = [
    { provincia: 'Buenos Aires', partido: 'La Plata', localidad: 'La Plata' },
    { provincia: 'Buenos Aires', partido: 'La Plata', localidad: 'Ensenada' },
    { provincia: 'Buenos Aires', partido: 'Avellaneda', localidad: 'Avellaneda' },
    { provincia: 'Buenos Aires', partido: 'Avellaneda', localidad: 'Lomas de Zamora' },
    { provincia: 'CABA', partido: 'Comuna 1', localidad: 'San Telmo' },
    { provincia: 'CABA', partido: 'Comuna 1', localidad: 'Monserrat' },
  ];

  const etiquetas = {
    PRESTACION: [
      'ESPECIALIDADES', 'DIAGNOSTICO Y TRATAMIENTO', 'CLINICAS Y SANATORIOS PARA INTERNACION',
      'SALUD MENTAL', 'ODONTOLOGIA', 'GUARDIA', 'FARMACIAS'
    ],
    'ESPECIALIDADES': ['ALERGIA E INMUNOLOGIA', 'CARDIOLOGIA', 'CLINICA MEDICA', 'DERMATOLOGIA', 'ENDOCRINOLOGIA', 'GASTROENTEROLOGIA', 'GINECOLOGIA', 'INFECTOLOGIA', 'NEFROLOGIA', 'NEUMONOLOGIA', 'NEUROLOGIA', 'NUTRICION Y DIABETES', 'OBSTETRICIA', 'OFTALMOLOGIA', 'ONCOLOGIA', 'OTORRINOLARINGOLOGIA', 'PEDIATRIA', 'REUMATOLOGIA', 'TRAUMATOLOGIA', 'UROLOGIA', 'PSIQUIATRIA'],
    'DIAGNOSTICO Y TRATAMIENTO': ['LABORATORIO ANALISIS CLINICOS', 'DIAGNOSTICO X IMÁGENES', 'REHABILITACION'],
    'CLINICAS Y SANATORIOS PARA INTERNACION': ['INTERNACION GENERAL', 'INTERNACION PEDIATRICA'],
    'SALUD MENTAL': ['PSICOLOGIA', 'PSICOPEDAGOGIA'],
    'ODONTOLOGIA': ['ATENCION ODONTOLOGICA', 'ATENCION ODONTOLOGICA PEDIATRICA'],
    'GUARDIA': ['GUARDIA CARDIOLOGIA', 'GUARDIA GINECOLOGIA', 'GUARDIA GENERAL', 'GUARDIA PEDIATRICA', 'GUARDIA OBSTETRICIA', 'GUARDIA OFTALMOLOGIA', 'GUARDIA PSIQUIATRICA', 'GUARDIA ODONTOLOGICA', 'GUARDIA TRAUMATOLOGICA'],
    'FARMACIAS': ['FARMACIA', 'FARMACIA 24HS']
  };

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