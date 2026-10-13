// Paleta tomada del logo: negro + azul cielo. Todos los pares texto/fondo cumplen WCAG AA (4.5:1) y los
// bordes de controles 3:1; si cambias un valor, vuelve a comprobarlo.
export const colores = {
  // Azul para rellenos con texto blanco y textos sobre fondo claro (4.7:1 con blanco).
  primario: '#007cab',
  // Estado "presionado" y texto azul sobre fondos celestes (5.9:1 con acentoSuave).
  primarioOscuro: '#005f84',
  // Azul del logo: detalles decorativos (nunca para texto sobre fondo claro).
  acento: '#00b2ec',
  acentoSuave: '#e0f5fd',
  negro: '#0a0a0a',
  fondo: '#f3f6f8',
  tarjeta: '#fff',
  texto: '#1b1b1b',
  tenue: '#5c5c5c',
  suave: '#6b6b6b',
  placeholder: '#757575',
  // Separadores decorativos (no llevan información).
  borde: '#e3e8ec',
  // Borde de campos y controles: 3:1 contra el blanco.
  bordeCampo: '#8a8a8a',
  verde: '#23744a',
  naranja: '#b45309',
  peligro: '#b3261e',
  peligroSuave: '#fdecea',
};

export const radio = { chico: 10, medio: 14, grande: 20, pastilla: 999 };

export const sombraTarjeta = {
  elevation: 2,
  shadowColor: '#0b2530',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
};

// Opciones de navegación compartidas: cabeceras blancas con texto oscuro.
export const opcionesCabecera = {
  headerStyle: { backgroundColor: colores.tarjeta },
  headerTintColor: colores.texto,
  headerTitleStyle: { fontWeight: 'bold' },
  headerShadowVisible: false,
};
