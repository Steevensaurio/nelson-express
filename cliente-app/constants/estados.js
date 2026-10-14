import { colores } from './tema';

// Mismos tonos de siempre (gris, naranja, azul, verde, rojo), oscurecidos lo justo para que el texto
// blanco se lea (4.5:1). El estado nunca va solo en color: siempre lleva ícono y palabra.
export const colorEstado = {
  PENDIENTE: colores.neutro,
  ACEPTADO: colores.neutro,
  RECOGIDO: colores.naranja,
  EN_CAMINO: colores.enCamino,
  ENTREGADO: colores.verde,
  CANCELADO: colores.peligro,
};

export const etiquetaEstado = {
  PENDIENTE: 'Pendiente',
  ACEPTADO: 'Aceptado',
  RECOGIDO: 'Recogido',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

export const iconoEstado = {
  PENDIENTE: 'time-outline',
  ACEPTADO: 'checkmark-circle-outline',
  RECOGIDO: 'bag-check-outline',
  EN_CAMINO: 'navigate',
  ENTREGADO: 'checkmark-circle',
  CANCELADO: 'close-circle',
};

export const esFinal = (estado) => estado === 'ENTREGADO' || estado === 'CANCELADO';
