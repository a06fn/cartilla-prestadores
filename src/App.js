import React, { useState, useMemo } from 'react';
import './App.css';
import { planes } from './data/planes';
import { geografia } from './data/geografia';
import { seccionales } from './data/seccionales';
import { etiquetas } from './data/etiquetas';
import { detectarMiUbicacion } from './utils/geolocalizacion';
import { guardias } from './data/guardias'; 
import { usePrestadores } from './hooks/usePrestadores';
import { filtrarPrestadores, agruparPorPrestador, filtrarPorRadio } from './utils/prestadores';
import MapaPrestadores from './components/MapaPrestadores';

const LIMITE_RESULTADOS = 50;
const RADIO_DEFAULT = 20;
const RADIOS = [1, 5, 20, 50];

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

  // Cartilla de prestadores (public/data/prestadores.csv)
  const { prestadores, cargando, error } = usePrestadores();

  // Ubicación del usuario y radio de cercanía
  const [ubicacionUsuario, setUbicacionUsuario] = useState(null);
  const [radioKm, setRadioKm] = useState(RADIO_DEFAULT);
  const [mapaAbierto, setMapaAbierto] = useState(false);

  const filtrosActivos = Boolean(
    ubicacionUsuario || selectedPlan || selectedGuardia || selectedProvincia ||
    selectedPrestacion || selectedDetalle
  );

  const { resultados, radioAplicado } = useMemo(() => {
    if (!filtrosActivos) return { resultados: [], radioAplicado: radioKm };

    const armar = (radio) => {
      const base = ubicacionUsuario
        ? filtrarPorRadio(prestadores, {
            lat: ubicacionUsuario.lat,
            lon: ubicacionUsuario.lon,
            radioKm: radio,
            localidad: ubicacionUsuario.localidad
          })
        : prestadores;

      const filas = filtrarPrestadores(base, {
        plan: selectedPlan,
        guardia: selectedGuardia,
        // En modo cercanía no se restringe por división administrativa.
        provincia: ubicacionUsuario ? '' : selectedProvincia,
        partido: ubicacionUsuario ? '' : selectedPartido,
        localidad: ubicacionUsuario ? '' : selectedLocalidad,
        prestacion: selectedPrestacion,
        detalle: selectedDetalle
      });

      return agruparPorPrestador(filas);
    };

    let efectivo = radioKm;
    let lista = armar(radioKm);

    // Si hay muy pocos resultados, ampliamos de a un escalón hasta llegar a 50 km.
    if (ubicacionUsuario && lista.length < 5) {
      const desde = Math.max(0, RADIOS.indexOf(radioKm));
      for (let i = desde + 1; i < RADIOS.length && lista.length < 5; i += 1) {
        efectivo = RADIOS[i];
        lista = armar(efectivo);
      }
    }

    if (ubicacionUsuario) {
      lista = [...lista].sort(
        (a, b) => (a.distancia ?? Infinity) - (b.distancia ?? Infinity)
      );
    }

    return { resultados: lista, radioAplicado: efectivo };
  }, [
    prestadores, filtrosActivos, ubicacionUsuario, radioKm,
    selectedPlan, selectedGuardia, selectedProvincia, selectedPartido,
    selectedLocalidad, selectedPrestacion, selectedDetalle
  ]);

  const resultadosVisibles = resultados.slice(0, LIMITE_RESULTADOS);

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
    setUbicacionUsuario(null);
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
    setUbicacionUsuario(null);
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
    setUbicacionUsuario(null);
    setRadioKm(RADIO_DEFAULT);
    setMapaAbierto(false);
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

        // Modo cercanía: usamos las coordenadas reales en lugar de la localidad exacta.
        const coords = resultado.detectado && resultado.detectado.coords;
        if (coords) {
          setUbicacionUsuario({
            lat: coords.lat,
            lon: coords.lon,
            localidad: resultado.localidad || ''
          });
          setRadioKm(RADIO_DEFAULT);
        }
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

        {/* Filtros */}
        <div className="cartilla-filtros">
          <div className="cartilla-filtros-grid">
            {/* Plan */}
            <div className="cartilla-campo cartilla-campo-plan">
              <label className="cartilla-label">Plan</label>
              <div className="cartilla-input-wrapper">
                <button
                  onClick={() => setPlanOpen(!planOpen)}
                  onBlur={() => setTimeout(() => setPlanOpen(false), 150)}
                  className="cartilla-dropdown-button"
                  title={selectedPlanDescripcion || ''}
                >
                  {selectedPlan
                    ? `${selectedPlan} · ${selectedPlanDescripcion || ''}`
                    : 'Seleccionar plan'}
                </button>
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
                        <strong>{plan.nombre}</strong> · {plan.descripcion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Guardia */}
            <div className="cartilla-campo cartilla-campo-guardia">
              <label className="cartilla-label">Guardia</label>
              <div className="cartilla-input-wrapper">
                <button
                  onClick={() => setGuardiaOpen(!guardiaOpen)}
                  onBlur={() => setTimeout(() => setGuardiaOpen(false), 150)}
                  className="cartilla-dropdown-button"
                >
                  {selectedGuardia || 'Seleccionar guardia'}
                </button>
                {guardiaOpen && (
                  <div className="cartilla-dropdown-menu">
                    {Array.isArray(filteredGuardias) && filteredGuardias.map((guard) => (
                      <button
                        key={guard}
                        onClick={() => {
                          setSelectedGuardia(guard);
                          setSelectedPrestacion('');
                          setSelectedDetalle('');
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

            {/* Prestación */}
            <div className="cartilla-campo cartilla-campo-prestacion">
              <label className="cartilla-label">Prestación</label>
              <div className="cartilla-input-wrapper">
                <button
                  onClick={() => setPrestacionOpen(!prestacionOpen)}
                  onBlur={() => setTimeout(() => setPrestacionOpen(false), 150)}
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
                          setSelectedGuardia('');
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

            {/* Detalle */}
            <div className="cartilla-campo cartilla-campo-detalle">
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

            {/* Provincia */}
            <div className="cartilla-campo cartilla-campo-provincia">
              <label className="cartilla-label">Provincia</label>
              <div className="cartilla-input-wrapper">
                <input
                  type="text"
                  placeholder="Buscar provincia..."
                  value={provinciaOpen ? provinciaSearch : selectedProvincia}
                  onChange={(e) => setProvinciaSearch(e.target.value)}
                  onFocus={() => {
                    setProvinciaSearch('');
                    setProvinciaOpen(true);
                  }}
                  onBlur={() => setTimeout(() => setProvinciaOpen(false), 150)}
                  className="cartilla-input"
                />
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
            <div className="cartilla-campo cartilla-campo-partido">
              <label className="cartilla-label">Partido</label>
              <div className="cartilla-input-wrapper">
                <input
                  type="text"
                  placeholder="Seleccionar partido..."
                  value={partidoOpen ? partidoSearch : selectedPartido}
                  onChange={(e) => setPartidoSearch(e.target.value)}
                  onFocus={() => {
                    setPartidoSearch('');
                    if (selectedProvincia) setPartidoOpen(true);
                  }}
                  onBlur={() => setTimeout(() => setPartidoOpen(false), 150)}
                  disabled={!selectedProvincia}
                  className="cartilla-input"
                />
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
            <div className="cartilla-campo cartilla-campo-localidad">
              <label className="cartilla-label">Localidad</label>
              <div className="cartilla-input-wrapper">
                <input
                  type="text"
                  placeholder="Seleccionar localidad..."
                  value={localidadOpen ? localidadSearch : selectedLocalidad}
                  onChange={(e) => setLocalidadSearch(e.target.value)}
                  onFocus={() => {
                    setLocalidadSearch('');
                    if (selectedPartido) setLocalidadOpen(true);
                  }}
                  onBlur={() => setTimeout(() => setLocalidadOpen(false), 150)}
                  disabled={!selectedPartido}
                  className="cartilla-input"
                />
                {localidadOpen && selectedPartido && (
                  <div className="cartilla-dropdown-menu">
                    {filteredLocalidad.map((loc) => (
                      <button
                        key={loc}
                        onClick={() => {
                          setUbicacionUsuario(null);
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

            {/* Mi ubicación */}
            <div className="cartilla-campo cartilla-campo-ubicacion">
              <label className="cartilla-label">Cercanía</label>
              <button
                className="cartilla-btn-ubicacion"
                onClick={handleMiUbicacion}
                disabled={cargandoUbicacion}
              >
                {cargandoUbicacion ? '⏳ Buscando…' : '📍 Mi ubicación'}
              </button>
            </div>
          </div>

          <div className="cartilla-filtros-footer">
            {ubicacionCompleta && (
              <div className="cartilla-seccional-chip">
                {seccionalEncontrada ? (
                  <>
                    <span className="cartilla-seccional-etiqueta">Seccional</span>
                    <strong>{seccionalEncontrada['NOMBRE SECCIONAL'] || 'Sin nombre'}</strong>
                    <span>
                      {[
                        seccionalEncontrada.LOCALIDAD,
                        seccionalEncontrada.SECCIONAL,
                        seccionalEncontrada.TELEFONO
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {seccionalEncontrada.DIRECCION && (
                      <span className="cartilla-seccional-dir">{seccionalEncontrada.DIRECCION}</span>
                    )}
                  </>
                ) : (
                  <span className="cartilla-seccional-etiqueta">⚠ Seccional no encontrada</span>
                )}
              </div>
            )}

            <button onClick={handleClearFilters} className="cartilla-btn-limpiar">
              🗑️ Limpiar filtros
            </button>
          </div>
        </div>

        {avisoUbicacion && !selectedLocalidad && (
          <div className="cartilla-aviso-ubicacion">⚠️ {avisoUbicacion}</div>
        )}

        {/* Resultados */}
        {filtrosActivos && (
          <div className="cartilla-resultados">
            {cargando && <p className="cartilla-aviso">Cargando cartilla de prestadores...</p>}
            {error && <p className="cartilla-aviso cartilla-aviso-error">{error}</p>}

            {!cargando && !error && (
              <>
                <div className="cartilla-resultados-header">
                  <div className="cartilla-resultados-titulo">
                    <h2>Resultados</h2>
                    <span className="cartilla-resultados-count">
                      {resultados.length} prestador{resultados.length === 1 ? '' : 'es'} encontrado{resultados.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="cartilla-resultados-acciones">
                    {ubicacionUsuario && (
                      <div className="cartilla-radios">
                        <span className="cartilla-radios-label">Radio:</span>
                        {RADIOS.map((r) => (
                          <button
                            key={r}
                            onClick={() => setRadioKm(r)}
                            className={`cartilla-radio-btn${r === radioKm ? ' activo' : ''}`}
                          >
                            {r} km
                          </button>
                        ))}
                      </div>
                    )}

                    {resultados.length > 0 && (
                      <button
                        className="cartilla-button-primary cartilla-boton-mapa"
                        onClick={() => setMapaAbierto(true)}
                      >
                        🗺️ Mostrar en el mapa
                      </button>
                    )}
                  </div>
                </div>

                {ubicacionUsuario && radioAplicado > radioKm && (
                  <p className="cartilla-aviso">
                    Había pocos resultados a {radioKm} km, así que ampliamos el radio a {radioAplicado} km.
                  </p>
                )}

                {resultados.length === 0 ? (
                  <p className="cartilla-aviso">
                    No se encontraron prestadores para los filtros seleccionados.
                  </p>
                ) : (
                  <>
                    <div className="cartilla-tabla-wrapper">
                      <table className="cartilla-tabla">
                        <thead>
                          <tr>
                            <th>Prestador</th>
                            <th>Dirección</th>
                            <th>Localidad</th>
                            <th>Teléfono</th>
                            {ubicacionUsuario && <th>Distancia</th>}
                            <th>Planes</th>
                            <th>Prestaciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resultadosVisibles.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <strong>{p.nombre}</strong>
                                {p.clasificacion && (
                                  <span className="cartilla-tabla-sub">{p.clasificacion}</span>
                                )}
                              </td>
                              <td>{p.domicilio || '-'}</td>
                              <td>{p.localidad || p.partido || '-'}</td>
                              <td>{p.telefono || '-'}</td>
                              {ubicacionUsuario && (
                                <td>
                                  {Number.isFinite(p.distancia)
                                    ? `${p.distancia.toFixed(1)} km`
                                    : 's/d'}
                                </td>
                              )}
                              <td>{p.planes.join(', ') || '-'}</td>
                              <td>{[...p.prestaciones, ...p.guardias].join(', ') || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {resultados.length > LIMITE_RESULTADOS && (
                      <p className="cartilla-aviso">
                        Mostrando los primeros {LIMITE_RESULTADOS} de {resultados.length}.
                        Refiná la búsqueda para ver más resultados.
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {mapaAbierto && (
          <MapaPrestadores
            prestadores={resultados}
            centro={ubicacionUsuario}
            radioKm={ubicacionUsuario ? radioAplicado : null}
            onClose={() => setMapaAbierto(false)}
          />
        )}
      </div>
    </div>
  );
};

export default CartillaApp;