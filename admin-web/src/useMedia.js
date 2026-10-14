import { useSyncExternalStore } from 'react';

// Límites del diseño (px). Única fuente para el JS; los @media de styles.css repiten estos números
// (cada uno lleva el comentario "mantener igual que BP en useMedia.js").
export const BP = {
  tablet: 768, // menú plegable debajo; tablas de Ganancias desde aquí
  tablaDespacho: 1280, // la tabla de Despacho desde aquí; debajo, tarjetas
};

export const anchoMinimo = (px) => `(min-width: ${px}px)`;

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
