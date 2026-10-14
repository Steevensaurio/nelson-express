import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { decidirCarga } from '../services/cargaRapida';
import { edad, generacion, guardar, leer } from '../services/cache';

const LENTO_MS = 5000;

// Carga "primero lo guardado, luego lo nuevo": si ya hay datos (caché o `inicial`) se pintan al instante y se
// refrescan por detrás; solo sin datos hay `cargando` (esqueleto). `cargarFn` debe devolver los datos (no undefined)
// y lanzar si falla. Con datos a la vista un fallo solo deja `error`: los datos no se borran.
// `recargar()` sirve para tirar-para-refrescar, avisos en tiempo real y sondeo; `actualizar(valor | fn)` cambia datos y caché a mano.
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
  const montado = useRef(true);
  const pendiente = useRef(null); // la petición en curso: si llega otra orden mientras tanto se reutiliza
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  const recargar = useCallback(() => {
    if (pendiente.current?.clave === clave) return pendiente.current.promesa;
    const vuelta = generacion();
    const primera = datosRef.current === undefined;
    const reloj = primera ? setTimeout(() => { if (montado.current) setLento(true); }, LENTO_MS) : null;
    const mia = { clave };
    pendiente.current = mia;
    setEnVuelo((n) => n + 1);
    if (primera) setFallo({ clave, e: null });
    mia.promesa = (async () => {
      try {
        const valor = await fn.current();
        if (generacion() !== vuelta) return; // se cerró sesión mientras tanto: esa respuesta ya no es de este usuario
        guardar(clave, valor);
        if (montado.current) {
          setDato({ clave, valor });
          setFallo({ clave, e: null });
        }
      } catch (e) {
        if (generacion() === vuelta && montado.current) setFallo({ clave, e });
      } finally {
        clearTimeout(reloj);
        if (pendiente.current === mia) pendiente.current = null;
        if (montado.current) {
          setEnVuelo((n) => n - 1);
          setLento(false);
        }
      }
    })();
    return mia.promesa;
  }, [clave]);

  const actualizar = useCallback((cambio) => {
    const valor = typeof cambio === 'function' ? cambio(datosRef.current) : cambio;
    guardar(clave, valor);
    setDato({ clave, valor });
  }, [clave]);

  useFocusEffect(useCallback(() => {
    const guardado = leer(clave);
    // Otra pantalla pudo haber actualizado la misma clave (p. ej. "Mis datos" guarda el perfil).
    if (inicial === undefined && guardado !== undefined && guardado !== datosRef.current) setDato({ clave, valor: guardado });
    const hayDatos = datosRef.current !== undefined || guardado !== undefined;
    if (decidirCarga({ hayDatos, edadMs: edad(clave), maxEdad }) !== 'mostrar-y-saltar') recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, maxEdad, recargar]));

  useFocusEffect(useCallback(() => {
    if (!intervalo) return undefined;
    const id = setInterval(recargar, intervalo);
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
