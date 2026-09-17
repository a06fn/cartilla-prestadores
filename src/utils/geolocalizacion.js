// src/utils/geolocalizacion.js
//
// Detección de ubicación del usuario y matching contra la base de geografía.
//
// Servicios usados (ambos gratuitos, sin API key):
//   - Geolocation API del navegador  -> obtiene lat/lon
//   - Nominatim (OpenStreetMap)      -> traduce lat/lon a nombres administrativos
//
// Requisitos:
//   - El sitio debe servirse por HTTPS (o localhost). En http:// el navegador bloquea
//     la geolocalización silenciosamente.
//   - Nominatim permite ~1 petición por segundo. Suficiente para uso real de la cartilla.

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

/* ------------------------------------------------------------------ */
/* Normalización                                                       */
/* ------------------------------------------------------------------ */

// Quita acentos, pasa a minúsculas, colapsa espacios y elimina puntuación.
export function normalizar(texto) {
  return (texto || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// OSM devuelve nombres con prefijos y sufijos que tu base no tiene.
// Ej: "Partido de Adolfo Gonzales Chaves" -> "adolfo gonzales chaves"
//     "Departamento Gualeguaychú"          -> "gualeguaychu"
function limpiarNombreAdministrativo(texto) {
  let t = normalizar(texto);

  const prefijos = [
    'partido de ', 'partido ',
    'departamento de ', 'departamento ',
    'municipio de ', 'municipio ',
    'comuna de ', 'comuna ',
    'provincia de ', 'provincia ',
    'ciudad de ',
  ];

  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const p of prefijos) {
      if (t.startsWith(p)) {
        t = t.slice(p.length);
        cambio = true;
      }
    }
  }

  return t.trim();
}

// Equivalencias de provincias entre OSM y tu base.
const ALIAS_PROVINCIAS = {
  'ciudad autonoma de buenos aires': 'Capital Federal',
  'ciudad de buenos aires': 'Capital Federal',
  'caba': 'Capital Federal',
  'buenos aires city': 'Capital Federal',
  'tierra del fuego antartida e islas del atlantico sur': 'Tierra del Fuego',
  'santiago del estero': 'Santiago del Estero',
};

/* ------------------------------------------------------------------ */
/* Similitud de cadenas (para nombres que no coinciden exacto)          */
/* ------------------------------------------------------------------ */

function distanciaLevenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let fila = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = fila[j];
      fila[j] = Math.min(
        fila[j] + 1,                                  // borrado
        fila[j - 1] + 1,                              // inserción
        anterior + (a[i - 1] === b[j - 1] ? 0 : 1)    // sustitución
      );
      anterior = temp;
    }
  }

  return fila[b.length];
}

// Devuelve un puntaje 0..1. 1 = idéntico.
function similitud(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const largo = Math.max(a.length, b.length);
  return 1 - distanciaLevenshtein(a, b) / largo;
}

/**
 * Busca el mejor candidato de una lista para un nombre objetivo.
 * Estrategia en capas: exacto -> contenido -> similitud difusa.
 */
const RUIDO = new Set(['buenos', 'aires', 'ciudad', 'autonoma', 'de', 'del', 'la', 'el', 'los', 'las']);

export function buscarMejorCoincidencia(objetivo, candidatos, umbral = 0.82) {
  const obj = limpiarNombreAdministrativo(objetivo);
  if (!obj || !candidatos || candidatos.length === 0) return null;

  // 1) Coincidencia exacta tras normalizar
  const exacto = candidatos.find((c) => limpiarNombreAdministrativo(c) === obj);
  if (exacto) return exacto;

  // 2) Uno contiene al otro (ej. "santa fe" vs "santa fe capital").
  //    Se exige que el fragmento en comun aporte informacion real: si el nombre
  //    corto es solo ruido ("buenos aires"), la coincidencia se descarta.
  const informativo = (txt) =>
    txt.split(' ').some((w) => w.length > 2 && !RUIDO.has(w));

  const contenidos = candidatos.filter((c) => {
    const cn = limpiarNombreAdministrativo(c);
    if (!cn) return false;
    if (!(cn.includes(obj) || obj.includes(cn))) return false;
    const corto = cn.length <= obj.length ? cn : obj;
    return informativo(corto);
  });
  if (contenidos.length === 1) return contenidos[0];
  if (contenidos.length > 1) {
    // Si hay varios, elegir el de nombre más corto (el más específico suele serlo)
    return contenidos.sort((a, b) => a.length - b.length)[0];
  }

  // 3) Similitud difusa, para tolerar erratas y variantes ortográficas
  let mejor = null;
  let mejorPuntaje = 0;
  for (const c of candidatos) {
    const p = similitud(obj, limpiarNombreAdministrativo(c));
    if (p > mejorPuntaje) {
      mejorPuntaje = p;
      mejor = c;
    }
  }

  return mejorPuntaje >= umbral ? mejor : null;
}

