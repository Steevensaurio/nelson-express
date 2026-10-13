// Mismos tonos de siempre (gris, naranja, azul, verde, rojo), oscurecidos lo justo para que el texto
// blanco se lea (4.5:1). El estado nunca va solo en color: siempre lleva ícono y palabra.
export const colorEstado = {
  PENDIENTE: '#5b6670',
  ACEPTADO: '#5b6670',
  RECOGIDO: '#b45309',
  EN_CAMINO: '#1a5fc4',
  ENTREGADO: '#23744a',
  CANCELADO: '#b3261e',
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
