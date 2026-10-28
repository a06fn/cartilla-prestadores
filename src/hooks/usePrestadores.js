import { useEffect, useState } from 'react';
import { csvAObjetos, prepararPrestador } from '../utils/prestadores';

// Carga la cartilla desde /data/prestadores.csv una sola vez al iniciar la app.
export function usePrestadores() {
  const [prestadores, setPrestadores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controlador = new AbortController();
    const url = `${process.env.PUBLIC_URL}/data/prestadores.csv`;

    fetch(url, { signal: controlador.signal })
      .then((respuesta) => {
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        return respuesta.text();
      })
      .then((texto) => {
        const filas = csvAObjetos(texto)
          .filter((p) => p.NroPrestador && p.Especialidad && p.Nombre)
          .map(prepararPrestador);
        setPrestadores(filas);
        setCargando(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError('No se pudo cargar la cartilla de prestadores.');
        setCargando(false);
      });

    return () => controlador.abort();
  }, []);

  return { prestadores, cargando, error };
}
