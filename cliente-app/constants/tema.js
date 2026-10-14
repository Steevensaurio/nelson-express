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
  // 4.8:1 sobre blanco y 4.5:1 sobre campoRelleno.
  placeholder: '#6b6b6b',
  // Separadores decorativos (no llevan información).
  borde: '#e3e8ec',
  // Borde de campos y controles: 3:1 contra el blanco.
  bordeCampo: '#8a8a8a',
  verde: '#23744a',
  naranja: '#b45309',
  peligro: '#b3261e',
  peligroSuave: '#fdecea',
  peligroOscuro: '#8c1d18',
  peligroBorde: '#efb8b3',
  peligroTexto: '#7a1b14',
  alertaFondo: '#fff4e0',
  alertaBorde: '#f1cf9b',
  alertaTexto: '#5c3300',
  okFondo: '#e6f6ec',
  okBorde: '#b3dcc3',
  okTexto: '#14482c',
  acentoBorde: '#b6e3f5',
  acentoPalido: '#f4fbfe',
  // Estados de pedido distintos de verde/naranja/peligro (texto blanco encima: 4.5:1 o más).
  neutro: '#5b6670',
  enCamino: '#1a5fc4',
  blanco: '#fff',
  // Login: degradado de fondo, acento de la palabra destacada y relleno de los campos.
  degradado: ['#0a9bd0', '#007cab', '#004e6e'],
  acentoClaro: '#a8e6ff',
  campoRelleno: '#f1f5f7',
  // Neutros decorativos: rellenos, pistas, trazos y sombras (no llevan texto ni información).
  relleno: '#e8edf0',
  rellenoFuerte: '#d5dde2',
  linea: '#dfe5e9',
  trazo: '#c4cbd0',
  sombra: '#0b2530',
};

// Tipografía única: Nunito. Cada peso es su propia familia (con una familia personalizada no se usa
// fontWeight); `familiaPorPeso` traduce un fontWeight a su familia y lo usa el componente Text de ui.js.
// Factor que agranda todo el texto de la app (se aplica en el componente Text de ui.js).
export const escalaTexto = 1.15;

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

export const radio = { chico: 8, medio: 12, grande: 16, hoja: 30, pastilla: 999 };

// Espaciado base (4 en 4). Los márgenes puntuales de cada pantalla se acercan a estos valores.
export const espacio = { xs: 4, s: 8, m: 12, l: 16, xl: 24 };

// Escala tipográfica (tamaños ANTES de `escalaTexto`, que el componente Text de ui.js aplica a todo).
// Se usa con `...tipo.cuerpo` dentro de un estilo; pesos solo de Nunito (fuente.*).
export const tipo = {
  display: { fontSize: 32, lineHeight: 36, fontFamily: fuente.extra }, // titular del login
  titulo: { fontSize: 22, lineHeight: 28, fontFamily: fuente.extra }, // título de pantalla, nombres grandes
  subtitulo: { fontSize: 18, lineHeight: 24, fontFamily: fuente.negrita }, // secciones y títulos de tarjeta
  cuerpo: { fontSize: 15, lineHeight: 21, fontFamily: fuente.media }, // texto corriente
  cuerpoFuerte: { fontSize: 15, lineHeight: 21, fontFamily: fuente.negrita },
  entrada: { fontSize: 16, lineHeight: 22, fontFamily: fuente.media }, // campos de texto y botones (16: sin zoom automático en iOS)
  apoyo: { fontSize: 13, lineHeight: 18, fontFamily: fuente.media }, // texto secundario
  etiqueta: { fontSize: 12, lineHeight: 16, fontFamily: fuente.negrita }, // rótulos y contadores
  precio: { fontSize: 24, lineHeight: 28, fontFamily: fuente.extra }, // importes destacados
  mini: { fontSize: 10.5, lineHeight: 14, fontFamily: fuente.negrita }, // rótulos del seguimiento
};

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
  headerTitleStyle: { fontFamily: fuente.extra, fontSize: Math.round(tipo.subtitulo.fontSize * escalaTexto) }, // la cabecera nativa no pasa por Text
  headerShadowVisible: false,
};
