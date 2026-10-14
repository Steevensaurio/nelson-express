import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { registrarAlRenovar, registrarCierreDeSesion } from '../services/api';
import { borrarSesion, guardarSesion, leerSesion } from '../services/sesion';
import { limpiarCache } from '../services/cache';

const AuthContext = createContext(null);

const accesoActual = () => api.defaults.headers.common.Authorization?.replace('Bearer ', '') || null;

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  // true hasta saber si hay una sesión guardada válida: App.js mantiene el splash mientras tanto.
  const [restaurando, setRestaurando] = useState(true);

  const login = (access, refresh) => {
    api.defaults.headers.common['Authorization'] = `Bearer ${access}`;
    guardarSesion({ access, refresh });
    setToken(access);
  };

  const logout = useCallback(() => {
    delete api.defaults.headers.common['Authorization'];
    borrarSesion();
    limpiarCache();
    setToken(null);
  }, []);

  useEffect(() => { registrarCierreDeSesion(logout); }, [logout]);

  // Tras una renovación el estado `token` se actualiza (el WebSocket se reconecta con el access nuevo).
  // Solo si hay sesión abierta: durante la restauración o tras cerrar sesión se ignora.
  useEffect(() => { registrarAlRenovar((access) => setToken((actual) => (actual ? access : actual))); }, []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const sesion = await leerSesion();
      if (sesion) {
        if (sesion.access) api.defaults.headers.common['Authorization'] = `Bearer ${sesion.access}`;
        try {
          // Si el access venció, el interceptor lo renueva con el refresh antes de responder.
          const { data } = await api.get('/perfil/', { timeout: 8000 });
          if (!data.es_motorizado) logout();
        } catch (error) {
          // Solo una respuesta del servidor (401/403…) invalida la sesión; sin red o con el servidor
          // dormido se entra con lo guardado y cada pantalla muestra su propio aviso.
          if (error.response && error.response.status < 500) logout();
        }
        const access = accesoActual();
        if (!cancelado && access) setToken(access);
      }
      if (!cancelado) setRestaurando(false);
    })();
    return () => { cancelado = true; };
  }, [logout]);

  return (
    <AuthContext.Provider value={{ token, restaurando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
