import { useEffect, useRef, useState } from 'react';
import { conectarTiempoReal, urlDeSocket } from './realtime.js';
import api from './api';

// Mantiene abierto el socket mientras haya token y llama a `alAvisar` cada vez que el servidor dice
// "algo cambió" (o cuando la conexión se restablece, por si se perdió algún aviso). Devuelve `conectado`.
export function useTiempoReal(token, alAvisar) {
  const [conectado, setConectado] = useState(false);
  const alAvisarRef = useRef(alAvisar);
  alAvisarRef.current = alAvisar;

  useEffect(() => {
    if (!token) return undefined;

    const conexion = conectarTiempoReal({
      url: urlDeSocket(api.defaults.baseURL),
      token,
      alMensaje: (mensaje) => {
        if (mensaje.type === 'pedido_cambio') alAvisarRef.current();
      },
      alCambioDeEstado: (estado) => {
        setConectado(estado);
        if (estado) alAvisarRef.current();
      },
    });

    // Un navegador puede congelar pestañas en segundo plano y matar el socket sin avisar.
    const alVolver = () => {
      if (document.visibilityState === 'visible') conexion.reconectar();
    };
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      conexion.cerrar();
      setConectado(false);
    };
  }, [token]);

  return conectado;
}
