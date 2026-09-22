// Conexión de tiempo real con reconexión y latido. Sin dependencias: usa el WebSocket global
// (navegador y React Native). El protocolo está documentado en backend/pedidos/consumers.py.
// Este archivo es idéntico en admin-web, cliente-app y motorizado-app: si cambia, cámbialo en los tres.

const INTERVALO_PING_MS = 25000;
const ESPERA_PONG_MS = 10000;
const ESPERA_MAXIMA_MS = 15000;
const CODIGO_NO_AUTORIZADO = 4401;

export const urlDeSocket = (apiUrl) =>
  apiUrl.replace(/^http/, 'ws').replace(/\/api\/?$/, '') + '/ws/pedidos/';

export function conectarTiempoReal({ url, token, alMensaje, alCambioDeEstado }) {
  let socket = null;
  let cerrado = false;
  let intentos = 0;
  let temporizadorReconexion = null;
  let temporizadorPing = null;
  let temporizadorPong = null;

  const detenerLatido = () => {
    clearInterval(temporizadorPing);
    clearTimeout(temporizadorPong);
  };

  const soltarSocket = () => {
    detenerLatido();
    if (!socket) return;
    socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
    try {
      socket.close();
    } catch (err) {
      // ya estaba cerrado
    }
    socket = null;
  };

  const programarReconexion = () => {
    if (cerrado) return;
    const espera = Math.min(1000 * 2 ** intentos, ESPERA_MAXIMA_MS);
    intentos += 1;
    temporizadorReconexion = setTimeout(abrir, espera);
  };

  const conexionPerdida = () => {
    soltarSocket();
    alCambioDeEstado(false);
    programarReconexion();
  };

  const iniciarLatido = () => {
    detenerLatido();
    temporizadorPing = setInterval(() => {
      if (!socket || socket.readyState !== 1) return;
      socket.send(JSON.stringify({ type: 'ping' }));
      clearTimeout(temporizadorPong);
      temporizadorPong = setTimeout(conexionPerdida, ESPERA_PONG_MS);
    }, INTERVALO_PING_MS);
  };

  function abrir() {
    if (cerrado) return;
    socket = new WebSocket(url);
    socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token }));
    socket.onmessage = (evento) => {
      let mensaje;
      try {
        mensaje = JSON.parse(evento.data);
      } catch (err) {
        return;
      }
      if (mensaje.type === 'auth_ok') {
        intentos = 0;
        iniciarLatido();
        alCambioDeEstado(true);
      } else if (mensaje.type === 'pong') {
        clearTimeout(temporizadorPong);
      } else if (mensaje.type !== 'auth_error') {
        alMensaje(mensaje);
      }
    };
    socket.onclose = (evento) => {
      if (evento.code === CODIGO_NO_AUTORIZADO) {
        // El token no sirve: reintentar no arregla nada. Se queda el sondeo hasta un nuevo login.
        cerrado = true;
        soltarSocket();
        alCambioDeEstado(false);
        return;
      }
      conexionPerdida();
    };
    socket.onerror = () => {};
  }

  abrir();

  return {
    cerrar() {
      cerrado = true;
      clearTimeout(temporizadorReconexion);
      soltarSocket();
    },
    // Para cuando la app vuelve a primer plano: el socket pudo morir sin avisar.
    reconectar() {
      if (cerrado) return;
      clearTimeout(temporizadorReconexion);
      soltarSocket();
      alCambioDeEstado(false);
      intentos = 0;
      abrir();
    },
  };
}
