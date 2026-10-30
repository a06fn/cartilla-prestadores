import React, { useState, useMemo } from 'react';
import './App.css';
import { planes } from './data/planes';
import { seccionales } from './data/seccionales';
import { etiquetas } from './data/etiquetas';
import { obtenerCoordenadas } from './utils/geolocalizacion';
import { guardias } from './data/guardias'; 
import { usePrestadores } from './hooks/usePrestadores';
import {
  norm,
  filtrarPrestadores,
  agruparPorPrestador,
  filtrarPorDistancia,
  filtrarPorSeccional,
} from './utils/prestadores';
import { construirGrupos, centroDeGrupo, sedesConCoords } from './utils/seccionales';
import MapaPrestadores from './components/MapaPrestadores';

const LIMITE_RESULTADOS = 50;
// En modo seccional el valor por defecto es "Sin límite" (null).
// Con geolocalización se arranca en 20 km alrededor de la coordenada.
const RADIO_DEFAULT = 20;
const RADIOS = [1, 5, 20, 50];

// Huella de los filtros para detectar cambios sin aplicar.
function claveFiltros(f) {
  return JSON.stringify([
    f.plan || '',
    f.prestacion || '',
    f.detalle || '',
    f.seccional || '',
    f.ubicacionUsuario ? `${f.ubicacionUsuario.lat},${f.ubicacionUsuario.lon}` : '',
    f.radioKm == null ? '' : f.radioKm
  ]);
}

