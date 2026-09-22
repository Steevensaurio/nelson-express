import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from './api';

const CLAVE_TOKEN = 'nelson-despacho-token';
const AuthContext = createContext(null);

const aplicarToken = (token) => {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
};

export function AuthProvider({ children }) {
  const tokenGuardado = sessionStorage.getItem(CLAVE_TOKEN);
  const [usuario, setUsuario] = useState(null);
  const [token, setToken] = useState(null);
  const [cargando, setCargando] = useState(Boolean(tokenGuardado));

  const logout = useCallback(() => {
    sessionStorage.removeItem(CLAVE_TOKEN);
    aplicarToken(null);
    setUsuario(null);
    setToken(null);
  }, []);

  // Un 401 en cualquier petición (token vencido o inválido) cierra la sesión.
  useEffect(() => {
    const id = api.interceptors.response.use(
      (respuesta) => respuesta,
      (error) => {
        if (error.response?.status === 401 && !error.config.url.includes('/token/')) logout();
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, [logout]);

  // Al recargar la página, se recupera la sesión y se confirma que el rol sigue siendo ADMIN.
  useEffect(() => {
    if (!tokenGuardado) return;
    aplicarToken(tokenGuardado);
    api.get('/perfil/')
      .then(({ data }) => {
        if (data.rol !== 'ADMIN') return logout();
        setUsuario(data);
        setToken(tokenGuardado);
      })
      .catch(logout)
      .finally(() => setCargando(false));
  }, []);

  const login = async (username, password) => {
    const { data: tokens } = await api.post('/token/', { username, password });
    aplicarToken(tokens.access);
    try {
      const { data: perfil } = await api.get('/perfil/');
      if (perfil.rol !== 'ADMIN') throw new Error('SIN_ACCESO');
      sessionStorage.setItem(CLAVE_TOKEN, tokens.access);
      setUsuario(perfil);
      setToken(tokens.access);
    } catch (err) {
      aplicarToken(null);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ usuario, token, cargando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
