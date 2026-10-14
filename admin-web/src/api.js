import axios from 'axios';
import { crearRenovador, debeCerrarSesion } from './renovacion';

// La sesión vive en sessionStorage (solo esta pestaña): access + refresh.
export const CLAVE_TOKEN = 'nelson-despacho-token';
export const CLAVE_REFRESH = 'nelson-despacho-refresh';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

const api = axios.create({ baseURL, timeout: 30000 });

// auth.jsx registra aquí cómo cerrar la sesión cuando ya no se puede renovar.
let alCerrarSesion = () => {};
export const registrarCierreDeSesion = (fn) => { alCerrarSesion = fn; };

// auth.jsx registra aquí cómo enterarse del access nuevo tras una renovación (para el WebSocket).
let alRenovar = () => {};
export const registrarAlRenovar = (fn) => { alRenovar = fn; };

// Despierta al servidor (Render duerme el plan gratis) sin pasar por el interceptor: se ignora todo error.
export const calentarServidor = () => { axios.get(`${baseURL}/`, { timeout: 60000 }).catch(() => {}); };

// Pide un access nuevo con el refresh guardado. Llamada simple de axios (no `api`) para no
// reentrar en el interceptor. Si el servidor responde con error, la sesión ya no sirve.
const renovar = crearRenovador({
  renovar: async () => {
    try {
      const refresh = sessionStorage.getItem(CLAVE_REFRESH);
      if (!refresh) throw Object.assign(new Error('Sin sesión guardada'), { response: { status: 401 } });
      const { data } = await axios.post(`${baseURL}/token/refresh/`, { refresh }, { timeout: 30000 });
      // Si mientras tanto se cerró la sesión (o entró otro usuario) no se escribe nada: sin `response`, no cierra nada.
      if (sessionStorage.getItem(CLAVE_REFRESH) !== refresh) throw new Error('La sesión cambió durante la renovación');
      sessionStorage.setItem(CLAVE_TOKEN, data.access);
      if (data.refresh) sessionStorage.setItem(CLAVE_REFRESH, data.refresh);
      api.defaults.headers.common.Authorization = `Bearer ${data.access}`;
      alRenovar(data.access);
      return data.access;
    } catch (error) {
      // Una sola vez por renovación fallida (no una por cada 401 concurrente).
      if (debeCerrarSesion(error)) alCerrarSesion();
      throw error;
    }
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
    // Si el servidor rechazó el refresh la sesión ya se cerró dentro de `renovar`. Si la falla fue de red o
    // 5xx (servidor despertando) se devuelve ese error, no el 401, para que nadie lo confunda con sesión vencida.
    return Promise.reject(debeCerrarSesion(errorRenovar) ? error : errorRenovar);
  }
});

export default api;
