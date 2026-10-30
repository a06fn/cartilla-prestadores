// Agrupación de seccionales.
//
// La cartilla usa un nombre de seccional más general que el listado de sedes
// (`src/data/seccionales.js`). Por ejemplo, en los datos todos los prestadores de
// Chubut dicen "CHUBUT", mientras que el listado tiene cuatro sedes
// (Trelew, Puerto Madryn, Esquel y Comodoro Rivadavia).
//
// Un "grupo" es entonces: un nombre de seccional + las sedes que le corresponden.

import { norm } from './prestadores';

// Nombre en la cartilla -> sedes del listado que le corresponden.
export const ALIAS_SECCIONAL = {
  CHUBUT: [
    'CHUBUT TRELEW',
    'CHUBUT PUERTO MADRYN',
    'CHUBUT ESQUEL',
    'CHUBUT COMODORO RIVADAVIA',
  ],
  'LA PAMPA': ['LA PAMPA GENERAL PICO', 'LA PAMPA SANTA ROSA'],
  'SANTA CRUZ': ['SANTA CRUZ RIO GALLEGOS', 'SANTA CRUZ CALETA OLIVIA'],
  'TIERRA DEL FUEGO': ['TIERRA DEL FUEGO RIO GRANDE', 'TIERRA DEL FUEGO USHUAIA'],
  ROSARIO: ['SANTA FE ROSARIO'],
  CORDOBA: ['CORDOBA', 'CORDOBA RIO CUARTO'],
  'ENTRE RIOS': ['ENTRE RIOS', 'ENTRE RIOS CONCORDIA', 'ENTRE RIOS GUALEGUAYCHU'],
};

// Seccionales que no tienen sede propia en el listado pero se atienden desde
// otras sedes. A diferencia de ALIAS_SECCIONAL, acá NO se mezclan los datos:
// GBA NORTE y GBA OESTE siguen siendo seccionales independientes.
export const SEDES_COMPARTIDAS = {
  'GBA NOROESTE': ['GBA NORTE', 'GBA OESTE'],
};

const DESTINO = new Map();
for (const [clave, sedes] of Object.entries(ALIAS_SECCIONAL)) {
  for (const sede of sedes) DESTINO.set(norm(sede), norm(clave));
}

const ETIQUETA_ALIAS = new Map(
  Object.keys(ALIAS_SECCIONAL).map((clave) => [norm(clave), clave])
);

/**
 * Construye la lista de seccionales seleccionables:
 *   - todos los nombres que aparecen en los datos,
 *   - más las sedes del listado que no estén absorbidas por un alias.
 *
 * Cada grupo queda con:
 *   clave      -> identificador normalizado
 *   etiqueta   -> texto para mostrar
 *   nombres    -> valores normalizados del CSV que pertenecen al grupo
 *   sedes      -> sedes del listado (puede ser vacío)
 *   filas      -> cantidad de filas del CSV con esa seccional
 *   conCoords  -> cantidad de sedes con coordenadas
 */
export function construirGrupos(prestadores, seccionales) {
  const grupos = new Map();

  const asegurar = (clave, etiqueta) => {
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        clave,
        etiqueta,
        nombres: [],
        sedes: [],
        filas: 0,
        conCoords: 0,
      });
    }
    return grupos.get(clave);
  };

  // 1) Nombres que vienen en los datos de la cartilla.
  for (const p of prestadores || []) {
    const valor = (p.Seccional || '').trim();
    if (!valor || valor === '-') continue;

    const clave = DESTINO.get(norm(valor)) || norm(valor);
    const grupo = asegurar(clave, ETIQUETA_ALIAS.get(clave) || valor);
    const nombre = norm(valor);
    if (!grupo.nombres.includes(nombre)) grupo.nombres.push(nombre);
    grupo.filas += 1;
  }

  // 2) Sedes del listado (aunque no tengan prestadores cargados).
  for (const sede of seccionales || []) {
    const claveSede = norm(sede.SECCIONAL);
    if (!claveSede) continue;

    const clave = DESTINO.get(claveSede) || claveSede;
    const grupo = asegurar(clave, ETIQUETA_ALIAS.get(clave) || sede.SECCIONAL);
    grupo.sedes.push(sede);
    if (Number.isFinite(sede.lat) && Number.isFinite(sede.lon)) grupo.conCoords += 1;
  }

  // 3) Sedes compartidas: seccionales sin sede propia que se muestran con las
  //    sedes de otras (sin absorber sus prestadores).
  const sedesPorNombre = new Map(
    (seccionales || []).map((sede) => [norm(sede.SECCIONAL), sede])
  );
  for (const [clave, nombres] of Object.entries(SEDES_COMPARTIDAS)) {
    const grupo = grupos.get(norm(clave));
    if (!grupo) continue;
    for (const nombre of nombres) {
      const sede = sedesPorNombre.get(norm(nombre));
      if (sede && !grupo.sedes.includes(sede)) {
        grupo.sedes.push(sede);
        if (Number.isFinite(sede.lat) && Number.isFinite(sede.lon)) grupo.conCoords += 1;
      }
    }
  }

  return [...grupos.values()]
    // Sólo se ofrecen las seccionales que tienen prestadores cargados.
    .filter((grupo) => grupo.filas > 0)
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
}

// Sedes del grupo que tienen coordenadas.
export function sedesConCoords(grupo) {
  return (grupo?.sedes || []).filter(
    (sede) => Number.isFinite(sede.lat) && Number.isFinite(sede.lon)
  );
}

/**
 * Centro del grupo para mostrar en el mapa.
 * - Si tiene sedes con coordenadas: promedio de las sedes.
 * - Si no tiene ninguna: promedio de sus prestadores.
 */
export function centroDeGrupo(grupo, prestadores) {
  if (!grupo) return null;

  const sedes = sedesConCoords(grupo);
  if (sedes.length) {
    return {
      lat: sedes.reduce((acc, s) => acc + s.lat, 0) / sedes.length,
      lon: sedes.reduce((acc, s) => acc + s.lon, 0) / sedes.length,
      estimado: false,
    };
  }

  const filas = (prestadores || []).filter((p) => grupo.nombres.includes(p._seccional));
  const conCoords = filas.filter(
    (p) => Number.isFinite(parseFloat(p.lat)) && Number.isFinite(parseFloat(p.lon))
  );
  if (!conCoords.length) return null;

  return {
    lat: conCoords.reduce((acc, p) => acc + parseFloat(p.lat), 0) / conCoords.length,
    lon: conCoords.reduce((acc, p) => acc + parseFloat(p.lon), 0) / conCoords.length,
    estimado: true,
  };
}
