import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTiempoReal } from '../context/RealtimeContext';
import { colores, fuente, radio } from '../constants/tema';
import { Aviso, Boton, Icono, Rayas, Titulo, estiloTarjeta } from '../components/ui';

const nombreCompleto = (perfil) =>
  `${perfil.first_name} ${perfil.last_name}`.trim() || perfil.username;

const iniciales = (perfil) => {
  const letras = [perfil.first_name, perfil.last_name]
    .filter(Boolean)
    .map((p) => p[0])
    .join('');
  return (letras || perfil.username.slice(0, 2)).toUpperCase();
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const desdeCuando = (iso) => {
  const f = new Date(iso);
  return `${MESES[f.getMonth()]} de ${f.getFullYear()}`;
};

export default function PerfilScreen({ navigation }) {
  const { logout } = useAuth();
  const { suscribir } = useTiempoReal();
  const [perfil, setPerfil] = useState(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const response = await api.get('/perfil/');
      setPerfil(response.data);
      setError('');
    } catch (err) {
      setError('No se pudo cargar tu perfil');
    }
  }, []);

  // Se recarga al entrar (por si se editó) y cuando cambia algún pedido (para las estadísticas).
  useFocusEffect(
    useCallback(() => {
      cargar();
      return suscribir(cargar);
    }, [cargar, suscribir])
  );

  if (!perfil) {
    return (
      <View style={styles.centro}>
        <Text style={styles.tenue} accessibilityLiveRegion="polite">{error || 'Cargando…'}</Text>
        {error ? <Boton titulo="Reintentar" variante="secundario" icono="refresh" onPress={cargar} estilo={styles.reintentar} /> : null}
      </View>
    );
  }

  const tieneVehiculo = Boolean(perfil.vehiculo_placa || perfil.vehiculo_modelo);
  const faltaContacto = !perfil.first_name || !perfil.telefono;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contenido}>
      <View style={styles.cabecera}>
        <Rayas />
        <View style={styles.avatar} aria-hidden>
          <Text style={styles.avatarTexto}>{iniciales(perfil)}</Text>
        </View>
        <View style={styles.cabeceraCuerpo}>
          <Text accessibilityRole="header" style={styles.nombre} numberOfLines={2}>{nombreCompleto(perfil)}</Text>
          <View style={styles.chip}>
            <Icono nombre="bicycle" tamano={16} color="#fff" />
            <Text style={styles.chipTexto}>Motorizado</Text>
          </View>
          <Text style={styles.desde}>Con Nelson Express desde {desdeCuando(perfil.date_joined)}</Text>
        </View>
      </View>

      <View style={styles.estadisticas}>
        <View style={styles.estadistica} accessible accessibilityLabel={`Entregas hoy: ${perfil.entregas_hoy}`}>
          <Text style={styles.estadisticaNumero}>{perfil.entregas_hoy}</Text>
          <Text style={styles.estadisticaTexto}>Entregas hoy</Text>
        </View>
        <View style={styles.estadisticaLinea} />
        <View style={styles.estadistica} accessible accessibilityLabel={`Entregas totales: ${perfil.entregas_completadas}`}>
          <Text style={styles.estadisticaNumero}>{perfil.entregas_completadas}</Text>
          <Text style={styles.estadisticaTexto}>Entregas totales</Text>
        </View>
      </View>

      {faltaContacto || !tieneVehiculo ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Completa tu perfil: ${faltaContacto ? 'nombre y teléfono' : 'datos de tu vehículo'}, para que el despachador y los clientes puedan identificarte`}
          onPress={() => navigation.navigate('EditarPerfil')}
          style={({ pressed }) => pressed && styles.presionado}
        >
          <Aviso tipo="alerta" icono="alert-circle">
            {`Completa tu perfil: ${faltaContacto ? 'nombre y teléfono' : 'datos de tu vehículo'}`}
          </Aviso>
        </Pressable>
      ) : null}

      <View style={styles.tarjeta}>
        <Titulo estilo={styles.seccion}>Contacto</Titulo>
        <View style={styles.fila}>
          <Icono nombre="call-outline" tamano={20} color={colores.primarioOscuro} />
          <Text style={styles.filaTexto}>{perfil.telefono || 'Sin teléfono registrado'}</Text>
        </View>
        <View style={styles.fila}>
          <Icono nombre="at-outline" tamano={20} color={colores.primarioOscuro} />
          <Text style={styles.filaTexto}>{perfil.username}</Text>
        </View>
      </View>

      <View style={styles.tarjeta}>
        <Titulo estilo={styles.seccion}>Vehículo</Titulo>
        {tieneVehiculo ? (
          <View style={styles.vehiculo}>
            <View style={styles.vehiculoDatos}>
              <Text style={styles.vehiculoModelo}>{perfil.vehiculo_modelo || 'Modelo sin registrar'}</Text>
              {perfil.vehiculo_color ? <Text style={styles.tenue}>{perfil.vehiculo_color}</Text> : null}
            </View>
            {perfil.vehiculo_placa ? (
              <View style={styles.placa} accessible accessibilityLabel={`Placa ${perfil.vehiculo_placa}`}>
                <Text style={styles.placaTexto}>{perfil.vehiculo_placa}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={styles.tenue}>Aún no registraste tu vehículo.</Text>
        )}
      </View>

      <Boton titulo="Editar perfil" icono="create-outline" onPress={() => navigation.navigate('EditarPerfil')} estilo={styles.espacio} />
      <Boton titulo="Cerrar sesión" variante="peligroSuave" icono="log-out-outline" onPress={logout} estilo={styles.espacio} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 16, paddingBottom: 32, gap: 14 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.fondo, padding: 24 },
  reintentar: { marginTop: 12 },
  tenue: { color: colores.tenue, fontSize: 14 },

  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colores.primario,
    borderRadius: radio.grande + 4,
    padding: 20,
    overflow: 'hidden',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: { fontFamily: fuente.display, fontSize: 32, color: colores.primarioOscuro },
  cabeceraCuerpo: { flex: 1, gap: 6, alignItems: 'flex-start' },
  nombre: { fontFamily: fuente.display, fontSize: 32, lineHeight: 32, textTransform: 'uppercase', color: '#fff' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: radio.chico,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  chipTexto: { color: '#fff', fontSize: 13, fontWeight: '800' },
  desde: { color: '#fff', fontSize: 13 },

  estadisticas: { ...estiloTarjeta, flexDirection: 'row', alignItems: 'center' },
  estadistica: { flex: 1, alignItems: 'center' },
  estadisticaLinea: { width: 1, alignSelf: 'stretch', backgroundColor: colores.borde },
  estadisticaNumero: { fontFamily: fuente.display, fontSize: 48, lineHeight: 50, color: colores.texto },
  estadisticaTexto: { fontFamily: fuente.displayMedio, fontSize: 16, letterSpacing: 0.8, textTransform: 'uppercase', color: colores.tenue },
  presionado: { opacity: 0.85 },

  tarjeta: { ...estiloTarjeta },
  seccion: { fontSize: 22, marginBottom: 10 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  filaTexto: { fontSize: 16, color: colores.texto },
  vehiculo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vehiculoDatos: { flex: 1, paddingRight: 12 },
  vehiculoModelo: { fontSize: 17, fontWeight: '700', color: colores.texto },
  placa: {
    borderWidth: 2,
    borderColor: colores.texto,
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingVertical: 3,
    paddingHorizontal: 12,
  },
  placaTexto: { fontFamily: fuente.display, fontSize: 24, letterSpacing: 2, color: colores.texto },
  espacio: { marginTop: 2 },
});
