import { useState, useCallback, useRef } from 'react';
import { View, FlatList, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import api from '../services/api';
import { useTiempoReal } from '../context/RealtimeContext';
import { esFinal, etiquetaEstado } from '../constants/estados';
import { MOSTRAR_PRECIOS } from '../constants/config';
import { colores, fuente } from '../constants/tema';
import { Boleta, Entrada, Icono, Insignia, NumeroPedido, Text } from '../components/ui';

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
      <View style={styles.filtros} accessibilityRole="tablist">
        {[
          { texto: 'Activos', cantidad: activos.length, historial: false },
          { texto: 'Historial', cantidad: historial.length, historial: true },
        ].map((f) => {
          const activo = verHistorial === f.historial;
          return (
            <Pressable
              key={f.texto}
              accessibilityRole="tab"
              aria-selected={activo}
              accessibilityLabel={`${f.texto}, ${f.cantidad} ${f.cantidad === 1 ? 'pedido' : 'pedidos'}`}
              style={[styles.filtro, activo && styles.filtroActivo]}
              onPress={() => setVerHistorial(f.historial)}
            >
              <Text style={[styles.filtroTexto, activo && styles.filtroTextoActivo]}>{f.texto}</Text>
              <View style={[styles.contador, activo && styles.contadorActivo]}>
                <Text style={[styles.contadorTexto, activo && styles.contadorTextoActivo]}>{f.cantidad}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <FlatList
        ref={lista}
        style={styles.container}
        contentContainerStyle={styles.lista}
        refreshing={refrescando}
        onRefresh={refrescar}
        data={verHistorial ? historial : activos}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item, index }) => {
          const total = item.detalles.reduce((suma, d) => suma + d.precio_unitario * d.cantidad, 0) + parseFloat(item.costo_envio ?? 0);
          const esEncargo = item.tipo === 'ENCARGO';
          const titulo = esEncargo ? 'Encargo' : item.negocio.nombre;
          const textoPie = MOSTRAR_PRECIOS
            ? `Total $${total.toFixed(2)}`
            : item.costo_envio == null ? 'Envío por confirmar' : `Envío $${parseFloat(item.costo_envio).toFixed(2)}`;
          return (
            <Entrada indice={index} estilo={styles.celda}>
              <Pressable
                testID="ticket-pedido"
                accessibilityRole="button"
                accessibilityLabel={`${esEncargo ? `Encargo: ${item.descripcion}` : item.negocio.nombre}. Estado: ${etiquetaEstado[item.estado]}. Entrega en ${item.destino_direccion}. Ver detalle`}
                onPress={() => navigation.navigate('PedidoDetalle', { pedido: item })}
                android_ripple={{ color: 'rgba(0,124,171,0.12)' }}
                style={({ pressed }) => pressed && styles.presionada}
              >
                <Boleta
                  pie={
                    <View style={styles.pie}>
                      <Text style={styles.envio} numberOfLines={1}>{textoPie}</Text>
                      <View style={styles.verDetalle}>
                        <Text style={styles.verDetalleTexto} numberOfLines={1}>Ver detalle</Text>
                        <Icono nombre="chevron-forward" tamano={16} color={colores.primarioOscuro} />
                      </View>
                    </View>
                  }
                >
                  <View style={styles.encabezado}>
                    <NumeroPedido numero={item.id} />
                    <Insignia estado={item.estado} />
                  </View>
                  <Text style={styles.nombre} numberOfLines={1}>{titulo}</Text>
                  <Text style={styles.destino} numberOfLines={1}>{item.destino_direccion}</Text>
                </Boleta>
              </Pressable>
            </Entrada>
          );
        }}
        ListEmptyComponent={
          <View style={styles.vacio}>
            <Icono nombre={verHistorial ? 'archive-outline' : 'receipt-outline'} tamano={44} color={colores.suave} />
            <Text style={styles.vacioTexto}>
              {verHistorial ? 'Aún no tienes pedidos entregados ni cancelados' : 'No tienes pedidos activos'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  // Pestañas tipo interruptor: la activa es una pastilla blanca sobre el fondo gris.
  filtros: { flexDirection: 'row', margin: 16, marginBottom: 4, padding: 4, borderRadius: 12, backgroundColor: '#e6ecf0' },
  filtro: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 9,
  },
  filtroActivo: {
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#002838',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  filtroTexto: { fontFamily: fuente.negrita, fontSize: 13.5, color: '#4d5b64' },
  filtroTextoActivo: { color: colores.primarioOscuro },
  contador: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: '#d5dde2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contadorActivo: { backgroundColor: colores.acentoSuave },
  contadorTexto: { fontFamily: fuente.negrita, fontSize: 12, color: '#4d5b64' },
  contadorTextoActivo: { color: colores.primarioOscuro },
  container: { backgroundColor: colores.fondo },
  lista: { padding: 16, paddingBottom: 24, flexGrow: 1 },
  celda: { marginBottom: 12 },
  presionada: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  // Todos los tickets tienen la misma estructura (una línea de nombre, una de dirección, un pie) y por eso la misma altura.
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nombre: { marginTop: 10, fontFamily: fuente.extra, fontSize: 17, color: colores.texto },
  destino: { marginTop: 3, fontFamily: fuente.media, fontSize: 13, color: colores.tenue },
  pie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  envio: { flex: 1, fontFamily: fuente.extra, fontSize: 13.5, color: colores.texto },
  verDetalle: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 2 },
  verDetalleTexto: { fontFamily: fuente.negrita, fontSize: 13, color: colores.primarioOscuro },
  vacio: { alignItems: 'center', gap: 12, marginTop: 56, paddingHorizontal: 32 },
  vacioTexto: { textAlign: 'center', color: colores.tenue, fontSize: 15 },
});
