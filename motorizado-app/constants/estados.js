export const siguienteEstado = {
  ACEPTADO: 'RECOGIDO',
  PENDIENTE: 'RECOGIDO',
  RECOGIDO: 'EN_CAMINO',
  EN_CAMINO: 'ENTREGADO',
};

// Color del botón que lleva al SIGUIENTE estado (el naranja de la insignia es muy claro para texto blanco).
export const colorAccion = {
  RECOGIDO: '#c9730d',
  EN_CAMINO: '#1e6fe0',
  ENTREGADO: '#2e8b57',
};

export const colorEstado = {
  PENDIENTE: '#999',
  ACEPTADO: '#999',
  RECOGIDO: '#e08a1e',
  EN_CAMINO: '#1e6fe0',
  ENTREGADO: '#2e8b57',
  CANCELADO: '#c0392b',
};

export const esFinal = (estado) => estado === 'ENTREGADO' || estado === 'CANCELADO';
