import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { CLAVE_REFRESH, CLAVE_TOKEN, registrarAlRenovar, registrarCierreDeSesion } from './api';
import { debeCerrarSesion } from './renovacion';

const AuthContext = createContext(null);

const aplicarToken = (token) => {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
};

// ¿Hay algo guardado de una sesión anterior en esta pestaña? (se lee una vez, al montar)
const haySesionGuardada = () => Boolean(sessionStorage.getItem(CLAVE_TOKEN) || sessionStorage.getItem(CLAVE_REFRESH));

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [token, setToken] = useState(null);
  const [cargando, setCargando] = useState(haySesionGuardada);
  // El perfil no se pudo pedir por falta de red o servidor dormido (5xx): la sesión guardada se conserva.
  const [sinConexion, setSinConexion] = useState(false);

  const logout = useCallback(() => {
    sessionStorage.removeItem(CLAVE_TOKEN);
    sessionStorage.removeItem(CLAVE_REFRESH);
    aplicarToken(null);
    setUsuario(null);
    setToken(null);
  }, []);

  // Si el refresh es rechazado (4xx) la sesión ya no sirve; el interceptor de api.js avisa una sola vez.
  useEffect(() => { registrarCierreDeSesion(logout); }, [logout]);

  // Tras una renovación el estado `token` cambia y el WebSocket se reconecta con el access nuevo.
  // Solo con sesión abierta: durante la restauración o tras cerrar sesión se ignora.
  useEffect(() => { registrarAlRenovar((access) => setToken((actual) => (actual ? access : actual))); }, []);

  // Al recargar la página, se recupera la sesión y se confirma que sigue teniendo la capacidad.
  // Si el access venció, el interceptor lo renueva con el refresh antes de responder.
  const restaurar = useCallback(async () => {
    if (!haySesionGuardada()) { setCargando(false); return; }
    setSinConexion(false);
    setCargando(true);
    aplicarToken(sessionStorage.getItem(CLAVE_TOKEN));
    try {
      const { data } = await api.get('/perfil/', { timeout: 60000 }); // arranque en frío de Render
      if (!data.es_despachador) logout();
      else {
        setUsuario(data);
        setToken(sessionStorage.getItem(CLAVE_TOKEN));
      }
    } catch (error) {
      // Solo un rechazo del servidor (400/401/403) invalida la sesión; sin red, con el servidor dormido, 408 o 429 se espera.
      if (!debeCerrarSesion(error)) {
        setSinConexion(true);
        return;
      }
      logout();
    }
    setCargando(false);
  }, [logout]);

  useEffect(() => { restaurar(); }, [restaurar]);

  const login = async (username, password) => {
    // Un arranque en frío de Render puede tardar casi un minuto: más que el timeout global.
    const { data: tokens } = await api.post('/token/', { username, password }, { timeout: 60000 });
    aplicarToken(tokens.access);
    try {
      const { data: perfil } = await api.get('/perfil/');
      if (!perfil.es_despachador) throw new Error('SIN_ACCESO');
      sessionStorage.setItem(CLAVE_TOKEN, tokens.access);
      sessionStorage.setItem(CLAVE_REFRESH, tokens.refresh);
      setUsuario(perfil);
      setToken(tokens.access);
      setSinConexion(false);
      setCargando(false);
    } catch (err) {
      aplicarToken(null);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ usuario, token, cargando, sinConexion, reintentar: restaurar, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