const CartillaApp = () => {
  const [selectedSeccional, setSelectedSeccional] = useState('');
  const [seccionalSearch, setSeccionalSearch] = useState('');
  const [seccionalOpen, setSeccionalOpen] = useState(false);
  const [sedesAbiertas, setSedesAbiertas] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedPlanDescripcion, setSelectedPlanDescripcion] = useState('');
  const [planOpen, setPlanOpen] = useState(false);
  const [selectedPrestacion, setSelectedPrestacion] = useState('');
  const [selectedDetalle, setSelectedDetalle] = useState('');

  const [prestacionOpen, setPrestacionOpen] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);

  const [cargandoUbicacion, setCargandoUbicacion] = useState(false);
  const [avisoUbicacion, setAvisoUbicacion] = useState('');
  const containerRef = React.useRef(null);

  // Cartilla de prestadores (public/data/prestadores.csv)
  const { prestadores, cargando, error } = usePrestadores();

  // Ubicación del usuario y radio de cercanía
  const [ubicacionUsuario, setUbicacionUsuario] = useState(null);
  const [radioKm, setRadioKm] = useState(null);
  const [mapaAbierto, setMapaAbierto] = useState(false);

  // Filtros aplicados: sólo cambian al presionar Buscar.
  const [busqueda, setBusqueda] = useState(null);

  // Para poder buscar hace falta una ubicación (seccional o GPS) y la
  // prestación elegida. El detalle es opcional.
  const hayUbicacion = Boolean(selectedSeccional || ubicacionUsuario);
  const busquedaLista = Boolean(hayUbicacion && selectedPrestacion);

  const filtrosActuales = {
    plan: selectedPlan,
    prestacion: selectedPrestacion,
    detalle: selectedDetalle,
    seccional: selectedSeccional ? norm(selectedSeccional) : '',
    ubicacionUsuario,
    radioKm
  };

  // Seccionales seleccionables: las que aparecen en la cartilla + las sedes
  // del listado que no estén agrupadas en otra.
  const gruposSeccional = useMemo(
    () => construirGrupos(prestadores, seccionales),
    [prestadores]
  );

  const grupoSeleccionado = useMemo(() => {
    if (!selectedSeccional) return null;
    const clave = norm(selectedSeccional);
    return gruposSeccional.find((g) => g.clave === clave) || null;
  }, [gruposSeccional, selectedSeccional]);

  const filteredSeccional = useMemo(() => {
    const consulta = norm(seccionalSearch);
    if (!consulta) return gruposSeccional;
    return gruposSeccional.filter((g) => {
      const texto = [
        g.etiqueta,
        ...g.sedes.map((s) => `${s['NOMBRE SECCIONAL'] || ''} ${s.LOCALIDAD || ''}`)
      ].join(' ');
      return norm(texto).includes(consulta);
    });
  }, [gruposSeccional, seccionalSearch]);

  // Centro de la seccional elegida (o de la ubicación GPS): habilita los chips de distancia.
  const centroDraft = useMemo(
    () =>
      ubicacionUsuario ||
      (grupoSeleccionado ? centroDeGrupo(grupoSeleccionado, prestadores) : null),
    [ubicacionUsuario, grupoSeleccionado, prestadores]
  );

  // Seccional ya aplicada en la búsqueda.
  const grupoBusqueda = useMemo(() => {
    if (!busqueda || !busqueda.seccional) return null;
    return gruposSeccional.find((g) => g.clave === busqueda.seccional) || null;
  }, [busqueda, gruposSeccional]);

  // Centros estables para el mapa (evita recrearlo en cada render).
  const centrosMapa = useMemo(() => {
    if (!busqueda) return [];

    const ubi = busqueda.ubicacionUsuario;
    if (ubi) {
      const precision = Number.isFinite(ubi.precision)
        ? `±${Math.round(ubi.precision)} m`
        : '';
      return [
        {
          lat: ubi.lat,
          lon: ubi.lon,
          titulo: 'Tu ubicación',
          detalle: precision,
          esUsuario: true
        }
      ];
    }

    if (!grupoBusqueda) return [];

    const sedes = sedesConCoords(grupoBusqueda);
    if (sedes.length) {
      return sedes.map((sede) => ({
        lat: sede.lat,
        lon: sede.lon,
        titulo: `${sede['NOMBRE SECCIONAL'] || 'Seccional'} (${sede.SECCIONAL})`,
        detalle: [sede.DIRECCION, sede.LOCALIDAD].filter(Boolean).join(' · '),
        telefono: sede.TELEFONO
      }));
    }

    const centro = centroDeGrupo(grupoBusqueda, prestadores);
    return centro
      ? [
          {
            lat: centro.lat,
            lon: centro.lon,
            titulo: `${grupoBusqueda.etiqueta} · centro estimado`
          }
        ]
      : [];
  }, [busqueda, grupoBusqueda, prestadores]);

  const { resultados, radioAplicado } = useMemo(() => {
    if (!busqueda) return { resultados: [], radioAplicado: null };

    const ubi = busqueda.ubicacionUsuario;
    const radioBase = busqueda.radioKm;
    const grupo = busqueda.seccional
      ? gruposSeccional.find((g) => g.clave === busqueda.seccional) || null
      : null;

    // Puntos de referencia: la ubicación GPS o las sedes de la seccional.
    const centros = ubi
      ? [ubi]
      : grupo
        ? sedesConCoords(grupo).length
          ? sedesConCoords(grupo)
          : [centroDeGrupo(grupo, prestadores)].filter(Boolean)
        : [];

    const armar = (radio) => {
      let base = prestadores;

      if (radio != null && centros.length) {
        // Cercanía: dentro del radio de alguna sede (o de la ubicación GPS).
        base = filtrarPorDistancia(base, centros, radio);
      } else if (grupo) {
        // "Sin límite": todos los prestadores de la seccional.
        base = filtrarPorSeccional(base, grupo.nombres);
      }

      const filas = filtrarPrestadores(base, {
        plan: busqueda.plan,
        prestacion: busqueda.prestacion,
        detalle: busqueda.detalle
      });

      return agruparPorPrestador(filas);
    };

    let efectivo = radioBase;
    let lista = armar(radioBase);

    // En modo GPS, si hay muy pocos resultados ampliamos al siguiente escalón.
    if (ubi && lista.length < 5) {
      const superiores = RADIOS.filter((r) => r > (radioBase ?? 0));
      for (const r of superiores) {
        if (lista.length >= 5) break;
        efectivo = r;
        lista = armar(r);
      }
    }

    if (centros.length && radioBase != null) {
      lista = [...lista].sort(
        (a, b) => (a.distancia ?? Infinity) - (b.distancia ?? Infinity)
      );
    }

    return {
      resultados: lista,
      radioAplicado: centros.length && radioBase != null ? efectivo : null
    };
  }, [prestadores, busqueda, gruposSeccional]);

  const conRadio = radioAplicado != null;

  const resultadosVisibles = resultados.slice(0, LIMITE_RESULTADOS);

  // ¿El usuario tocó filtros después de la última búsqueda?
  const hayCambiosSinAplicar =
    busqueda != null && claveFiltros(filtrosActuales) !== claveFiltros(busqueda);

  // Mensaje cuando no hay resultados, según el modo de búsqueda.
  const mensajeVacio = (() => {
    if (!busqueda) return '';
    if (busqueda.ubicacionUsuario) {
      return `No hay prestadores a ${busqueda.radioKm} km de tu ubicación.`;
    }
    if (grupoBusqueda) {
      return busqueda.radioKm == null
        ? `No hay prestadores en la seccional ${grupoBusqueda.etiqueta} con los filtros elegidos.`
        : `No hay prestadores a ${busqueda.radioKm} km de la seccional ${grupoBusqueda.etiqueta} con los filtros elegidos.`;
    }
    return 'No se encontraron prestadores para los filtros seleccionados.';
  })();

  // Al elegir una seccional salimos del modo GPS.
  const handleSeccionalSelect = (clave) => {
    const veniaDeGps = Boolean(ubicacionUsuario);
    setSelectedSeccional(clave);
    setSeccionalOpen(false);
    setSeccionalSearch('');
    setSedesAbiertas(false);
    setAvisoUbicacion('');
    setUbicacionUsuario(null);
    // En modo seccional el rango por defecto es "Sin límite".
    if (veniaDeGps) setRadioKm(null);
  };

  const filteredPrestaciones = ['GUARDIA', ...(etiquetas.PRESTACION || [])];
  const filteredDetalles = !selectedPrestacion
    ? []
    : selectedPrestacion === 'GUARDIA'
      ? guardias || []
      : etiquetas[selectedPrestacion] || [];

  // Aplica los filtros en borrador (botón Buscar).
  const ejecutarBusqueda = () => {
    if (!busquedaLista) return;
    setBusqueda({ ...filtrosActuales });
  };

  // El rango de distancia se aplica al instante, incluso sobre una búsqueda ya hecha.
  const cambiarRadio = (r) => {
    setRadioKm(r);
    setBusqueda((actual) => (actual ? { ...actual, radioKm: r } : actual));
  };

  const handleClearFilters = () => {
    setSelectedPlan('');
    setSelectedPlanDescripcion('');
    setPlanOpen(false);
    setSelectedSeccional('');
    setSeccionalOpen(false);
    setSeccionalSearch('');
    setSedesAbiertas(false);
    setSelectedPrestacion('');
    setSelectedDetalle('');
    setAvisoUbicacion('');
    setUbicacionUsuario(null);
    setRadioKm(null);
    setBusqueda(null);
    setMapaAbierto(false);
  };

  // Handler para el botón Mi Ubicación
  const handleMiUbicacion = async () => {
    setCargandoUbicacion(true);
    setAvisoUbicacion('');

    try {
      const coords = await obtenerCoordenadas();
      const ubicacion = {
        lat: coords.lat,
        lon: coords.lon,
        precision: coords.precision
      };

      setUbicacionUsuario(ubicacion);
      setSelectedSeccional('');
      setSeccionalOpen(false);
      setRadioKm(RADIO_DEFAULT);

      // "Mi ubicación" sólo dispara la búsqueda si ya está elegida la
      // prestación. Si no, el usuario completa y presiona Buscar.
      if (selectedPrestacion) {
        setBusqueda({
          plan: selectedPlan,
          prestacion: selectedPrestacion,
          detalle: selectedDetalle,
          seccional: '',
          ubicacionUsuario: ubicacion,
          radioKm: RADIO_DEFAULT
        });
      } else {
        setBusqueda(null);
      }
    } catch (error) {
      setAvisoUbicacion(error.message || 'Error al detectar ubicación.');
    } finally {
      setCargandoUbicacion(false);
    }
  };

  // Cerrar dropdowns al clickear fuera
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setPlanOpen(false);
        setSeccionalOpen(false);
        setPrestacionOpen(false);
        setDetalleOpen(false);
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setPlanOpen(false);
        setSeccionalOpen(false);
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
            {/* Seccional */}
            <div className="cartilla-campo cartilla-campo-seccional">
              <label className="cartilla-label">Seccional</label>
              <div className="cartilla-input-wrapper">
                <input
                  type="text"
                  placeholder="Buscar seccional..."
                  value={
                    seccionalOpen
                      ? seccionalSearch
                      : grupoSeleccionado
                        ? grupoSeleccionado.etiqueta
                        : ''
                  }
                  onChange={(e) => setSeccionalSearch(e.target.value)}
                  onFocus={() => {
                    setSeccionalSearch('');
                    setSeccionalOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setSeccionalOpen(false);
                      ejecutarBusqueda();
                    }
                  }}
                  onBlur={() => setTimeout(() => setSeccionalOpen(false), 150)}
                  className="cartilla-input"
                />
                {seccionalOpen && (
                  <div className="cartilla-dropdown-menu">
                    {filteredSeccional.length === 0 && (
                      <div className="cartilla-dropdown-vacio">Sin resultados</div>
                    )}
                    {filteredSeccional.map((grupo) => (
                      <button
                        key={grupo.clave}
                        onClick={() => handleSeccionalSelect(grupo.clave)}
                        className="cartilla-dropdown-item"
                      >
                        <span>{grupo.etiqueta}</span>
                        <span className="cartilla-dropdown-badge">
                          {grupo.sedes.length > 1 ? `${grupo.sedes.length} sedes` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Plan */}
            {(selectedSeccional || ubicacionUsuario || selectedPlan) && (
              <div className="cartilla-campo cartilla-campo-plan cartilla-campo-aparece">
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
            )}

            {/* Prestación (incluye GUARDIA) */}
            {(selectedPlan || selectedPrestacion) && (
              <div className="cartilla-campo cartilla-campo-prestacion cartilla-campo-aparece">
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
            )}

            {/* Detalle */}
            {(selectedPrestacion || selectedDetalle) && (
              <div className="cartilla-campo cartilla-campo-detalle cartilla-campo-aparece">
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
            )}

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

            {/* Distancia */}
            <div className="cartilla-campo cartilla-campo-distancia">
              <label className="cartilla-label">Distancia</label>
              <div className="cartilla-chips">
                {!ubicacionUsuario && (
                  <button
                    type="button"
                    onClick={() => cambiarRadio(null)}
                    disabled={!centroDraft}
                    title={
                      centroDraft
                        ? 'Todos los prestadores de la seccional'
                        : 'Elegí una seccional o usá tu ubicación'
                    }
                    className={`cartilla-radio-btn${centroDraft && radioKm == null ? ' activo' : ''}`}
                  >
                    Sin límite
                  </button>
                )}
                {RADIOS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => cambiarRadio(r)}
                    disabled={!centroDraft}
                    title={centroDraft ? `Hasta ${r} km` : 'Elegí una seccional o usá tu ubicación'}
                    className={`cartilla-radio-btn${centroDraft && r === radioKm ? ' activo' : ''}`}
                  >
                    {r} km
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="cartilla-filtros-footer">
            {ubicacionUsuario ? (
              <div className="cartilla-seccional-info">
                <div className="cartilla-seccional-chip">
                  <span className="cartilla-seccional-etiqueta">Búsqueda</span>
                  <strong>📍 Tu ubicación</strong>
                  {Number.isFinite(ubicacionUsuario.precision) && (
                    <span>±{Math.round(ubicacionUsuario.precision)} m</span>
                  )}
                </div>
              </div>
            ) : grupoSeleccionado ? (
              <div className="cartilla-seccional-info">
                <div className="cartilla-seccional-chip">
                  <span className="cartilla-seccional-etiqueta">Seccional</span>
                  <strong>{grupoSeleccionado.etiqueta}</strong>

                  {grupoSeleccionado.sedes.length === 1 && (
                    <>
                      <span>{grupoSeleccionado.sedes[0]['NOMBRE SECCIONAL']}</span>
                      <span>
                        {[grupoSeleccionado.sedes[0].LOCALIDAD, grupoSeleccionado.sedes[0].TELEFONO]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      {grupoSeleccionado.sedes[0].DIRECCION && (
                        <span className="cartilla-seccional-dir">
                          {grupoSeleccionado.sedes[0].DIRECCION}
                        </span>
                      )}
                    </>
                  )}

                  {grupoSeleccionado.sedes.length > 1 && (
                    <button
                      type="button"
                      className="cartilla-btn-sedes"
                      onClick={() => setSedesAbiertas((abierto) => !abierto)}
                      aria-expanded={sedesAbiertas}
                      title={sedesAbiertas ? 'Ocultar sedes' : 'Ver direcciones y teléfonos'}
                    >
                      {grupoSeleccionado.sedes.length} sedes {sedesAbiertas ? '▲' : '▼'}
                    </button>
                  )}
                </div>

                {sedesAbiertas && grupoSeleccionado.sedes.length > 1 && (
                  <div className="cartilla-sedes-lista">
                    {grupoSeleccionado.sedes.map((sede) => (
                      <div key={sede.SECCIONAL} className="cartilla-sede-item">
                        <div className="cartilla-sede-titulo">
                          {sede['NOMBRE SECCIONAL'] || sede.SECCIONAL}
                          {sede.LOCALIDAD ? <span> · {sede.LOCALIDAD}</span> : null}
                        </div>
                        {sede.DIRECCION && <div>📍 {sede.DIRECCION}</div>}
                        {sede.TELEFONO && <div>📞 {sede.TELEFONO}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <button onClick={handleClearFilters} className="cartilla-btn-limpiar">
              🗑️ Limpiar filtros
            </button>

            <button
              onClick={ejecutarBusqueda}
              disabled={!busquedaLista}
              className="cartilla-btn-buscar"
              title={
                busquedaLista
                  ? 'Buscar prestadores'
                  : 'Elegí ubicación, plan, prestación y detalle'
              }
            >
              🔍 Buscar
            </button>
          </div>
        </div>

        {avisoUbicacion && (
          <div className="cartilla-aviso-ubicacion">⚠️ {avisoUbicacion}</div>
        )}

        {hayCambiosSinAplicar && (
          <div className="cartilla-cambios">
            Cambiaste los filtros. Presioná <strong>Buscar</strong> para actualizar los resultados.
          </div>
        )}

        {!busqueda && busquedaLista && (
          <div className="cartilla-hint-buscar">
            Filtros listos. Presioná <strong>🔍 Buscar</strong> para ver los prestadores.
          </div>
        )}

        {!busqueda && !busquedaLista && (
          <div className="cartilla-hint-buscar">
            {hayUbicacion ? (
              <>
                Completá <strong>plan</strong> y <strong>prestación</strong> para poder
                buscar. El detalle es opcional.
              </>
            ) : (
              <>
                Empezá eligiendo una <strong>seccional</strong> o usá{' '}
                <strong>📍 Mi ubicación</strong>.
              </>
            )}
          </div>
        )}

        {/* Resultados */}
        {busqueda && (
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

                {conRadio && radioAplicado > busqueda.radioKm && (
                  <p className="cartilla-aviso">
                    Había pocos resultados a {busqueda.radioKm} km, así que ampliamos el radio a{' '}
                    {radioAplicado} km.
                  </p>
                )}

                {resultados.length === 0 ? (
                  <p className="cartilla-aviso">{mensajeVacio}</p>
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
            centros={centrosMapa}
            radioKm={radioAplicado}
            onClose={() => setMapaAbierto(false)}
          />
        )}
      </div>
    </div>
  );
};

export default CartillaApp;