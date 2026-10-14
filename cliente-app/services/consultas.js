import api from './api';

// Para useCargaRapida: pedir('/perfil/') devuelve la función que trae esos datos (o lanza si falla).
export const pedir = (ruta, opciones) => () => api.get(ruta, opciones).then((r) => r.data);
