import React, { useState, useMemo } from 'react';
import './App.css';
import { planes } from './data/planes';
import { geografia } from './data/geografia';
import { seccionales } from './data/seccionales';
import { etiquetas } from './data/etiquetas';
import { detectarMiUbicacion } from './utils/geolocalizacion';
import { guardias } from './data/guardias'; 
import { usePrestadores } from './hooks/usePrestadores';
import { norm, filtrarPrestadores, agruparPorPrestador, filtrarPorRadio } from './utils/prestadores';
import MapaPrestadores from './components/MapaPrestadores';

const LIMITE_RESULTADOS = 50;
const RADIO_DEFAULT = 20;
const RADIOS = [1, 5, 20, 50];

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
  
  const [cargandoUbicacion, setCargandoUbicacion] = useState(false);
  const [avisoUbicacion, setAvisoUbicacion] = useState('');
  const containerRef = React.useRef(null);

  // Cartilla de prestadores (public/data/prestadores.csv)
  const { prestadores, cargando, error } = usePrestadores();

  // Ubicación del usuario y radio de cercanía
  const [ubicacionUsuario, setUbicacionUsuario] = useState(null);
  const [radioKm, setRadioKm] = useState(null);
  const [mapaAbierto, setMapaAbierto] = useState(false);

  const filtrosActivos = Boolean(
    ubicacionUsuario || selectedPlan || selectedProvincia ||
    selectedPrestacion || selectedDetalle
  );

  // Centro de referencia: la ubicación GPS o, en su defecto, el centro de la localidad elegida.
  const centroLocalidad = useMemo(() => {
    if (!selectedLocalidad) return null;

    const loc = norm(selectedLocalidad);
    const part = norm(selectedPartido);
    let lat = 0;
    let lon = 0;
    let n = 0;

    for (const p of prestadores) {
      if (p._localidad !== loc) continue;
      if (part && p._partido !== part) continue;

      const pLat = parseFloat(p.lat);
      const pLon = parseFloat(p.lon);
      if (!Number.isFinite(pLat) || !Number.isFinite(pLon)) continue;

      lat += pLat;
      lon += pLon;
      n += 1;
      if (n >= 400) break;
    }

    return n ? { lat: lat / n, lon: lon / n } : null;
  }, [prestadores, selectedLocalidad, selectedPartido]);

  const centro = ubicacionUsuario || centroLocalidad;
  const conRadio = Boolean(centro) && radioKm != null;

  // Centro estable para el mapa (evita recrearlo en cada render).
  const centroMapa = useMemo(
    () =>
      centro
        ? { lat: centro.lat, lon: centro.lon, esUsuario: Boolean(ubicacionUsuario) }
        : null,
    [centro, ubicacionUsuario]
  );

  const { resultados, radioAplicado } = useMemo(() => {
    if (!filtrosActivos) return { resultados: [], radioAplicado: null };

    const armar = (radio) => {
      let base = prestadores;

      // Modo GPS: recortamos por radio real e ignoramos los filtros administrativos.
      if (ubicacionUsuario && radio != null) {
        base = filtrarPorRadio(base, {
          lat: ubicacionUsuario.lat,
          lon: ubicacionUsuario.lon,
          radioKm: radio,
          localidad: ubicacionUsuario.localidad
        });
      }

      let filas = filtrarPrestadores(base, {
        plan: selectedPlan,
        prestacion: selectedPrestacion,
        detalle: selectedDetalle,
        provincia: ubicacionUsuario ? '' : selectedProvincia,
        partido: ubicacionUsuario ? '' : selectedPartido,
        localidad: ubicacionUsuario ? '' : selectedLocalidad
      });

      // Ubicación manual + rango: recortamos alrededor del centro de la localidad.
      if (!ubicacionUsuario && centro && radio != null) {
        filas = filtrarPorRadio(filas, {
          lat: centro.lat,
          lon: centro.lon,
          radioKm: radio,
          localidad: selectedLocalidad
        });
      }

      return agruparPorPrestador(filas);
    };

    let efectivo = radioKm;
    let lista = armar(radioKm);

    // En modo GPS, si hay muy pocos resultados ampliamos de a un escalón.
    if (ubicacionUsuario && lista.length < 5) {
      const desde = Math.max(0, RADIOS.indexOf(radioKm));
      for (let i = desde + 1; i < RADIOS.length && lista.length < 5; i += 1) {
        efectivo = RADIOS[i];
        lista = armar(efectivo);
      }
    }

    if (conRadio) {
      lista = [...lista].sort(
        (a, b) => (a.distancia ?? Infinity) - (b.distancia ?? Infinity)
      );
    }

    return { resultados: lista, radioAplicado: conRadio ? efectivo : null };
  }, [
    prestadores, filtrosActivos, ubicacionUsuario, centro, conRadio, radioKm,
    selectedPlan, selectedProvincia, selectedPartido,
    selectedLocalidad, selectedPrestacion, selectedDetalle
  ]);

  const resultadosVisibles = resultados.slice(0, LIMITE_RESULTADOS);

  // Búsqueda de seccional con normalización y cascada

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

  // Al salir del modo GPS volvemos a "sin límite" (la localidad manual no filtra por defecto).
  const salirDeModoGps = () => {
    if (ubicacionUsuario) {
      setUbicacionUsuario(null);
      setRadioKm(null);
    }
  };

  // Obtener partidos cuando selecciona provincia
  const handleProvinciaSelect = (prov) => {
    salirDeModoGps();
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
    salirDeModoGps();
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

  const filteredPrestaciones = ['GUARDIA', ...(etiquetas.PRESTACION || [])];
  const filteredDetalles = !selectedPrestacion
    ? []
    : selectedPrestacion === 'GUARDIA'
      ? guardias || []
      : etiquetas[selectedPrestacion] || [];

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
    setAvisoUbicacion('');
    setUbicacionUsuario(null);
    setRadioKm(null);
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

            {/* Prestación (incluye GUARDIA) */}
            <div className="cartilla-campo cartilla-campo-prestacion">
              <label className="cartilla-label">Prestación</label>
              <div className="cartilla-input-wrapper">
                <button
                  onClick={() => setPrestacionOpen(!prestacionOpen)}
                  onBlur={() => setTimeout(() => setPrestacionOpen(false), 150)}
                  className={`cartilla-dropdown-button${
                    selectedPrestacion === 'GUARDIA' ? ' cartilla-button-guardia-activa' : ''
                  }`}
                >
                  {selectedPrestacion || 'Seleccionar prestación'}
                </button>
                {prestacionOpen && (
                  <div className="cartilla-dropdown-menu">
                    {Array.isArray(filteredPrestaciones) && filteredPrestaciones.map((prest) => {
                      const nombre = typeof prest === 'object' ? prest.nombre : prest;
                      return (
                        <button
                          key={nombre}
                          onClick={() => {
                            setSelectedPrestacion(nombre);
                            setSelectedDetalle('');
                            setPrestacionOpen(false);
                          }}
                          className={`cartilla-dropdown-item${
                            nombre === 'GUARDIA' ? ' cartilla-dropdown-item-guardia' : ''
                          }`}
                        >
                          {nombre === 'GUARDIA' ? '🛡️ GUARDIA' : nombre}
                        </button>
                      );
                    })}
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
                  {selectedDetalle ||
                    (selectedPrestacion === 'GUARDIA' ? 'Seleccionar guardia' : 'Seleccionar detalle')}
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
                          salirDeModoGps();
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

            {/* Distancia */}
            <div className="cartilla-campo cartilla-campo-distancia">
              <label className="cartilla-label">Distancia</label>
              <div className="cartilla-chips">
                {!ubicacionUsuario && (
                  <button
                    type="button"
                    onClick={() => setRadioKm(null)}
                    disabled={!centro}
                    title={centro ? 'Sin límite de distancia' : 'Elegí una localidad o usá tu ubicación'}
                    className={`cartilla-radio-btn${radioKm == null ? ' activo' : ''}`}
                  >
                    Sin límite
                  </button>
                )}
                {RADIOS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadioKm(r)}
                    disabled={!centro}
                    title={centro ? `Hasta ${r} km` : 'Elegí una localidad o usá tu ubicación'}
                    className={`cartilla-radio-btn${r === radioKm ? ' activo' : ''}`}
                  >
                    {r} km
                  </button>
                ))}
              </div>
            </div>

            {/* Mi ubicación */}
            <div className="cartilla-campo cartilla-campo-ubicacion">
              <label className="cartilla-label">Ubicación</label>
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

                {conRadio && radioAplicado > radioKm && (
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
                            {conRadio && <th>Distancia</th>}
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
                              {conRadio && (
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
            centro={centroMapa}
            radioKm={radioAplicado}
            onClose={() => setMapaAbierto(false)}
          />
        )}
      </div>
    </div>
  );
};

export default CartillaApp;