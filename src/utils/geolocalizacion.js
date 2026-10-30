// Ubicación del usuario.
//
// Sólo se usa la Geolocation API del navegador: la app ya no necesita traducir
// coordenadas a nombres administrativos, porque el filtro geográfico es por
// seccional (cada sede tiene sus coordenadas en `src/data/seccionales.js`).
//
// Requisito: el sitio debe servirse por HTTPS (o localhost). En http:// el
// navegador bloquea la geolocalización silenciosamente.

/**
 * Pide la posición del navegador.
 * Devuelve { lat, lon, precision } donde `precision` son los metros de error
 * estimados (pos.coords.accuracy).
 */
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
        maximumAge: 0,
      }
    );
  });
}