/**
 * Prueba una lista ordenada de nombres candidatos contra la lista de opciones.
 * Devuelve el primer match encontrado y el candidato que lo produjo.
 *
 * Esto resuelve el caso CABA: OSM devuelve city="Buenos Aires" y
 * suburb="Nueva Pompeya" a la vez. Tomando solo el primero se perdia el barrio,
 * que es justamente el dato que coincide con la base de la cartilla.
 */
export function buscarEntreCandidatos(nombresCandidatos, opciones, umbral = 0.82) {
  const vistos = new Set();

  for (const nombre of nombresCandidatos || []) {
    const limpio = limpiarNombreAdministrativo(nombre);
    if (!limpio || vistos.has(limpio)) continue;
    vistos.add(limpio);

    const match = buscarMejorCoincidencia(nombre, opciones, umbral);
    if (match) return { match, origen: nombre };
  }

  return { match: null, origen: null };
}

/* ------------------------------------------------------------------ */
/* Paso 1: coordenadas del navegador                                    */
/* ------------------------------------------------------------------ */

export function obtenerCoordenadas() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Tu navegador no soporta geolocalización.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          precision: pos.coords.accuracy,
        }),
      (err) => {
        const mensajes = {
          1: 'Permiso denegado. Habilitá el acceso a la ubicación en el candado de la barra de direcciones.',
          2: 'No se pudo determinar tu ubicación. Verificá tu conexión o el GPS.',
          3: 'La búsqueda de ubicación tardó demasiado. Intentá de nuevo.',
        };
        reject(new Error(mensajes[err.code] || 'Error al obtener la ubicación.'));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000, // acepta una lectura de hasta 5 minutos de antigüedad
      }
    );
  });
}

/* ------------------------------------------------------------------ */
/* Paso 2: coordenadas -> nombres administrativos                       */
/* ------------------------------------------------------------------ */

export async function geocodificacionInversa(lat, lon) {
  // zoom=16 para que Nominatim devuelva el nivel de barrio/suburb, necesario en
  // CABA y en ciudades grandes donde la localidad de la cartilla es un barrio.
  const url =
    `${NOMINATIM_URL}?format=jsonv2&lat=${lat}&lon=${lon}` +
    `&zoom=16&addressdetails=1&accept-language=es`;

  const respuesta = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!respuesta.ok) {
    throw new Error('El servicio de ubicación no está disponible en este momento.');
  }

  const datos = await respuesta.json();
  const dir = datos.address || {};

  if (dir.country_code && dir.country_code !== 'ar') {
    throw new Error('Tu ubicación está fuera de Argentina.');
  }

  // Listas ordenadas de MAS especifico a MAS general.
  // No se elige un unico valor: se devuelven todos para probarlos en cascada.
  const candidatosLocalidad = [
    dir.neighbourhood,
    dir.suburb,
    dir.quarter,
    dir.borough,
    dir.village,
    dir.hamlet,
    dir.town,
    dir.city_district,
    dir.municipality,
    dir.city,
  ].filter(Boolean);

  const candidatosPartido = [
    dir.county,
    dir.state_district,
    dir.city_district,
    dir.municipality,
    dir.borough,
    dir.city,
  ].filter(Boolean);

  return {
    provinciaOSM: dir.state || dir.region || '',
    partidoOSM: candidatosPartido[0] || '',
    localidadOSM: candidatosLocalidad[0] || '',
    candidatosPartido,
    candidatosLocalidad,
    crudo: datos,
  };
}

