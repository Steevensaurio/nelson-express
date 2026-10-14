import { View, Pressable, StyleSheet } from 'react-native';
import { pedir } from '../services/consultas';
import { useCargaRapida } from '../hooks/useCargaRapida';
import { useAuth } from '../context/AuthContext';
import { colores, fuente, radio } from '../constants/tema';
import { Aviso, AvisosCarga, Boton, Esqueleto, Icono, Rayas, Text, estiloTarjeta } from '../components/ui';

const iniciales = (perfil) =>
  ((perfil.first_name?.[0] ?? '') + (perfil.last_name?.[0] ?? '') || perfil.username?.[0] || '?').toUpperCase();

function Opcion({ icono, titulo, detalle, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detalle ? `${titulo}. ${detalle}` : titulo}
      onPress={onPress}
      android_ripple={{ color: 'rgba(0,124,171,0.12)' }}
      style={({ pressed }) => [styles.opcion, pressed && styles.opcionPresionada]}
    >
      <View style={styles.opcionIcono}>
        <Icono nombre={icono} tamano={22} color={colores.primarioOscuro} />
      </View>
      <View style={styles.opcionCuerpo}>
        <Text style={styles.opcionTexto}>{titulo}</Text>
        {detalle ? <Text style={styles.opcionDetalle}>{detalle}</Text> : null}
      </View>
      <Icono nombre="chevron-forward" tamano={20} color={colores.suave} />
    </Pressable>
  );
}

const pedirPerfil = pedir('/perfil/');

export default function PerfilScreen({ navigation }) {
  const { logout } = useAuth();
  // El perfil se comparte con Negocios y "Mis datos" (misma clave): una sola petición cada 60 s sirve a todas.
  // Al guardar en "Mis datos" la caché se actualiza y esta pantalla lo toma al volver.
  const { datos: perfil, error, lento, recargar } = useCargaRapida('perfil', pedirPerfil, { maxEdad: 60000 });

  const nombre = perfil ? [perfil.first_name, perfil.last_name].filter(Boolean).join(' ') : '';
  const incompleto = perfil && !(perfil.first_name && perfil.telefono);

  return (
    <View style={styles.container}>
      <View style={styles.cabecera}>
        <Rayas estilo={styles.rayas} />
        <View style={styles.avatar} aria-hidden>
          <Text style={styles.avatarTexto}>{perfil ? iniciales(perfil) : ''}</Text>
        </View>
        {perfil ? (
          <View style={styles.cabeceraCuerpo}>
            <Text accessibilityRole="header" style={styles.nombre} numberOfLines={1}>
              {nombre || perfil.username}
            </Text>
            {perfil.telefono ? <Text style={styles.telefono}>{perfil.telefono}</Text> : null}
          </View>
        ) : (
          <View style={styles.cabeceraCuerpo} accessibilityRole="progressbar" accessibilityLabel="Cargando" aria-busy>
            <Esqueleto ancho="65%" alto={26} />
            <Esqueleto ancho="40%" alto={16} estilo={styles.esqueletoTelefono} />
          </View>
        )}
      </View>

      <AvisosCarga lento={lento} error={error} hayDatos={Boolean(perfil)} />
      {error && !perfil ? (
        <View style={styles.errorCarga}>
          <Aviso tipo="error">No se pudo cargar tu perfil. Revisa tu conexión.</Aviso>
          <Boton titulo="Reintentar" variante="secundario" icono="refresh" onPress={recargar} />
        </View>
      ) : null}

      {incompleto ? (
        <Aviso tipo="alerta">Completa tu nombre y teléfono para que el motorizado pueda contactarte.</Aviso>
      ) : null}

      <View style={styles.grupo}>
        <Opcion icono="person-outline" titulo="Mis datos" detalle="Nombre y teléfono" onPress={() => navigation.navigate('MisDatos')} />
        <View style={styles.separador} />
        <Opcion icono="location-outline" titulo="Mis direcciones" detalle="Casa, trabajo y más" onPress={() => navigation.navigate('MisDirecciones')} />
      </View>

      <Boton titulo="Cerrar sesión" variante="peligroSuave" icono="log-out-outline" onPress={logout} estilo={styles.salir} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colores.fondo, padding: 16, gap: 14 },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colores.primario,
    borderRadius: radio.grande,
    padding: 20,
    overflow: 'hidden',
  },
  rayas: { right: -6 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: { fontFamily: fuente.extra, fontSize: 24, color: colores.primarioOscuro },
  cabeceraCuerpo: { flex: 1 },
  esqueletoTelefono: { marginTop: 8 },
  errorCarga: { gap: 12 },
  nombre: { fontFamily: fuente.extra, fontSize: 22, lineHeight: 28, color: '#fff' },
  telefono: { fontFamily: fuente.media, fontSize: 15, color: '#fff', marginTop: 3 },
  grupo: { ...estiloTarjeta, padding: 4 },
  opcion: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
    borderRadius: radio.medio,
  },
  opcionPresionada: { backgroundColor: colores.acentoSuave },
  opcionIcono: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colores.acentoSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opcionCuerpo: { flex: 1 },
  opcionTexto: { fontFamily: fuente.extra, fontSize: 17, color: colores.texto },
  opcionDetalle: { fontFamily: fuente.media, fontSize: 13, color: colores.tenue, marginTop: 2 },
  separador: { height: 1, backgroundColor: colores.borde, marginHorizontal: 12 },
  salir: { marginTop: 6 },
});
