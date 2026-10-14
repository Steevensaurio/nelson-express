// Caché en memoria para mostrar lo último conocido al instante. Se vacía al cerrar sesión
// para que otro usuario nunca vea datos del anterior.
const datos = new Map();
const marcas = new Map(); // por clave: cuántas veces se invalidó
let vuelta = 0; // cambia al vaciar: una respuesta que llega después de cerrar sesión no se guarda

export const leer = (clave) => datos.get(clave)?.valor;
export const guardar = (clave, valor) => { datos.set(clave, { valor, en: Date.now() }); };
// Milisegundos desde que se guardó la clave (Infinity si no está).
export const edad = (clave) => (datos.has(clave) ? Date.now() - datos.get(clave).en : Infinity);
// p. ej. tras crear un pedido: la lista guardada ya no sirve. Además cambia la `marca` de la clave: una petición
// que salió antes de invalidar la compara con la que tenía al salir y no vuelve a guardar la lista vieja.
export const invalidar = (clave) => { datos.delete(clave); marcas.set(clave, (marcas.get(clave) || 0) + 1); };
export const marca = (clave) => marcas.get(clave) || 0;
export const generacion = () => vuelta;
export const limpiarCache = () => { datos.clear(); vuelta += 1; };
