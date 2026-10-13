import { forwardRef, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text as RNText, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores, familiaPorPeso, fuente, radio } from '../constants/tema';
import { colorEstado, etiquetaEstado, iconoEstado } from '../constants/estados';

// Text de la app: con familias de Nunito cada peso es su propia fuente, así que traduce `fontWeight` a la
// familia que toca (y lo quita, para que Android no lo combine). Todas las pantallas importan Text de aquí.
export function Text({ style, ...props }) {
  const { fontWeight, ...resto } = StyleSheet.flatten(style) ?? {};
  return <RNText {...props} style={{ ...resto, fontFamily: resto.fontFamily ?? familiaPorPeso(fontWeight) }} />;
}

// Los íconos van junto a texto visible, así que se ocultan al lector de pantalla.
export function Icono({ nombre, tamano = 20, color = colores.texto, estilo }) {
  return (
    <Ionicons
      name={nombre}
      size={tamano}
      color={color}
      style={estilo}
      aria-hidden
    />
  );
}

// Tarjeta plana con filo fino: la profundidad se reserva para lo que se toca (boletas, botones).
export const estiloTarjeta = {
  backgroundColor: colores.tarjeta,
  borderRadius: radio.grande,
  padding: 16,
  borderWidth: 1,
  borderColor: colores.borde,
};

const VARIANTES = {
  primario: { fondo: colores.primario, presionado: colores.primarioOscuro, texto: '#fff', borde: colores.primario },
  secundario: { fondo: '#fff', presionado: colores.acentoSuave, texto: colores.primarioOscuro, borde: colores.primario },
  peligro: { fondo: colores.peligro, presionado: '#8c1d18', texto: '#fff', borde: colores.peligro },
  peligroSuave: { fondo: '#fff', presionado: colores.peligroSuave, texto: colores.peligro, borde: colores.peligro },
  fantasma: { fondo: 'transparent', presionado: colores.acentoSuave, texto: colores.primarioOscuro, borde: 'transparent' },
};

// Botón con altura mínima de 48dp, feedback al presionar y semántica completa para lectores de pantalla.
// `colorFondo` pinta el botón con un color propio (la acción de cada estado del pedido).
export function Boton({ titulo, onPress, variante = 'primario', icono, deshabilitado, cargando, etiqueta, estilo, colorFondo }) {
  const v = colorFondo ? { fondo: colorFondo, presionado: colorFondo, texto: '#fff', borde: colorFondo } : VARIANTES[variante];
  const inactivo = Boolean(deshabilitado || cargando);
  const colorTexto = deshabilitado ? '#5a6268' : v.texto;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta ?? titulo}
      aria-disabled={inactivo}
      aria-busy={Boolean(cargando)}
      disabled={inactivo}
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
      style={({ pressed }) => [
        s.boton,
        { backgroundColor: pressed ? v.presionado : v.fondo, borderColor: v.borde },
        pressed && s.botonPresionado,
        variante === 'primario' && !colorFondo && !inactivo && s.botonSombra,
        pressed && colorFondo && s.botonSobrio,
        deshabilitado && s.botonOff,
        estilo,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={v.texto} />
      ) : icono ? (
        <Icono nombre={icono} tamano={20} color={colorTexto} />
      ) : null}
      <Text style={[s.botonTexto, { color: colorTexto }]}>{titulo}</Text>
    </Pressable>
  );
}

// Campo con etiqueta siempre visible (el placeholder solo ejemplifica), estado de foco y error anunciado.
export const Campo = forwardRef(function Campo(
  { etiqueta, ayuda, error, bloqueado, izquierda, derecha, estilo, estiloInput, onFocus, onBlur, ...props },
  ref
) {
  const [foco, setFoco] = useState(false);
  return (
    <View style={[s.campo, estilo]}>
      <Text style={s.etiqueta}>{etiqueta}</Text>
      <View style={[s.caja, foco && s.cajaFoco, Boolean(error) && s.cajaError, bloqueado && s.cajaBloqueada]}>
        {izquierda}
        <TextInput
          ref={ref}
          placeholderTextColor={colores.placeholder}
          {...props}
          style={[s.input, estiloInput]}
          accessibilityLabel={etiqueta}
          accessibilityHint={ayuda}
          editable={!bloqueado}
          onFocus={(e) => { setFoco(true); onFocus?.(e); }}
          onBlur={(e) => { setFoco(false); onBlur?.(e); }}
        />
        {derecha}
      </View>
      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>{error}</Text>
      ) : ayuda ? (
        <Text style={s.ayuda}>{ayuda}</Text>
      ) : null}
    </View>
  );
});

