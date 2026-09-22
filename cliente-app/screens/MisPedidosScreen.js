import { useState, useCallback, useRef } from 'react';
import { Text, View, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import api from '../services/api';
import { useTiempoReal } from '../context/RealtimeContext';
import { colorEstado, esFinal } from '../constants/estados';
import { MOSTRAR_PRECIOS } from '../constants/config';

const INTERVALO_REFRESCO_MS = 5000;
const INTERVALO_RESPALDO_MS = 30000;

export default function MisPedidosScreen({ navigation }) {
  const [pedidos, setPedidos] = useState([]);
  const [refrescando, setRefrescando] = useState(false);
  const lista = useRef(null);
  useScrollToTop(lista); // tocar de nuevo la pestaña activa vuelve al inicio de la lista
  const [verHistorial, setVerHistorial] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const response = await api.get('/pedidos/');
      setPedidos(response.data);
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

  const activos = pedidos.filter((p) => !esFinal(p.estado));
  const historial = pedidos.filter((p) => esFinal(p.estado));

  return (
    <View style={styles.pantalla}>
      <View style={styles.filtros}>
        {[
          { texto: 'Activos', cantidad: activos.length, historial: false },
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
        refreshing={refrescando}
        onRefresh={refrescar}
        data={verHistorial ? historial : activos}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          const total = item.detalles.reduce((suma, d) => suma + d.precio_unitario * d.cantidad, 0) + parseFloat(item.costo_envio ?? 0);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('PedidoDetalle', { pedido: item })}
            >
              <View style={[styles.badge, { backgroundColor: colorEstado[item.estado] }]}>
                <Text style={styles.badgeTexto}>{item.estado}</Text>
              </View>
              <Text style={styles.nombre} numberOfLines={1}>
                {item.tipo === 'ENCARGO' ? `Encargo: ${item.descripcion}` : item.negocio.nombre}
              </Text>
              <Text style={styles.destino}>{item.destino_direccion}</Text>
              {MOSTRAR_PRECIOS ? <Text style={styles.total}>${total.toFixed(2)}</Text> : null}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.vacio}>
            {verHistorial ? 'Aún no tienes pedidos entregados ni cancelados' : 'No tienes pedidos activos'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: '#f2f2f2',
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  filtroActivo: {
    backgroundColor: '#007cab',
    borderColor: '#007cab',
  },
  filtroTexto: {
    fontWeight: '600',
    color: '#666',
  },
  filtroTextoActivo: {
    color: '#fff',
  },
  container: {
    backgroundColor: '#f2f2f2',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  badgeTexto: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  nombre: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  destino: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  total: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 8,
  },
  vacio: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
  },
});
