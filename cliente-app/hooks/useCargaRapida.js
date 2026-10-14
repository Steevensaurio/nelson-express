import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { crearCargador, decidirCarga } from '../services/cargaRapida';
import { edad, generacion, guardar, leer } from '../services/cache';

const LENTO_MS = 5000;

// Carga "primero lo guardado, luego lo nuevo": si ya hay datos (caché o `inicial`) se pintan al instante y se
// refrescan por detrás; solo sin datos hay `cargando` (esqueleto). `cargarFn` debe devolver los datos (no undefined)
// y lanzar si falla. Con datos a la vista un fallo solo deja `error`: los datos no se borran.
// `recargar()` no apila peticiones (sondeo, foco); `recargar({ forzar: true })` deja una repetición si ya había una en vuelo
// (avisos en tiempo real, errores al avanzar un estado, tirar para refrescar); `recargar({ manual: true })` es una orden
// del usuario (botón Reintentar, tirar para refrescar): borra el error y muestra el esqueleto. Los reintentos de fondo
// (sondeo, foco) no tocan el error que se está mostrando. `actualizar(valor | fn)` cambia datos y caché a mano y
// descarta lo que iba en camino, para que una respuesta anterior al cambio no lo pise.
export function useCargaRapida(clave, cargarFn, { maxEdad = 0, intervalo = null, inicial } = {}) {
  const [dato, setDato] = useState({ clave, valor: inicial !== undefined ? inicial : leer(clave) });
  const [fallo, setFallo] = useState({ clave, e: null });
  const [enVuelo, setEnVuelo] = useState(0);
  const [lento, setLento] = useState(false);
  const datos = dato.clave === clave ? dato.valor : leer(clave); // al cambiar de clave se parte de lo guardado para esa clave
  const error = fallo.clave === clave ? fallo.e : null;

  const fn = useRef(cargarFn);
  fn.current = cargarFn;
  const datosRef = useRef(datos);
  datosRef.current = datos;
  const errorRef = useRef(error);
  errorRef.current = error;
  const manualRef = useRef(false);
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  // Un cargador por clave: ordena las peticiones y descarta las respuestas viejas (ver services/cargaRapida.js).
  const cargador = useMemo(() => {
    let vuelta = 0;
    const cargar = async () => {
      vuelta = generacion();
      // `lento` solo cuenta la primera carga o una orden del usuario, no los reintentos de fondo tras un fallo.
      const primera = datosRef.current === undefined && (!errorRef.current || manualRef.current);
      manualRef.current = false;
      const reloj = primera ? setTimeout(() => { if (montado.current) setLento(true); }, LENTO_MS) : null;
      if (montado.current) setEnVuelo((n) => n + 1);
      try {
        return await fn.current();
      } finally {
        clearTimeout(reloj);
        if (montado.current) {
          setEnVuelo((n) => n - 1);
          setLento(false);
        }
      }
    };
    const alResultado = (resultado) => {
      // Se descarta si salió antes de un cambio manual o si mientras tanto se cerró sesión (ya no es de este usuario).
      if (resultado.descartada || generacion() !== vuelta) return;
      if ('error' in resultado) {
        if (montado.current) setFallo({ clave, e: resultado.error });
        return;
      }
      guardar(clave, resultado.valor);
      if (montado.current) {
        setDato({ clave, valor: resultado.valor });
        setFallo({ clave, e: null });
      }
    };
    return crearCargador({ cargar, alResultado });
  }, [clave]);

  const recargar = useCallback((opciones) => {
    const { forzar = false, manual = false } = opciones ?? {};
    if (manual) {
      manualRef.current = true;
      setFallo({ clave, e: null });
    }
    return cargador.pedir({ forzar });
  }, [clave, cargador]);

  const actualizar = useCallback((cambio) => {
    const valor = typeof cambio === 'function' ? cambio(datosRef.current) : cambio;
    cargador.invalidarRespuestasAnteriores();
    guardar(clave, valor);
    setDato({ clave, valor });
  }, [clave, cargador]);

  useFocusEffect(useCallback(() => {
    const guardado = leer(clave);
    let hayDatos = datosRef.current !== undefined;
    if (inicial === undefined) {
      if (guardado !== undefined && guardado !== datosRef.current) {
        // Otra pantalla pudo haber actualizado la misma clave (p. ej. "Mis datos" guarda el perfil).
        setDato({ clave, valor: guardado });
      } else if (guardado === undefined && hayDatos) {
        // Alguien invalidó la clave (p. ej. se creó un pedido): lo que se ve ya no vale, se carga de nuevo con esqueleto.
        setDato({ clave, valor: undefined });
        setFallo({ clave, e: null });
        hayDatos = false;
      }
    }
    hayDatos = hayDatos || guardado !== undefined;
    if (decidirCarga({ hayDatos, edadMs: edad(clave), maxEdad }) !== 'mostrar-y-saltar') recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, maxEdad, recargar]));

  useFocusEffect(useCallback(() => {
    if (!intervalo) return undefined;
    const id = setInterval(() => recargar(), intervalo);
    return () => clearInterval(id);
  }, [intervalo, recargar]));

  return {
    datos,
    cargando: datos === undefined && !error,
    refrescando: enVuelo > 0 && datos !== undefined,
    error,
    recargar,
    lento,
    actualizar,
  };
}
