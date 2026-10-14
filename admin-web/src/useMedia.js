import { useSyncExternalStore } from 'react';

// true mientras la media query se cumpla; se vuelve a renderizar al cruzar el límite (girar el celular, redimensionar).
export function useMedia(consulta) {
  return useSyncExternalStore(
    (avisar) => {
      const lista = window.matchMedia(consulta);
      lista.addEventListener('change', avisar);
      return () => lista.removeEventListener('change', avisar);
    },
    () => window.matchMedia(consulta).matches,
  );
}