/* ------------------------------------------------------------------ */
/* Paso 3: emparejar con la base de geografía                           */
/* ------------------------------------------------------------------ */

/**
 * Detecta la ubicación y la resuelve contra el array `geografia`.
 *
 * Devuelve un objeto con:
 *   exito       -> boolean
 *   motivo      -> string (solo si exito === false)
 *   provincia / partido / localidad -> nombres EXACTOS tal como están en geografia
 *   aproximado  -> true si no se pudo resolver hasta la localidad
 *   detectado   -> lo que devolvió OSM, útil para depurar
 */
export async function detectarMiUbicacion(geografia) {
  const coords = await obtenerCoordenadas();
  const osm = await geocodificacionInversa(coords.lat, coords.lon);

  const detectado = {
    provinciaOSM: osm.provinciaOSM,
    partidoOSM: osm.partidoOSM,
    localidadOSM: osm.localidadOSM,
    candidatosPartido: osm.candidatosPartido,
    candidatosLocalidad: osm.candidatosLocalidad,
    coords,
  };

  // Log de diagnostico: muestra exactamente que nombres devolvio OSM.
  // Es la informacion que hace falta para depurar un partido que no matchee.
  console.log('[geolocalizacion] OSM devolvio:', {
    provincia: osm.provinciaOSM,
    candidatosPartido: osm.candidatosPartido,
    candidatosLocalidad: osm.candidatosLocalidad,
  });

  // --- Provincia ---
  const provincias = [...new Set(geografia.map((g) => g.provincia))];
  const aliasProv = ALIAS_PROVINCIAS[limpiarNombreAdministrativo(osm.provinciaOSM)];

  let provincia = aliasProv
    ? buscarMejorCoincidencia(aliasProv, provincias, 0.7)
    : null;

  if (!provincia) {
    provincia = buscarMejorCoincidencia(osm.provinciaOSM, provincias, 0.75);
  }

  if (!provincia) {
    return {
      exito: false,
      motivo: `No pudimos ubicarte dentro de la cartilla${
        osm.provinciaOSM ? ` (detectamos: ${osm.provinciaOSM})` : ''
      }. Seleccioná tu zona manualmente.`,
      detectado,
    };
  }

  const filasProvincia = geografia.filter((g) => g.provincia === provincia);

  // --- Partido ---
  const partidos = [...new Set(filasProvincia.map((g) => g.partido))];
  let partido = buscarEntreCandidatos(
    osm.candidatosPartido || [osm.partidoOSM],
    partidos,
    0.8
  ).match;

  // Si OSM no dio partido util, probar deducirlo desde los nombres de localidad
  if (!partido) {
    partido = buscarEntreCandidatos(osm.candidatosLocalidad, partidos, 0.85).match;
  }

  if (!partido) {
    return {
      exito: true,
      aproximado: true,
      provincia,
      partido: '',
      localidad: '',
      detectado,
    };
  }

  const filasPartido = filasProvincia.filter((g) => g.partido === partido);

  // --- Localidad ---
  const localidades = [...new Set(filasPartido.map((g) => g.localidad))];

  // Primera pasada: exigente, sobre todos los candidatos que dio OSM.
  let resultadoLoc = buscarEntreCandidatos(osm.candidatosLocalidad, localidades, 0.85);
  let localidad = resultadoLoc.match;

  // Segunda pasada: umbral mas tolerante. Es seguro bajarlo aca porque ya
  // estamos restringidos a las localidades de UN partido concreto, asi que el
  // universo de opciones es chico y el riesgo de falso positivo es bajo.
  if (!localidad) {
    resultadoLoc = buscarEntreCandidatos(osm.candidatosLocalidad, localidades, 0.72);
    localidad = resultadoLoc.match;
  }

  // Si el partido tiene una sola localidad, es inequivoca
  if (!localidad && localidades.length === 1) {
    localidad = localidades[0];
    resultadoLoc = { match: localidad, origen: '(unica localidad del partido)' };
  }

  console.log('[geolocalizacion] Resuelto:', {
    provincia,
    partido,
    localidad: localidad || '(no resuelta)',
    matchDesde: resultadoLoc.origen || '-',
  });

  return {
    exito: true,
    aproximado: !localidad,
    provincia,
    partido,
    localidad: localidad || '',
    detectado,
  };
}
