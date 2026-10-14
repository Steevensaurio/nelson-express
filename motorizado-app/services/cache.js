// Caché en memoria para mostrar lo último conocido al instante. Se vacía al cerrar sesión
// para que otro usuario nunca vea datos del anterior.
const datos = new Map();
let vuelta = 0; // cambia al vaciar: una respuesta que llega después de cerrar sesión no se guarda

export const leer = (clave) => datos.get(clave)?.valor;
export const guardar = (clave, valor) => { datos.set(clave, { valor, en: Date.now() }); };
// Milisegundos desde que se guardó la clave (Infinity si no está).
export const edad = (clave) => (datos.has(clave) ? Date.now() - datos.get(clave).en : Infinity);
export const invalidar = (clave) => { datos.delete(clave); }; // p. ej. tras crear un pedido: la lista guardada ya no sirve
export const generacion = () => vuelta;
export const limpiarCache = () => { datos.clear(); vuelta += 1; };
