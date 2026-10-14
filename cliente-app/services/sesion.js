import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// La sesión (access + refresh) se guarda cifrada en el móvil (Keychain / Keystore) y en
// localStorage en la web. Nunca lanza: si el almacenamiento falla, la app simplemente pide login.
const CLAVE = 'nelson-sesion';
const web = Platform.OS === 'web';

export async function guardarSesion({ access, refresh }) {
  const valor = JSON.stringify({ access, refresh });
  try {
    if (web) localStorage.setItem(CLAVE, valor);
    else await SecureStore.setItemAsync(CLAVE, valor);
  } catch {}
}

export async function leerSesion() {
  try {
    const valor = web ? localStorage.getItem(CLAVE) : await SecureStore.getItemAsync(CLAVE);
    const { access, refresh } = JSON.parse(valor);
    return access || refresh ? { access, refresh } : null;
  } catch {
    return null;
  }
}

export async function borrarSesion() {
  try {
    if (web) localStorage.removeItem(CLAVE);
    else await SecureStore.deleteItemAsync(CLAVE);
  } catch {}
}
