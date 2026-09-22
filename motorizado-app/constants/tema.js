// Paleta tomada del logo: negro + azul cielo. Los colores de estado (constants/estados.js) NO cambian.
export const colores = {
  // Azul para rellenos con texto blanco y textos sobre fondo claro (contraste 4.7:1 con blanco).
  primario: '#007cab',
  // Azul del logo (sin uso por ahora: sirve para detalles sobre fondo oscuro).
  acento: '#00b2ec',
  acentoSuave: '#e0f5fd',
  negro: '#0a0a0a',
  fondo: '#f2f2f2',
  tarjeta: '#fff',
  texto: '#1b1b1b',
  tenue: '#666',
  suave: '#999',
  borde: '#e3e3e3',
  verde: '#2e8b57',
  peligro: '#c0392b',
};

export const sombraTarjeta = {
  elevation: 2,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 2,
};

// Opciones de navegación compartidas: cabeceras blancas con texto oscuro.
export const opcionesCabecera = {
  headerStyle: { backgroundColor: colores.tarjeta },
  headerTintColor: colores.texto,
  headerTitleStyle: { fontWeight: 'bold' },
  headerShadowVisible: false,
};
