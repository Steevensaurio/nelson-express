import { forwardRef, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text as RNText, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores, escalaTexto, espacio, familiaPorPeso, fuente, radio, tipo } from '../constants/tema';
import { colorEstado, etiquetaEstado, iconoEstado } from '../constants/estados';

// Text de la app: con familias de Nunito cada peso es su propia fuente, así que traduce `fontWeight` a la
// familia que toca (y lo quita, para que Android no lo combine). Todas las pantallas importan Text de aquí.
export function Text({ style, ...props }) {
  const { fontWeight, fontSize, lineHeight, ...resto } = StyleSheet.flatten(style) ?? {};
  // `escalaTexto` agranda toda la tipografía de la app a la vez (además de la letra del sistema).
  const tamano = fontSize ? { fontSize: fontSize * escalaTexto, ...(lineHeight ? { lineHeight: lineHeight * escalaTexto } : {}) } : {};
  return <RNText {...props} style={{ ...resto, ...tamano, fontFamily: resto.fontFamily ?? familiaPorPeso(fontWeight) }} />;
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
  padding: espacio.l,
  borderWidth: 1,
  borderColor: colores.borde,
};

// ── Movimiento ───────────────────────────────────────────────────────────────────────────────
// Curva de salida fuerte para todo lo que entra o responde (más punch que el `ease-out` del sistema).
export const SALIDA = Easing.bezier(0.23, 1, 0.32, 1);
const nativo = Platform.OS !== 'web';

// "Reducir movimiento" del sistema, leído una vez al cargar y mantenido al día. `null` = aún sin saber (se trata como falso).
let reduccion = null;
const reduccionLista = AccessibilityInfo.isReduceMotionEnabled().then(
  (v) => { reduccion = Boolean(v); },
  () => { reduccion = false; }
);
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => { reduccion = Boolean(v); });
export const movimientoReducido = () => reduccion === true;

// Valor 0..1 que sube una sola vez al montar el componente (de `desde` a 1). Sin animar (`activo` falso o
// reducir movimiento) arranca ya en 1: nada parpadea ni se mueve.
function useAparecer({ activo = true, desde = 0, duracion = 160, retraso = 0 } = {}) {
  const ref = useRef(null);
  if (ref.current === null) ref.current = new Animated.Value(activo && reduccion !== true ? desde : 1);
  const v = ref.current;
  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    let anim;
    reduccionLista.then(() => {
      if (!vivo) return;
      if (reduccion) {
        v.setValue(1);
        return;
      }
      anim = Animated.timing(v, { toValue: 1, duration: duracion, delay: retraso, easing: SALIDA, useNativeDriver: nativo });
      anim.start();
    });
    return () => { vivo = false; anim?.stop(); };
  }, []);
  return v;
}

const PresionableAnimado = Animated.createAnimatedComponent(Pressable);

// Pressable con retroalimentación física: se encoge a 0.97 al tocar (110 ms) y vuelve al soltar (160 ms), con ease-out.
// Pasa todas las props al Pressable (rol, etiqueta, disabled, ripple, hitSlop, testID…); `style` puede ser objeto, arreglo
// o función de `{ pressed }`. Usa solo transform (hilo nativo) y no se mueve si el usuario pidió reducir el movimiento.
// Se interrumpe sin saltos: soltar a mitad de camino regresa desde la escala actual.
export function Presionable({ style, onPressIn, onPressOut, ...props }) {
  const ref = useRef(null);
  if (ref.current === null) ref.current = new Animated.Value(1);
  const escala = ref.current;
  const [pressed, setPressed] = useState(false);
  const mover = (hacia, duracion) => {
    if (movimientoReducido()) return;
    Animated.timing(escala, { toValue: hacia, duration: duracion, easing: SALIDA, useNativeDriver: nativo }).start();
  };
  return (
    <PresionableAnimado
      {...props}
      onPressIn={(e) => { setPressed(true); mover(0.97, 110); onPressIn?.(e); }}
      onPressOut={(e) => { setPressed(false); mover(1, 160); onPressOut?.(e); }}
      style={[typeof style === 'function' ? style({ pressed }) : style, { transform: [{ scale: escala }] }]}
    />
  );
}

