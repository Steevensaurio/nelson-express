import { useState, useCallback, useRef } from 'react';
import { Text, View, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { useTiempoReal } from '../context/RealtimeContext';
import { colorEstado, esFinal } from '../constants/estados';
import { colores, sombraTarjeta } from '../constants/tema';

const INTERVALO_REFRESCO_MS = 5000;
const INTERVALO_RESPALDO_MS = 30000;

export default function MisEntregasScreen({ navigation }) {
  const [entregas, setEntregas] = useState([]);
  const [refrescando, setRefrescando] = useState(false);
  const lista = useRef(null);
  useScrollToTop(lista); // tocar de nuevo la pestaña activa vuelve al inicio de la lista
  const [verHistorial, setVerHistorial] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const response = await api.get('/mis-entregas/');
      setEntregas(response.data);
    } catch (err) {
      // un fallo puntual de red no debe romper la pantalla; el siguiente ciclo reintenta
    }
  }, []);

  const { suscribir, conectado } = useTiempoReal();

  useFocusEffect(
    useCallback(() => {
      cargar();
      const desuscribir = suscribir(cargar);
      // Con el socket conectado el sondeo es solo un respaldo; sin él vuelve al ritmo rápido.
      const id = setInterval(cargar, conectado ? INTERVALO_RESPALDO_MS : INTERVALO_REFRESCO_MS);
      return () => {
        desuscribir();
        clearInterval(id);
      };
    }, [cargar, suscribir, conectado])
  );

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const enCurso = entregas.filter((e) => !esFinal(e.estado));
  const historial = entregas.filter((e) => esFinal(e.estado));

  return (
    <View style={styles.pantalla}>
      <View style={styles.filtros}>
        {[
          { texto: 'En curso', cantidad: enCurso.length, historial: false },
          { texto: 'Historial', cantidad: historial.length, historial: true },
        ].map((f) => (
          <TouchableOpacity
            key={f.texto}
            style={[styles.filtro, verHistorial === f.historial && styles.filtroActivo]}
            onPress={() => setVerHistorial(f.historial)}
          >
            <Text style={[styles.filtroTexto, verHistorial === f.historial && styles.filtroTextoActivo]}>
              {f.texto} ({f.cantidad})
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        ref={lista}
        style={styles.container}
        data={verHistorial ? historial : enCurso}
        refreshing={refrescando}
        onRefresh={refrescar}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={
          <Text style={styles.vacio}>
            {verHistorial ? 'Aún no tienes entregas finalizadas' : 'No tienes entregas en curso'}
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, esFinal(item.estado) && styles.cardFinalizada]}
            onPress={() => navigation.navigate('EntregaDetalle', { entrega: item })}
          >
            <View style={styles.encabezado}>
              <Text style={styles.numero}>
                #{item.id}
                {item.costo_envio != null ? `  ·  $${parseFloat(item.costo_envio).toFixed(2)}` : ''}
              </Text>
              <View style={[styles.badge, { backgroundColor: colorEstado[item.estado] }]}>
                <Text style={styles.badgeTexto}>{item.estado}</Text>
              </View>
            </View>

            <View style={styles.fila}>
              <Ionicons name="storefront-outline" size={16} color={colores.tenue} />
              <View style={styles.filaContenido}>
                <Text style={styles.etiqueta}>Recoger en</Text>
                <Text style={styles.valor}>{item.recogida.nombre} · {item.recogida.direccion}</Text>
              </View>
            </View>

            <View style={styles.fila}>
              <Ionicons name="location-outline" size={16} color={colores.tenue} />
              <View style={styles.filaContenido}>
                <Text style={styles.etiqueta}>Entregar en</Text>
                <Text style={styles.valor}>{item.destino_direccion}</Text>
                {item.destino_referencia ? (
                  <Text style={styles.referencia}>{item.destino_referencia}</Text>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colores.fondo,
  },
  pantalla: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  filtros: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    paddingBottom: 4,
  },
  filtro: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colores.tarjeta,
    borderWidth: 1,
    borderColor: colores.borde,
    alignItems: 'center',
  },
  filtroActivo: {
    backgroundColor: colores.primario,
    borderColor: colores.primario,
  },
  filtroTexto: {
    fontWeight: '600',
    color: colores.tenue,
  },
  filtroTextoActivo: {
    color: '#fff',
  },
  card: {
    backgroundColor: colores.tarjeta,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 8,
    marginVertical: 6,
    ...sombraTarjeta,
  },
  cardFinalizada: {
    opacity: 0.7,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  numero: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colores.texto,
  },
  badge: {
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  badgeTexto: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  fila: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  filaContenido: {
    flex: 1,
  },
  etiqueta: {
    fontSize: 12,
    color: colores.suave,
  },
  valor: {
    fontSize: 15,
    fontWeight: '600',
    color: colores.texto,
  },
  referencia: {
    fontSize: 13,
    color: colores.tenue,
    fontStyle: 'italic',
    marginTop: 2,
  },
  vacio: {
    textAlign: 'center',
    color: colores.suave,
    marginVertical: 24,
  },
});
