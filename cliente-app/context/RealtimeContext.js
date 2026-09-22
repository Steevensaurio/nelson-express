import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { conectarTiempoReal, urlDeSocket } from '../services/realtime';

const RealtimeContext = createContext(null);

// Mantiene UNA conexión por sesión y reparte los avisos a las pantallas que estén suscritas.
// Los avisos solo dicen "algo cambió": cada pantalla vuelve a pedir sus datos por la API.
export function RealtimeProvider({ children }) {
  const { token } = useAuth();
  const [conectado, setConectado] = useState(false);
  const oyentes = useRef(new Set());

  const suscribir = useCallback((oyente) => {
    oyentes.current.add(oyente);
    return () => oyentes.current.delete(oyente);
  }, []);

  useEffect(() => {
    if (!token) return;

    const notificar = (mensaje) => oyentes.current.forEach((oyente) => oyente(mensaje));
    const conexion = conectarTiempoReal({
      url: urlDeSocket(process.env.EXPO_PUBLIC_API_URL),
      token,
      alMensaje: notificar,
      alCambioDeEstado: (estado) => {
        setConectado(estado);
        // Al (re)conectar pudo haberse perdido algún aviso: se refresca por si acaso.
        if (estado) notificar({ type: 'reconectado' });
      },
    });
    const appState = AppState.addEventListener('change', (nuevo) => {
      if (nuevo === 'active') conexion.reconectar();
    });

    return () => {
      appState.remove();
      conexion.cerrar();
      setConectado(false);
    };
  }, [token]);

  const valor = useMemo(() => ({ conectado, suscribir }), [conectado, suscribir]);
  return <RealtimeContext.Provider value={valor}>{children}</RealtimeContext.Provider>;
}

export function useTiempoReal() {
  return useContext(RealtimeContext);
}
