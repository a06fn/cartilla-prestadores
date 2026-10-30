// Utilidades para parsear y filtrar la cartilla de prestadores.

export const norm = (txt) =>
  (txt || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// Parser CSV (RFC 4180) sin dependencias: soporta comillas y campos multilínea.
export function parseCSV(texto, delimitador = ';') {
  const filas = [];
  let fila = [];
  let campo = '';
  let entreComillas = false;
  const limpio = texto.replace(/^\uFEFF/, '');

  for (let i = 0; i < limpio.length; i += 1) {
    const c = limpio[i];

    if (entreComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else {
          entreComillas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === delimitador) {
      fila.push(campo);
      campo = '';
    } else if (c === '\n') {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else if (c !== '\r') {
      campo += c;
    }
  }

  if (campo !== '' || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }

  return filas;
}

export function csvAObjetos(texto) {
  const [encabezado, ...filas] = parseCSV(texto);
  if (!encabezado) return [];

  return filas
    .filter((f) => f.length === encabezado.length)
    .map((f) => {
      const objeto = {};
      encabezado.forEach((col, i) => {
        objeto[col.trim()] = f[i];
      });
      return objeto;
    });
}

// Agrega las claves normalizadas que se usan al filtrar.
export function prepararPrestador(p) {
  return {
    ...p,
    _plan: norm(p.Plan),
    _prestacion: (p.Prestacion || '').trim(),
    _especialidad: norm(p.Especialidad),
    _clasificacion: norm(p['Clasificacion prestador']),
    _seccional: norm(p.Seccional),
    _provincia: norm(p.Provincia),
    _partido: norm(p.Partido),
    _localidad: norm(p.Localidad),
  };
}

// Jerarquía de planes: cada uno incluye a los de menor cobertura.
// Universal ⊂ Intermedio ⊂ Superador
const PLANES_INCLUIDOS = {
  universal: ['universal'],
  intermedio: ['universal', 'intermedio'],
  superador: ['universal', 'intermedio', 'superador'],
};

// Planes (normalizados) que cubre el plan elegido.
export function planesIncluidos(plan) {
  const clave = norm(plan);
  return PLANES_INCLUIDOS[clave] || [clave];
}

export function filtrarPrestadores(filas, filtros) {
  const { plan, prestacion, detalle } = filtros;

  return filas.filter((p) => {
    // Un plan superior incluye la cobertura de los inferiores.
    if (plan) {
      const permitidos = planesIncluidos(plan);
      if (!permitidos.includes(p._plan)) return false;
    }

    // Reglas administrativas: las clínicas y sanatorios no se ofrecen para
    // ciertas prestaciones (son mucho más caras y el afiliado debe ir derivado,
    // no por su cuenta):
    //   - ESPECIALIDADES
    //   - DIAGNOSTICO X IMAGENES
    // Sus otras prestaciones (internación, guardia, etc.) siguen visibles.
    if (p._clasificacion === 'clinicas y sanatorios') {
      if (p._prestacion === 'ESPECIALIDADES') return false;
      if (
        p._prestacion === 'DIAGNOSTICO Y TRATAMIENTO' &&
        p._especialidad === 'diagnostico x imagenes'
      ) {
        return false;
      }
    }

    // "GUARDIA" es una prestación más: se filtra igual que el resto.
    if (prestacion) {
      if (p._prestacion !== prestacion) return false;
      if (detalle && p._especialidad !== norm(detalle)) return false;
    }

    return true;
  });
}

// Una fila del CSV es una prestación; la tabla muestra un prestador por fila.
export function agruparPorPrestador(filas) {
  const mapa = new Map();

  filas.forEach((p) => {
    const id = `${p.NroPrestador}-${p.Sucursal}`;

    if (!mapa.has(id)) {
      mapa.set(id, {
        id,
        nombre: p.Nombre,
        domicilio: p.Domicilio,
        localidad: p.Localidad,
        partido: p.Partido,
        provincia: p.Provincia,
        telefono: p.Telefono,
        clasificacion: p['Clasificacion prestador'],
        lat: parseFloat(p.lat),
        lon: parseFloat(p.lon),
        distancia: Number.isFinite(p._distancia) ? p._distancia : null,
        planes: new Set(),
        prestaciones: new Set(),
        guardias: new Set(),
      });
    }

    const prestador = mapa.get(id);
    if (p.Plan) prestador.planes.add(p.Plan.toUpperCase());

    if (p._prestacion === 'GUARDIA') {
      prestador.guardias.add(p.Especialidad);
    } else {
      prestador.prestaciones.add(p.Especialidad);
    }
  });

  return [...mapa.values()]
    .map((p) => ({
      ...p,
      planes: [...p.planes].sort(),
      prestaciones: [...p.prestaciones].sort(),
      guardias: [...p.guardias].sort(),
    }))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
}

// Distancia en kilómetros entre dos coordenadas (fórmula de Haversine).
export function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const rad = (grados) => (grados * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Prestadores de una seccional (coincidencia exacta con el nombre del CSV).
 * Se usa para el modo "Sin límite": todos los de la seccional, sin importar la distancia.
 */
export function filtrarPorSeccional(filas, nombres) {
  const permitidos = new Set(nombres || []);
  return filas
    .filter((p) => permitidos.has(p._seccional))
    .map((p) => ({ ...p, _distancia: null }));
}

/**
 * Prestadores a menos de `radioKm` de alguno de `puntos` (sedes de la seccional
 * o la ubicación del usuario). Se guarda la distancia a la más cercana.
 *
 * Los prestadores sin coordenadas quedan afuera: en modo distancia no se puede
 * asegurar que estén dentro del radio.
 */
export function filtrarPorDistancia(filas, puntos, radioKm) {
  const centros = (puntos || []).filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)
  );
  if (!centros.length || radioKm == null) return filas;

  const resultado = [];

  filas.forEach((p) => {
    const pLat = parseFloat(p.lat);
    const pLon = parseFloat(p.lon);
    if (!Number.isFinite(pLat) || !Number.isFinite(pLon)) return;

    let distancia = Infinity;
    for (const centro of centros) {
      const d = distanciaKm(centro.lat, centro.lon, pLat, pLon);
      if (d < distancia) distancia = d;
    }

    if (distancia <= radioKm) resultado.push({ ...p, _distancia: distancia });
  });

  return resultado;
}
