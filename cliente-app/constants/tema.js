// Paleta tomada del logo: negro + azul cielo. Todos los pares texto/fondo cumplen WCAG AA (4.5:1) y los
// bordes de controles 3:1; si cambias un valor, vuelve a comprobarlo.
export const colores = {
  // Azul para rellenos con texto blanco y textos sobre fondo claro (4.7:1 con blanco).
  primario: '#007cab',
  // Estado "presionado" y texto azul sobre fondos celestes (5.9:1 con acentoSuave).
  primarioOscuro: '#005f84',
  // Azul del logo: detalles decorativos y texto sobre negro (7.4:1), nunca texto sobre fondo claro.
  acento: '#00b2ec',
  acentoSuave: '#e0f5fd',
  // El negro del logo: solo en piezas pequeñas y de alto contraste (textos e íconos pequeños).
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

// Tipografía única: Nunito. Cada peso es su propia familia (con una familia personalizada no se usa
// fontWeight); `familiaPorPeso` traduce un fontWeight a su familia y lo usa el componente Text de ui.js.
export const fuente = {
  normal: 'Nunito_400Regular',
  media: 'Nunito_600SemiBold',
  negrita: 'Nunito_700Bold',
  extra: 'Nunito_800ExtraBold',
};

export function familiaPorPeso(peso) {
  switch (String(peso ?? '400')) {
    case '500':
    case '600':
      return fuente.media;
    case '700':
    case 'bold':
      return fuente.negrita;
    case '800':
    case '900':
      return fuente.extra;
    default:
      return fuente.normal;
  }
}

export const radio = { chico: 8, medio: 12, grande: 16, pastilla: 999 };

export const sombraTarjeta = {
  elevation: 1,
  shadowColor: '#0b2530',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 6,
};

// Opciones de navegación compartidas: cabeceras blancas con texto oscuro.
export const opcionesCabecera = {
  headerStyle: { backgroundColor: colores.tarjeta },
  headerTintColor: colores.texto,
  headerTitleStyle: { fontFamily: fuente.extra, fontSize: 20 },
  headerShadowVisible: false,
};
