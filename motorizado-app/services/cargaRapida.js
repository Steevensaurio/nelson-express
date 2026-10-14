// Cuánto dura «reciente» una carga guardada: dentro de este plazo al volver a una pantalla no se pide nada.
export const MAX_EDAD_MS = 60000;

// Qué hacer al entrar a una pantalla: con datos recientes no se pide nada, con datos viejos se muestran
// y se refrescan por detrás, y sin datos se carga (con esqueleto). `maxEdad` 0 = siempre refresca.
export const decidirCarga = ({ hayDatos, edadMs, maxEdad }) => {
  if (!hayDatos) return 'cargar';
  return edadMs < maxEdad ? 'mostrar-y-saltar' : 'mostrar-y-refrescar';
};

// Orden de las peticiones de una pantalla (una por clave):
// - pedir(): si ya hay una en vuelo no empieza otra (el sondeo y el foco no se apilan).
// - pedir({ forzar: true }): igual, pero si hay una en vuelo deja UNA repetición al terminar, porque algo cambió
//   (aviso en tiempo real, error al avanzar un estado, tirar para refrescar) y esa respuesta pudo salir antes del cambio.
// - invalidarRespuestasAnteriores(): lo que ya iba en camino se descarta (llega con `descartada: true`); se usa al
//   cambiar los datos a mano para que una respuesta vieja no los pise.
// `cargar()` devuelve una promesa; `alResultado({ valor | error, descartada })` se llama por cada petición terminada.
// La promesa de pedir() nunca falla: termina cuando acaba la petición (y su repetición, si la hay).
export const crearCargador = ({ cargar, alResultado }) => {
  let actual = null;
  let repetir = false;
  let version = 0;

  const pedir = ({ forzar = false } = {}) => {
    if (actual) {
      if (forzar) repetir = true;
      return actual;
    }
    actual = (async () => {
      do {
        repetir = false;
        const salio = version;
        let resultado;
        try {
          resultado = { valor: await cargar() };
        } catch (error) {
          resultado = { error };
        }
        alResultado({ ...resultado, descartada: salio !== version });
      } while (repetir);
    })().finally(() => { actual = null; });
    return actual;
  };

  const invalidarRespuestasAnteriores = () => { version += 1; };

  return { pedir, invalidarRespuestasAnteriores };
};

// Función de carga de un cargador: mientras su `clave` sea la de la pantalla usa (y recuerda) la más reciente;
// cuando la pantalla ya cambió de clave sigue usando la última de la suya, para que una repetición pendiente
// no pida los datos de la clave nueva y los guarde bajo la vieja.
export const fnVigente = ({ clave, claveActual, fnActual }) => {
  let ultima = fnActual();
  return () => {
    if (claveActual() === clave) ultima = fnActual();
    return ultima;
  };
};
