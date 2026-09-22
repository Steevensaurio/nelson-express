import { createContext, useContext, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);

  const login = (nuevoToken) => {
    api.defaults.headers.common['Authorization'] = `Bearer ${nuevoToken}`;
    setToken(nuevoToken);
  };

  const logout = () => {
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