// Etiqueta de estado: color sólido + ícono + palabra, para que el color nunca sea el único indicador.
export function Insignia({ estado, estilo }) {
  const etiqueta = etiquetaEstado[estado] ?? estado;
  const color = colorEstado[estado] ?? colores.tenue;
  return (
    <View
      accessible
      accessibilityLabel={`Estado: ${etiqueta}`}
      style={[s.insignia, { backgroundColor: color }, estilo]}
    >
      <View style={s.insigniaIcono}>
        <Icono nombre={iconoEstado[estado] ?? 'ellipse-outline'} tamano={12} color={color} />
      </View>
      <Text style={s.insigniaTexto}>{etiqueta}</Text>
    </View>
  );
}

// El número de pedido es texto normal en negrita: sin placa ni caja.
export function NumeroPedido({ numero, estilo }) {
  return (
    <Text accessibilityLabel={`Pedido número ${numero}`} style={[s.numeroPedido, estilo]}>
      Pedido #{numero}
    </Text>
  );
}

export function Titulo({ children, estilo }) {
  return <Text accessibilityRole="header" style={[s.titulo, estilo]}>{children}</Text>;
}

// Un dato con ícono y su nombre encima del valor.
export function FilaDato({ icono, titulo, children }) {
  return (
    <View style={s.fila}>
      <View style={s.filaIcono}>
        <Icono nombre={icono} tamano={18} color={colores.primarioOscuro} />
      </View>
      <View style={s.filaCuerpo}>
        <Text style={s.filaTitulo}>{titulo}</Text>
        {children}
      </View>
    </View>
  );
}

const AVISOS = {
  error: { fondo: colores.peligroSuave, borde: '#efb8b3', texto: '#7a1b14', icono: 'alert-circle', color: colores.peligro, alerta: true },
  alerta: { fondo: '#fff4e0', borde: '#f1cf9b', texto: '#5c3300', icono: 'alert-circle', color: colores.naranja, alerta: true },
  info: { fondo: colores.acentoSuave, borde: '#b6e3f5', texto: colores.texto, icono: 'information-circle', color: colores.primarioOscuro },
  ok: { fondo: '#e6f6ec', borde: '#b3dcc3', texto: '#14482c', icono: 'checkmark-circle', color: colores.verde },
};

// Recuadro de aviso: fondo teñido con su propio filo e ícono. Sin franja de color a un lado.
export function Aviso({ tipo = 'info', icono, children, estilo }) {
  const a = AVISOS[tipo];
  return (
    <View
      accessibilityRole={a.alerta ? 'alert' : undefined}
      accessibilityLiveRegion={a.alerta ? 'polite' : undefined}
      style={[s.aviso, { backgroundColor: a.fondo, borderColor: a.borde }, estilo]}
    >
      <Icono nombre={icono ?? a.icono} tamano={20} color={a.color} />
      <View style={s.avisoCuerpo}>
        {typeof children === 'string' ? <Text style={[s.avisoTexto, { color: a.texto }]}>{children}</Text> : children}
      </View>
    </View>
  );
}

// Rayas de velocidad, tomadas de las barras del logo: tres franjas inclinadas. Se recortan en el contenedor.
export function Rayas({ color = '#fff', opacidad = 0.16, estilo }) {
  return (
    <View pointerEvents="none" aria-hidden style={[s.rayas, estilo]}>
      {[38, 18, 8].map((ancho, i) => (
        <View
          key={ancho}
          style={{
            width: ancho,
            height: '140%',
            marginLeft: i === 0 ? 0 : 16,
            backgroundColor: color,
            opacity: opacidad,
            transform: [{ skewX: '-24deg' }],
          }}
        />
      ))}
    </View>
  );
}

// Cabecera celeste con esquinas inferiores redondeadas. Quien la usa le suma el safe area de arriba.
export function Cabecera({ children, estilo }) {
  return <View style={[s.cabecera, estilo]}>{children}</View>;
}

