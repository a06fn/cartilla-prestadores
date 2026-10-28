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
    _provincia: norm(p.Provincia),
    _partido: norm(p.Partido),
    _localidad: norm(p.Localidad),
  };
}

export function filtrarPrestadores(filas, filtros) {
  const { plan, guardia, provincia, partido, localidad, prestacion, detalle } = filtros;

  return filas.filter((p) => {
    if (plan && p._plan !== norm(plan)) return false;

    // Guardia y Prestación son excluyentes: una fila de guardia no tiene especialidad.
    if (guardia) {
      if (p._prestacion !== 'GUARDIA' || p._especialidad !== norm(guardia)) return false;
    } else {
      if (prestacion && p._prestacion !== prestacion) return false;
      if (detalle && p._especialidad !== norm(detalle)) return false;
    }

    if (provincia && p._provincia !== norm(provincia)) return false;
    if (partido && p._partido !== norm(partido)) return false;
    if (localidad && p._localidad !== norm(localidad)) return false;

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
