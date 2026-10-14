// Caché en memoria para mostrar lo último conocido al instante. Se vacía al cerrar sesión
// para que otro usuario nunca vea datos del anterior.
const datos = new Map();

export const leer = (clave) => datos.get(clave);
export const guardar = (clave, valor) => { datos.set(clave, valor); };
export const limpiarCache = () => datos.clear();
