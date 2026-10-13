import { forwardRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores, radio, sombraTarjeta } from '../constants/tema';
import { colorEstado, etiquetaEstado, iconoEstado } from '../constants/estados';

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

export const estiloTarjeta = {
  backgroundColor: colores.tarjeta,
  borderRadius: radio.grande,
  padding: 16,
  ...sombraTarjeta,
};

const VARIANTES = {
  primario: { fondo: colores.primario, presionado: colores.primarioOscuro, texto: '#fff', borde: colores.primario },
  secundario: { fondo: '#fff', presionado: colores.acentoSuave, texto: colores.primarioOscuro, borde: colores.primario },
  peligro: { fondo: colores.peligro, presionado: '#8c1d18', texto: '#fff', borde: colores.peligro },
  peligroSuave: { fondo: '#fff', presionado: colores.peligroSuave, texto: colores.peligro, borde: colores.peligro },
  fantasma: { fondo: 'transparent', presionado: colores.acentoSuave, texto: colores.primarioOscuro, borde: 'transparent' },
};

// Botón con altura mínima de 48dp, feedback al presionar y semántica completa para lectores de pantalla.
export function Boton({ titulo, onPress, variante = 'primario', icono, deshabilitado, cargando, etiqueta, estilo }) {
  const v = VARIANTES[variante];
  const inactivo = Boolean(deshabilitado || cargando);
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
        variante === 'primario' && !inactivo && s.botonSombra,
        deshabilitado && s.botonOff,
        estilo,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={v.texto} />
      ) : icono ? (
        <Icono nombre={icono} tamano={20} color={deshabilitado ? '#5a6268' : v.texto} />
      ) : null}
      <Text style={[s.botonTexto, { color: deshabilitado ? '#5a6268' : v.texto }]}>{titulo}</Text>
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

// Chip de estado: ícono + palabra + color, para que el color nunca sea el único indicador.
export function Insignia({ estado, estilo }) {
  const etiqueta = etiquetaEstado[estado] ?? estado;
  return (
    <View
      accessible
      accessibilityLabel={`Estado: ${etiqueta}`}
      style={[s.insignia, { backgroundColor: colorEstado[estado] ?? colores.tenue }, estilo]}
    >
      <Icono nombre={iconoEstado[estado] ?? 'ellipse-outline'} tamano={14} color="#fff" />
      <Text style={s.insigniaTexto}>{etiqueta}</Text>
    </View>
  );
}

export function Titulo({ children, estilo }) {
  return <Text accessibilityRole="header" style={[s.titulo, estilo]}>{children}</Text>;
}

// Un dato con ícono y rótulo pequeño encima del valor.
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

const web = Platform.select({ web: { outlineStyle: 'none' }, default: {} });

const s = StyleSheet.create({
  boton: {
    minHeight: 52,
    borderRadius: radio.medio,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  botonSombra: {
    elevation: 3,
    shadowColor: colores.primario,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
  botonOff: { backgroundColor: '#dfe3e6', borderColor: '#dfe3e6' },
  botonTexto: { fontSize: 16, fontWeight: '700' },

  campo: { marginBottom: 14 },
  etiqueta: { fontSize: 14, fontWeight: '600', color: colores.texto, marginBottom: 6 },
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
  input: { flex: 1, fontSize: 16, color: colores.texto, paddingVertical: 12, ...web },
  ayuda: { fontSize: 13, color: colores.tenue, marginTop: 6 },
  error: { fontSize: 13, fontWeight: '600', color: colores.peligro, marginTop: 6 },

  insignia: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radio.pastilla,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  insigniaTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },

  titulo: { fontSize: 18, fontWeight: '800', color: colores.texto },

  fila: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
  filaIcono: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colores.acentoSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filaCuerpo: { flex: 1 },
  filaTitulo: { fontSize: 12, fontWeight: '700', color: colores.suave, textTransform: 'uppercase', letterSpacing: 0.4 },
});
