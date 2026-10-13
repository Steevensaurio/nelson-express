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