const VARIANTES = {
  primario: { fondo: colores.primario, presionado: colores.primarioOscuro, texto: colores.blanco, borde: colores.primario },
  secundario: { fondo: colores.tarjeta, presionado: colores.acentoSuave, texto: colores.primarioOscuro, borde: colores.primario },
  peligro: { fondo: colores.peligro, presionado: colores.peligroOscuro, texto: colores.blanco, borde: colores.peligro },
  peligroSuave: { fondo: colores.tarjeta, presionado: colores.peligroSuave, texto: colores.peligro, borde: colores.peligro },
  fantasma: { fondo: 'transparent', presionado: colores.acentoSuave, texto: colores.primarioOscuro, borde: 'transparent' },
};

// Botón con altura mínima de 48dp, feedback al presionar y semántica completa para lectores de pantalla.
export function Boton({ titulo, onPress, variante = 'primario', icono, deshabilitado, cargando, etiqueta, estilo }) {
  const v = VARIANTES[variante];
  const inactivo = Boolean(deshabilitado || cargando);
  const colorTexto = deshabilitado ? colores.tenue : v.texto;
  return (
    <Presionable
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
        variante === 'primario' && !inactivo && s.botonSombra,
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
    </Presionable>
  );
}

// Campo con etiqueta siempre visible (el placeholder solo ejemplifica), estado de foco y error anunciado.
// `relleno`: variante del login (fondo gris claro; borde de 1.5px con 3:1, que cambia de color al enfocar).
export const Campo = forwardRef(function Campo(
  { etiqueta, ayuda, error, bloqueado, relleno, izquierda, derecha, estilo, estiloInput, onFocus, onBlur, ...props },
  ref
) {
  const [foco, setFoco] = useState(false);
  return (
    <View style={[s.campo, estilo]}>
      <Text style={[s.etiqueta, relleno && s.etiquetaRelleno]}>{etiqueta}</Text>
      <View style={[s.caja, relleno && s.cajaRelleno, foco && s.cajaFoco, Boolean(error) && s.cajaError, bloqueado && s.cajaBloqueada]}>
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
export function NumeroPedido({ numero, prefijo = 'Pedido', estilo }) {
  return (
    <Text accessibilityLabel={`${prefijo} número ${numero}`} style={[s.numeroPedido, estilo]}>
      {prefijo} #{numero}
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
  error: { fondo: colores.peligroSuave, borde: colores.peligroBorde, texto: colores.peligroTexto, icono: 'alert-circle', color: colores.peligro, alerta: true },
  alerta: { fondo: colores.alertaFondo, borde: colores.alertaBorde, texto: colores.alertaTexto, icono: 'alert-circle', color: colores.naranja, alerta: true },
  info: { fondo: colores.acentoSuave, borde: colores.acentoBorde, texto: colores.texto, icono: 'information-circle', color: colores.primarioOscuro },
  ok: { fondo: colores.okFondo, borde: colores.okBorde, texto: colores.okTexto, icono: 'checkmark-circle', color: colores.verde },
};

// Recuadro de aviso: fondo teñido con su propio filo e ícono. Sin franja de color a un lado.
// Al aparecer (solo al montarse) se desvanece 160 ms subiendo 6 px, para que un aviso nuevo no «salte»; `animar={false}` lo omite.
// Los de alerta/error arrancan en 40 % de opacidad (nunca invisibles para TalkBack). Todos son región viva: el aviso de
// «servidor despertando» (info) también se anuncia al aparecer.
export function Aviso({ tipo: clase = 'info', icono, children, estilo, animar = true }) {
  const a = AVISOS[clase];
  const v = useAparecer({ activo: animar, desde: a.alerta ? 0.4 : 0, duracion: 160 });
  return (
    <Animated.View
      accessibilityRole={a.alerta ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={[
        s.aviso,
        { backgroundColor: a.fondo, borderColor: a.borde },
        estilo,
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] },
      ]}
    >
      <Icono nombre={icono ?? a.icono} tamano={20} color={a.color} />
      <View style={s.avisoCuerpo}>
        {typeof children === 'string' ? <Text style={[s.avisoTexto, { color: a.texto }]}>{children}</Text> : children}
      </View>
    </Animated.View>
  );
}

// Aviso de una carga rápida: el servidor tarda (y no hay nada que mostrar) o falló la actualización (y se muestra lo guardado).
export function AvisosCarga({ lento, error, hayDatos, estilo }) {
  if (!hayDatos && lento) {
    return <Aviso tipo="info" estilo={estilo}>El servidor está despertando, puede tardar hasta un minuto…</Aviso>;
  }
  if (hayDatos && error) {
    return <Aviso tipo="alerta" estilo={estilo}>No pudimos actualizar. Mostrando lo último guardado.</Aviso>;
  }
  return null;
}

// Bloque gris que pulsa suave mientras llegan los datos. Es decorativo (aria-hidden): quien lo contiene
// anuncia "Cargando" una sola vez. Quieto si el usuario pidió reducir el movimiento.
// Todos los bloques comparten UN valor animado y un solo bucle: pulsan en fase y cuestan una animación. El bucle arranca
// con el primer bloque montado y se detiene al desmontarse el último; con «reducir movimiento» quedan quietos.
const pulso = new Animated.Value(1);
let usosPulso = 0;
let buclePulso = null;
function iniciarPulso() {
  usosPulso += 1;
  if (usosPulso > 1) return;
  reduccionLista.then(() => {
    if (usosPulso === 0 || reduccion || buclePulso) return;
    const paso = (toValue) => Animated.timing(pulso, { toValue, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: nativo });
    buclePulso = Animated.loop(Animated.sequence([paso(0.55), paso(1)]));
    buclePulso.start();
  });
}
function detenerPulso() {
  usosPulso -= 1;
  if (usosPulso > 0) return;
  buclePulso?.stop();
  buclePulso = null;
  pulso.setValue(1);
}

export function Esqueleto({ ancho = '100%', alto = 16, radio: borde = radio.chico, estilo }) {
  useEffect(() => {
    iniciarPulso();
    return detenerPulso;
  }, []);
  return <Animated.View aria-hidden style={[{ width: ancho, height: alto, borderRadius: borde, backgroundColor: colores.borde, opacity: pulso }, estilo]} />;
}

// Rayas de velocidad, tomadas de las barras del logo: tres franjas inclinadas. Se recortan en el contenedor.
export function Rayas({ color = colores.blanco, opacidad = 0.16, estilo }) {
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
    <Presionable
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${subtitulo}`}
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
      style={({ pressed }) => [s.encargo, pressed && s.encargoPresionado, estilo]}
    >
      <Rayas estilo={s.encargoRayas} opacidad={0.16} />
      <View style={s.encargoIcono}>
        <Icono nombre="cube-outline" tamano={28} color={colores.blanco} />
      </View>
      <View style={s.encargoTextos}>
        <Text style={s.encargoTitulo}>{titulo}</Text>
        <Text style={s.encargoSubtitulo}>{subtitulo}</Text>
      </View>
      <View style={s.encargoFlecha}>
        <Icono nombre="arrow-forward" tamano={24} color={colores.primario} />
      </View>
    </Presionable>
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

// Entrada de contenido, una sola vez al montarse y solo si `animar` (por defecto sí).
// tipo 'subir' (por defecto, la hoja del login): sube 14 px y aparece, 280 ms.
// tipo 'fundido' (filas de una lista que llegan tras el esqueleto): solo opacidad, 160 ms, desde 40 % para que nunca
// se vea un hueco, con un escalonado de 30 ms por fila hasta 150 ms. Las listas pasan `animar={false}` si ya tenían datos
// guardados (nada que anunciar). Solo anima las primeras filas; sin movimiento si el usuario lo pidió.
export function Entrada({ indice = 0, children, estilo, animar = true, tipo = 'subir' }) {
  const fundido = tipo === 'fundido';
  const v = useAparecer({
    activo: animar && indice <= 7,
    desde: fundido ? 0.4 : 0,
    duracion: fundido ? 160 : 280,
    retraso: fundido ? Math.min(indice * 30, 150) : indice * 45,
  });
  const animado = fundido
    ? { opacity: v }
    : { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] };
  return <Animated.View style={[estilo, animado]}>{children}</Animated.View>;
}

const web = Platform.select({ web: { outlineStyle: 'none' }, default: {} });

const s = StyleSheet.create({
  boton: {
    minHeight: 52,
    borderRadius: radio.medio,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: espacio.s + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.s,
  },
  botonSombra: {
    elevation: 3,
    shadowColor: colores.primario,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
  botonOff: { backgroundColor: colores.linea, borderColor: colores.linea },
  botonTexto: { ...tipo.cuerpo, fontFamily: fuente.extra },

  campo: { marginBottom: espacio.m + 2 },
  etiqueta: { ...tipo.cuerpoFuerte, color: colores.texto, marginBottom: 6 },
  caja: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colores.tarjeta,
    borderWidth: 1.5,
    borderColor: colores.bordeCampo,
    borderRadius: radio.medio,
    paddingHorizontal: 14,
  },
  // El ancho del borde es el mismo en reposo, foco y error: solo cambia el color (sin saltos de 0.5px).
  cajaRelleno: { minHeight: 50, borderRadius: radio.grande, borderWidth: 1.5, borderColor: colores.bordeCampo, backgroundColor: colores.campoRelleno },
  etiquetaRelleno: { ...tipo.etiqueta },
  cajaFoco: { borderColor: colores.primario },
  cajaError: { borderColor: colores.peligro },
  cajaBloqueada: { backgroundColor: colores.relleno },
  input: { flex: 1, ...tipo.cuerpo, color: colores.texto, paddingVertical: 12, ...web },
  ayuda: { ...tipo.apoyo, color: colores.tenue, marginTop: 6 },
  error: { ...tipo.apoyo, fontFamily: fuente.negrita, color: colores.peligro, marginTop: 6 },

  insignia: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radio.chico,
    paddingVertical: espacio.xs,
    paddingLeft: 6,
    paddingRight: 10,
  },
  insigniaIcono: { width: 16, height: 16, borderRadius: 8, backgroundColor: colores.blanco, alignItems: 'center', justifyContent: 'center' },
  insigniaTexto: { ...tipo.apoyo, fontFamily: fuente.negrita, color: colores.blanco },

  numeroPedido: { ...tipo.cuerpo, fontFamily: fuente.negrita, color: colores.texto },

  titulo: { fontFamily: tipo.titulo.fontFamily, fontSize: tipo.titulo.fontSize, color: colores.texto }, // sin lineHeight: las pantallas lo achican a 18

  fila: { flexDirection: 'row', gap: espacio.m, paddingVertical: espacio.s },
  filaIcono: {
    width: 34,
    height: 34,
    borderRadius: radio.medio,
    backgroundColor: colores.acentoSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filaCuerpo: { flex: 1 },
  filaTitulo: { ...tipo.apoyo, fontFamily: fuente.negrita, color: colores.suave },

  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: radio.medio, padding: 12 },
  avisoCuerpo: { flex: 1 },
  avisoTexto: { ...tipo.cuerpo },

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
    minHeight: 96,
    borderRadius: 22,
    backgroundColor: colores.primario,
    paddingVertical: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: colores.primario,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  encargoPresionado: { backgroundColor: colores.primarioOscuro },
  encargoRayas: { right: 56 },
  encargoTextos: { flex: 1 },
  encargoIcono: { width: 52, height: 52, borderRadius: radio.grande, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  encargoTitulo: { ...tipo.subtitulo, fontFamily: fuente.extra, color: colores.blanco },
  encargoSubtitulo: { ...tipo.apoyo, color: colores.blanco, marginTop: 2 },
  encargoFlecha: { width: 48, height: 48, borderRadius: radio.grande, backgroundColor: colores.blanco, alignItems: 'center', justifyContent: 'center' },

  // Sin borde ni overflow:hidden: las muescas sobresalen a medias del borde de la tarjeta.
  boleta: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.grande,
    elevation: 1,
    shadowColor: colores.sombra,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  boletaCuerpo: { padding: espacio.l, paddingBottom: 14 },
  boletaPie: { padding: espacio.l, paddingTop: espacio.m },
  perforacion: { height: 20, justifyContent: 'center' },
  muesca: { position: 'absolute', width: 20, height: 20, borderRadius: 10, top: 0 },
  dashes: { flexDirection: 'row', justifyContent: 'space-between', overflow: 'hidden', marginHorizontal: 16 },
  dash: { width: 5, height: 1.5, backgroundColor: colores.trazo },
});
