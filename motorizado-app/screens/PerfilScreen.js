import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTiempoReal } from '../context/RealtimeContext';
import { colores, radio } from '../constants/tema';
import { Boton, Icono, Titulo, estiloTarjeta } from '../components/ui';

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
        <View style={styles.cabeceraBurbuja} pointerEvents="none" aria-hidden />
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
          <Icono nombre="today-outline" tamano={24} color={colores.primarioOscuro} />
          <Text style={styles.estadisticaNumero}>{perfil.entregas_hoy}</Text>
          <Text style={styles.estadisticaTexto}>Entregas hoy</Text>
        </View>
        <View style={styles.estadistica} accessible accessibilityLabel={`Entregas totales: ${perfil.entregas_completadas}`}>
          <Icono nombre="trophy-outline" tamano={24} color={colores.primarioOscuro} />
          <Text style={styles.estadisticaNumero}>{perfil.entregas_completadas}</Text>
          <Text style={styles.estadisticaTexto}>Entregas totales</Text>
        </View>
      </View>

      {faltaContacto || !tieneVehiculo ? (
        <Boton
          titulo={`Completa tu perfil: ${faltaContacto ? 'nombre y teléfono' : 'datos de tu vehículo'}`}
          etiqueta={`Completa tu perfil: ${faltaContacto ? 'nombre y teléfono' : 'datos de tu vehículo'}, para que el despachador y los clientes puedan identificarte`}
          icono="alert-circle"
          variante="secundario"
          onPress={() => navigation.navigate('EditarPerfil')}
          estilo={styles.aviso}
        />
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
    elevation: 4,
    shadowColor: colores.primario,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  cabeceraBurbuja: {
    position: 'absolute',
    right: -50,
    top: -60,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: colores.primarioOscuro,
    opacity: 0.55,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: { fontSize: 26, fontWeight: '800', color: colores.primarioOscuro },
  cabeceraCuerpo: { flex: 1, gap: 6, alignItems: 'flex-start' },
  nombre: { fontSize: 21, fontWeight: '800', color: '#fff' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: radio.pastilla,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  chipTexto: { color: '#fff', fontSize: 13, fontWeight: '800' },
  desde: { color: '#fff', fontSize: 13 },

  estadisticas: { flexDirection: 'row', gap: 12 },
  estadistica: { ...estiloTarjeta, flex: 1, alignItems: 'center', gap: 4 },
  estadisticaNumero: { fontSize: 30, fontWeight: '800', color: colores.texto },
  estadisticaTexto: { fontSize: 13, fontWeight: '600', color: colores.tenue },

  aviso: { backgroundColor: '#fff4e0', borderColor: colores.naranja },

  tarjeta: { ...estiloTarjeta },
  seccion: { fontSize: 14, color: colores.suave, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
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
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  placaTexto: { fontSize: 19, fontWeight: '800', letterSpacing: 2, color: colores.texto },
  espacio: { marginTop: 2 },
});
