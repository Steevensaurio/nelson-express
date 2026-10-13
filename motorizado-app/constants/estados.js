export const siguienteEstado = {
  ACEPTADO: 'RECOGIDO',
  PENDIENTE: 'RECOGIDO',
  RECOGIDO: 'EN_CAMINO',
  EN_CAMINO: 'ENTREGADO',
};

// Color del botón que lleva al SIGUIENTE estado. Todos dan 4.5:1 o más con texto blanco.
export const colorAccion = {
  RECOGIDO: '#b45309',
  EN_CAMINO: '#1a5fc4',
  ENTREGADO: '#23744a',
};

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

// Texto del botón que avanza el pedido: dice qué pasa, no el nombre interno del estado.
export const textoAccion = {
  RECOGIDO: 'Ya recogí el pedido',
  EN_CAMINO: 'Voy en camino a entregar',
  ENTREGADO: 'Pedido entregado',
};

export const esFinal = (estado) => estado === 'ENTREGADO' || estado === 'CANCELADO';
