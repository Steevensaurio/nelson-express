import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import api from './api';
import config from '../app.json';

// Avisos push de "Nuevo pedido": el servidor los manda por Expo (Firebase en Android) al asignar una entrega.
// Solo en un celular real con el APK: en la web y en Expo Go (Android) no hay push y todo esto no hace nada.
const disponible = Platform.OS !== 'web';
const CANAL = 'pedidos'; // el mismo `channelId` que usa el servidor (backend/pedidos/push.py)

if (disponible) {
  // Con la app abierta el aviso también se muestra arriba (si no, Android lo descarta en silencio).
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
    }),
  });
}

// Pide permiso, obtiene el token de este celular y se lo da al servidor. Nunca lanza: sin permiso o sin red
// el motorizado simplemente no recibe avisos (sigue viendo sus entregas en la lista).
export async function activarAvisos() {
  if (!disponible || !Device.isDevice) return;
  try {
    if (Platform.OS === 'android') {
      // En Android 13+ el canal debe existir antes de pedir el token, o no aparece el permiso.
      await Notifications.setNotificationChannelAsync(CANAL, {
        name: 'Pedidos nuevos',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: config.expo.extra.eas.projectId });
    await api.put('/push-token/', { token });
  } catch {}
}

// Al cerrar sesión: el servidor olvida este celular. Se manda con el access de ahora (logout lo borra enseguida).
export function desactivarAvisos() {
  if (!disponible) return;
  const autorizacion = api.defaults.headers.common.Authorization;
  if (!autorizacion) return;
  api.delete('/push-token/', { headers: { Authorization: autorizacion } }).catch(() => {});
}

// Tocar un aviso (con la app abierta o en segundo plano) llama a `alTocar`. Devuelve la función para dejar de escuchar.
export function escucharToques(alTocar) {
  if (!disponible) return () => {};
  const suscripcion = Notifications.addNotificationResponseReceivedListener((respuesta) => {
    if (respuesta.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) alTocar(respuesta.notification.request.content.data);
  });
  return () => suscripcion.remove();
}
