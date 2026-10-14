import { colorEstado } from './estados';

// Frase humana por estado, para el detalle del pedido (CANCELADO no la usa).
export const FRASES = {
  PENDIENTE: 'Esperando confirmación',
  ACEPTADO: 'Esperando confirmación',
  RECOGIDO: 'El motorizado ya tiene tu pedido',
  EN_CAMINO: 'Tu pedido va en camino',
  ENTREGADO: '¡Tu pedido ya llegó!',
};

// Fracción (0..1) de la línea que se pinta cuando el paso `pasoActual` es el actual: la línea va del
// centro del primer círculo al del último, así que el paso 3 de 4 la llena entera.
export const anchoLinea = (pasoActual, total) => (total > 1 ? pasoActual / (total - 1) : 0);

// Todo lo recorrido (círculos, línea y halo) toma el color del estado actual.
export const colorPaso = (estado) => colorEstado[estado] ?? colorEstado.PENDIENTE;

// Halo del paso actual: el mismo tono, ya mezclado con blanco (color sólido). Un fondo semitransparente con
// borde redondeado se pinta como cuadrado en algunos teléfonos Android.
const HALOS = {
  PENDIENTE: '#dde1e4',
  ACEPTADO: '#dde1e4',
  RECOGIDO: '#f4dfc6',
  EN_CAMINO: '#cfdcf3',
  ENTREGADO: '#cfe6da',
};
export const haloPaso = (estado) => HALOS[estado] ?? HALOS.PENDIENTE;
