// Genera lat/lon para cada sede de seccionales.js.
//
// Estrategia:
//   1. Geocodifica "DIRECCION, LOCALIDAD, PROVINCIA, Argentina" con Nominatim.
//   2. Si no hay resultado (o el punto queda lejísimos del centro de la localidad),
//      usa el centroide de la localidad según la API de georef-ar.
//   3. Si tampoco hay, deja la sede sin coordenadas (la app cae al centroide de prestadores).
//
// Uso: node scripts/generar-coords-seccionales.mjs
// Respeta el límite de 1 request/segundo de Nominatim.

import fs from 'fs';
import path from 'path';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const GEOREF = 'https://apis.datos.gob.ar/georef/api/localidades';
const UA = 'cartilla-prestadores/1.0 (uso interno TVSALUD)';
const ARCHIVO = path.resolve('src/data/seccionales.js');

const norm = (t) =>
  (t || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const hav = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function buscarNominatim(q) {
  const url = `${NOMINATIM}?format=jsonv2&limit=1&countrycodes=ar&accept-language=es&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) return null;
  const datos = await res.json();
  if (!Array.isArray(datos) || !datos.length) return null;
  return { lat: parseFloat(datos[0].lat), lon: parseFloat(datos[0].lon), nombre: datos[0].display_name };
}

async function cargarLocalidadesGeoref() {
  const url = `${GEOREF}?max=5000&campos=nombre,centroide,provincia`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const datos = await res.json();
  const mapa = new Map();
  for (const l of datos.localidades || []) {
    mapa.set(`${norm(l.provincia.nombre)}|${norm(l.nombre)}`, l.centroide);
  }
  return mapa;
}

const src = fs.readFileSync(ARCHIVO, 'utf8');
const arr = JSON.parse(src.slice(src.indexOf('['), src.lastIndexOf(']') + 1));
const localidades = await cargarLocalidadesGeoref();
console.log(`Georef: ${localidades.size} localidades cargadas. Sedes a resolver: ${arr.length}`);

const resultados = [];

for (const sede of arr) {
  const clave = `${norm(sede.PROVINCIA)}|${norm(sede.LOCALIDAD)}`;
  const centroLocalidad = localidades.get(clave) || null;

  let punto = null;
  let origen = '';

  try {
    const q = `${sede.DIRECCION}, ${sede.LOCALIDAD}, ${sede.PROVINCIA}, Argentina`;
    const hit = await buscarNominatim(q);
    if (hit) {
      const lejos = centroLocalidad
        ? hav(hit.lat, hit.lon, centroLocalidad.lat, centroLocalidad.lon)
        : 0;
      if (lejos <= 60) {
        punto = hit;
        origen = 'nominatim';
      } else {
        origen = `nominatim descartado (${lejos.toFixed(0)} km de la localidad)`;
      }
    } else {
      origen = 'nominatim sin resultado';
    }
  } catch (e) {
    origen = `nominatim error: ${e.message}`;
  }

  if (!punto && centroLocalidad) {
    punto = { lat: centroLocalidad.lat, lon: centroLocalidad.lon };
    origen += ' → centroide de localidad';
  }

  if (punto) {
    sede.lat = Number(punto.lat.toFixed(6));
    sede.lon = Number(punto.lon.toFixed(6));
  } else {
    delete sede.lat;
    delete sede.lon;
    origen += ' → SIN COORDENADAS';
  }

  resultados.push({ sec: sede.SECCIONAL, dir: sede.DIRECCION, loc: sede.LOCALIDAD, lat: sede.lat, lon: sede.lon, origen });
  console.log(
    `${sede.SECCIONAL.padEnd(28)} ${punto ? `${sede.lat}, ${sede.lon}` : 'SIN COORDS'}  [${origen}]`
  );

  await dormir(1100);
}

const salida = `export const seccionales = ${JSON.stringify(arr, null, 2)};\n`;
fs.writeFileSync(ARCHIVO, salida.replace(/\n/g, '\r\n'), 'utf8');

const sin = resultados.filter((r) => r.lat == null);
console.log(`\nListo: ${arr.length - sin.length}/${arr.length} con coordenadas.`);
if (sin.length) console.log('Sin coordenadas:', sin.map((r) => r.sec).join(', '));
