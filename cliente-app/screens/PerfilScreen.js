import { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colores, fuente, radio } from '../constants/tema';
import { Aviso, Boton, Icono, Rayas, estiloTarjeta } from '../components/ui';

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

export default function PerfilScreen({ navigation }) {
  const { logout } = useAuth();
  const [perfil, setPerfil] = useState(null);

  // Se recarga al volver de "Mis datos" para reflejar lo que se acaba de guardar.
  useFocusEffect(
    useCallback(() => {
      api.get('/perfil/').then((r) => setPerfil(r.data)).catch(() => {});
    }, [])
  );

  const nombre = perfil ? [perfil.first_name, perfil.last_name].filter(Boolean).join(' ') : '';
  const incompleto = perfil && !(perfil.first_name && perfil.telefono);

  return (
    <View style={styles.container}>
      <View style={styles.cabecera}>
        <Rayas estilo={styles.rayas} />
        <View style={styles.avatar} aria-hidden>
          <Text style={styles.avatarTexto}>{perfil ? iniciales(perfil) : ''}</Text>
        </View>
        <View style={styles.cabeceraCuerpo}>
          <Text accessibilityRole="header" style={styles.nombre} numberOfLines={1}>
            {perfil ? nombre || perfil.username : 'Cargando…'}
          </Text>
          {perfil?.telefono ? <Text style={styles.telefono}>{perfil.telefono}</Text> : null}
        </View>
      </View>

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
  avatarTexto: { fontFamily: fuente.display, fontSize: 30, color: colores.primarioOscuro },
  cabeceraCuerpo: { flex: 1 },
  nombre: { fontFamily: fuente.display, fontSize: 32, lineHeight: 32, letterSpacing: 0.2, textTransform: 'uppercase', color: '#fff' },
  telefono: { fontSize: 15, color: '#fff', marginTop: 3 },
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
  opcionTexto: { fontFamily: fuente.display, fontSize: 24, letterSpacing: 0.3, textTransform: 'uppercase', color: colores.texto },
  opcionDetalle: { fontSize: 13, color: colores.tenue, marginTop: 2 },
  separador: { height: 1, backgroundColor: colores.borde, marginHorizontal: 12 },
  salir: { marginTop: 6 },
});