// Botón grande de la pantalla de negocios: celeste, con franjas inclinadas y la flecha en un recuadro blanco.
export function BotonEncargo({ titulo, subtitulo, onPress, estilo }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${subtitulo}`}
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
      style={({ pressed }) => [s.encargo, pressed && s.encargoPresionado, estilo]}
    >
      <Rayas estilo={s.encargoRayas} opacidad={0.14} />
      <View style={s.encargoTextos}>
        <Text style={s.encargoTitulo}>{titulo}</Text>
        <Text style={s.encargoSubtitulo}>{subtitulo}</Text>
      </View>
      <View style={s.encargoFlecha}>
        <Icono nombre="arrow-forward" tamano={20} color={colores.primario} />
      </View>
    </Pressable>
  );
}

const DASHES = Array.from({ length: 56 });

// La boleta de pedido (cupón): tarjeta con línea punteada y muescas laterales sobre el borde, sin filo propio. `pie` va debajo de la línea punteada.
// `fondo` es el color de la pantalla (las muescas se pintan de ese color para parecer recortes).
export function Boleta({ children, pie, estilo, fondo = colores.fondo }) {
  return (
    <View style={[s.boleta, estilo]}>
      <View style={s.boletaCuerpo}>{children}</View>
      {pie ? (
        <>
          <View style={s.perforacion} aria-hidden>
            <View style={[s.muesca, { left: -10, backgroundColor: fondo }]} />
            <View style={s.dashes}>
              {DASHES.map((_, i) => <View key={i} style={s.dash} />)}
            </View>
            <View style={[s.muesca, { right: -10, backgroundColor: fondo }]} />
          </View>
          <View style={s.boletaPie}>{pie}</View>
        </>
      ) : null}
    </View>
  );
}

// Entrada de una lista: sube 14px y aparece una sola vez, con ease-out fuerte. Se salta si el usuario
// pidió reducir el movimiento. Solo anima los primeros elementos para no entretener a quien ya sabe qué busca.
export function Entrada({ indice = 0, children, estilo }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reducir) => {
      if (!vivo) return;
      if (reducir || indice > 7) {
        v.setValue(1);
        return;
      }
      Animated.timing(v, {
        toValue: 1,
        duration: 280,
        delay: indice * 45,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
    return () => { vivo = false; };
  }, []);
  return (
    <Animated.View
      style={[estilo, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}

const web = Platform.select({ web: { outlineStyle: 'none' }, default: {} });

const s = StyleSheet.create({
  boton: {
    minHeight: 52,
    borderRadius: radio.medio,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  botonPresionado: { transform: [{ scale: 0.985 }] },
  botonSobrio: { opacity: 0.88 },
  botonSombra: {
    elevation: 3,
    shadowColor: colores.primario,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
  botonOff: { backgroundColor: '#dfe3e6', borderColor: '#dfe3e6' },
  botonTexto: { fontFamily: fuente.extra, fontSize: 16 },

  campo: { marginBottom: 14 },
  etiqueta: { fontFamily: fuente.negrita, fontSize: 14, color: colores.texto, marginBottom: 6 },
  caja: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colores.bordeCampo,
    borderRadius: radio.medio,
    paddingHorizontal: 14,
  },
  cajaFoco: { borderColor: colores.primario },
  cajaError: { borderColor: colores.peligro },
  cajaBloqueada: { backgroundColor: '#eceff1' },
  input: { flex: 1, fontFamily: fuente.media, fontSize: 16, color: colores.texto, paddingVertical: 12, ...web },
  ayuda: { fontFamily: fuente.media, fontSize: 13, color: colores.tenue, marginTop: 6 },
  error: { fontFamily: fuente.negrita, fontSize: 13, color: colores.peligro, marginTop: 6 },

  insignia: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingVertical: 4,
    paddingLeft: 6,
    paddingRight: 10,
  },
  insigniaIcono: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  insigniaTexto: { color: '#fff', fontFamily: fuente.negrita, fontSize: 13 },

  numeroPedido: { fontFamily: fuente.negrita, fontSize: 16, color: colores.texto },

  titulo: { fontFamily: fuente.extra, fontSize: 20, color: colores.texto },

  fila: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
  filaIcono: {
    width: 34,
    height: 34,
    borderRadius: radio.medio,
    backgroundColor: colores.acentoSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filaCuerpo: { flex: 1 },
  filaTitulo: { fontFamily: fuente.negrita, fontSize: 13, color: colores.suave },

  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: radio.medio, padding: 12 },
  avisoCuerpo: { flex: 1 },
  avisoTexto: { fontFamily: fuente.media, fontSize: 14, lineHeight: 20 },

  rayas: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },

  cabecera: {
    backgroundColor: colores.primario,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    paddingHorizontal: 18,
    paddingBottom: 20,
  },

  encargo: {
    minHeight: 66,
    borderRadius: 20,
    backgroundColor: colores.primario,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    overflow: 'hidden',
  },
  encargoPresionado: { backgroundColor: colores.primarioOscuro },
  encargoRayas: { right: 56 },
  encargoTextos: { flex: 1 },
  encargoTitulo: { fontFamily: fuente.extra, fontSize: 16, color: '#fff' },
  encargoSubtitulo: { fontFamily: fuente.media, fontSize: 12.5, color: '#fff' },
  encargoFlecha: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },

  // Sin borde ni overflow:hidden: las muescas sobresalen a medias del borde de la tarjeta.
  boleta: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.grande,
    elevation: 1,
    shadowColor: '#0b2530',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  boletaCuerpo: { padding: 16, paddingBottom: 14 },
  boletaPie: { padding: 16, paddingTop: 12 },
  perforacion: { height: 20, justifyContent: 'center' },
  muesca: { position: 'absolute', width: 20, height: 20, borderRadius: 10, top: 0 },
  dashes: { flexDirection: 'row', justifyContent: 'space-between', overflow: 'hidden', marginHorizontal: 16 },
  dash: { width: 5, height: 1.5, backgroundColor: '#c3ced5' },
});
