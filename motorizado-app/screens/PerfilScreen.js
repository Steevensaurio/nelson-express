import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTiempoReal } from '../context/RealtimeContext';
import { colores, sombraTarjeta } from '../constants/tema';

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
        <Text style={styles.tenue}>{error || 'Cargando…'}</Text>
        {error ? (
          <TouchableOpacity onPress={cargar}>
            <Text style={styles.enlace}>Reintentar</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  const tieneVehiculo = Boolean(perfil.vehiculo_placa || perfil.vehiculo_modelo);
  const faltaContacto = !perfil.first_name || !perfil.telefono;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contenido}>
      <View style={styles.cabecera}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTexto}>{iniciales(perfil)}</Text>
        </View>
        <Text style={styles.nombre}>{nombreCompleto(perfil)}</Text>
        <View style={styles.chip}>
          <Ionicons name="bicycle" size={14} color={colores.primario} />
          <Text style={styles.chipTexto}>Motorizado</Text>
        </View>
        <Text style={styles.tenue}>Con Nelson Express desde {desdeCuando(perfil.date_joined)}</Text>
      </View>

      <View style={styles.estadisticas}>
        <View style={styles.estadistica}>
          <Text style={styles.estadisticaNumero}>{perfil.entregas_hoy}</Text>
          <Text style={styles.estadisticaTexto}>Entregas hoy</Text>
        </View>
        <View style={styles.estadistica}>
          <Text style={styles.estadisticaNumero}>{perfil.entregas_completadas}</Text>
          <Text style={styles.estadisticaTexto}>Entregas totales</Text>
        </View>
      </View>

      {faltaContacto || !tieneVehiculo ? (
        <TouchableOpacity style={styles.aviso} onPress={() => navigation.navigate('EditarPerfil')}>
          <Ionicons name="alert-circle-outline" size={20} color="#7a4b00" />
          <Text style={styles.avisoTexto}>
            Completa tu perfil: {faltaContacto ? 'nombre y teléfono' : 'los datos de tu vehículo'} para que el despachador
            y los clientes puedan identificarte.
          </Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.tarjeta}>
        <Text style={styles.seccion}>Contacto</Text>
        <View style={styles.fila}>
          <Ionicons name="call-outline" size={18} color={colores.tenue} />
          <Text style={styles.filaTexto}>{perfil.telefono || 'Sin teléfono registrado'}</Text>
        </View>
        <View style={styles.fila}>
          <Ionicons name="at-outline" size={18} color={colores.tenue} />
          <Text style={styles.filaTexto}>{perfil.username}</Text>
        </View>
      </View>

      <View style={styles.tarjeta}>
        <Text style={styles.seccion}>Vehículo</Text>
        {tieneVehiculo ? (
          <View style={styles.vehiculo}>
            <View style={styles.vehiculoDatos}>
              <Text style={styles.vehiculoModelo}>{perfil.vehiculo_modelo || 'Modelo sin registrar'}</Text>
              {perfil.vehiculo_color ? <Text style={styles.tenue}>{perfil.vehiculo_color}</Text> : null}
            </View>
            {perfil.vehiculo_placa ? (
              <View style={styles.placa}>
                <Text style={styles.placaTexto}>{perfil.vehiculo_placa}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={styles.tenue}>Aún no registraste tu vehículo.</Text>
        )}
      </View>

      <TouchableOpacity style={styles.botonPrimario} onPress={() => navigation.navigate('EditarPerfil')}>
        <Ionicons name="create-outline" size={18} color="#fff" />
        <Text style={styles.botonPrimarioTexto}>Editar perfil</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.botonSalir} onPress={logout}>
        <Text style={styles.botonSalirTexto}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  contenido: {
    padding: 16,
    paddingBottom: 32,
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.fondo,
  },
  cabecera: {
    alignItems: 'center',
    marginVertical: 12,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colores.primario,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarTexto: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  nombre: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colores.texto,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colores.acentoSuave,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginVertical: 8,
  },
  chipTexto: {
    color: colores.primario,
    fontSize: 12,
    fontWeight: 'bold',
  },
  tenue: {
    color: colores.tenue,
    fontSize: 13,
  },
  enlace: {
    color: '#1e6fe0',
    marginTop: 8,
    fontWeight: '600',
  },
  estadisticas: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  estadistica: {
    flex: 1,
    backgroundColor: colores.tarjeta,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    ...sombraTarjeta,
  },
  estadisticaNumero: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colores.texto,
  },
  estadisticaTexto: {
    fontSize: 12,
    color: colores.tenue,
    marginTop: 2,
  },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff4e0',
    borderColor: '#e08a1e',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  avisoTexto: {
    flex: 1,
    color: '#7a4b00',
    fontSize: 13,
  },
  tarjeta: {
    backgroundColor: colores.tarjeta,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...sombraTarjeta,
  },
  seccion: {
    fontSize: 12,
    color: colores.suave,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  filaTexto: {
    fontSize: 15,
    color: colores.texto,
  },
  vehiculo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vehiculoDatos: {
    flex: 1,
    paddingRight: 12,
  },
  vehiculoModelo: {
    fontSize: 16,
    fontWeight: '600',
    color: colores.texto,
  },
  placa: {
    borderWidth: 2,
    borderColor: colores.texto,
    borderRadius: 6,
    backgroundColor: '#fff',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  placaTexto: {
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: colores.texto,
  },
  botonPrimario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colores.primario,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  botonPrimarioTexto: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  botonSalir: {
    borderColor: colores.peligro,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  botonSalirTexto: {
    color: colores.peligro,
    fontWeight: 'bold',
  },
});
