import axios from 'axios';
import { crearRenovador } from './renovacion';
import { guardarSesion, leerSesion } from './sesion';

const baseURL = process.env.EXPO_PUBLIC_API_URL;

const api = axios.create({ baseURL, timeout: 30000 });

// AuthContext registra aquí cómo cerrar la sesión cuando ya no se puede renovar.
let alCerrarSesion = () => {};
export const registrarCierreDeSesion = (fn) => { alCerrarSesion = fn; };

// Despierta al servidor (Render duerme el plan gratis) sin pasar por el interceptor: se ignora todo error.
export const calentarServidor = () => { axios.get(`${baseURL}/`, { timeout: 60000 }).catch(() => {}); };

// Pide un access nuevo con el refresh guardado. Llamada simple de axios (no `api`) para no
// reentrar en el interceptor. Si el servidor responde con error, la sesión ya no sirve.
const renovar = crearRenovador({
  renovar: async () => {
    const sesion = await leerSesion();
    if (!sesion?.refresh) throw Object.assign(new Error('Sin sesión guardada'), { response: { status: 401 } });
    const { data } = await axios.post(`${baseURL}/token/refresh/`, { refresh: sesion.refresh }, { timeout: 30000 });
    await guardarSesion({ access: data.access, refresh: data.refresh || sesion.refresh });
    api.defaults.headers.common.Authorization = `Bearer ${data.access}`;
    return data.access;
  },
});

const ES_DE_TOKEN = /\/token\/(refresh\/)?$/;

api.interceptors.response.use(undefined, async (error) => {
  const { config, response } = error;
  if (response?.status !== 401 || !config || config._reintentado || ES_DE_TOKEN.test(config.url || '')) {
    return Promise.reject(error);
  }
  try {
    const access = await renovar();
    config._reintentado = true;
    config.headers.Authorization = `Bearer ${access}`;
    return api(config);
  } catch (errorRenovar) {
    // Solo se cierra la sesión si el servidor rechazó el refresh; un corte de red no debe sacar al usuario.
    if (errorRenovar.response) alCerrarSesion();
    return Promise.reject(errorRenovar.response ? error : errorRenovar);
  }
});

export default api;
