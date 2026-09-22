export const colorEstado = {
  PENDIENTE: '#999',
  ACEPTADO: '#999',
  RECOGIDO: '#e08a1e',
  EN_CAMINO: '#1e6fe0',
  ENTREGADO: '#2e8b57',
  CANCELADO: '#c0392b',
};

export const esFinal = (estado) => estado === 'ENTREGADO' || estado === 'CANCELADO';
