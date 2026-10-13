import { useState, useCallback, useRef } from 'react';
import { Text, View, FlatList, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import api from '../services/api';
import { useTiempoReal } from '../context/RealtimeContext';
import { esFinal, etiquetaEstado } from '../constants/estados';
import { MOSTRAR_PRECIOS } from '../constants/config';
import { colores, fuente, radio } from '../constants/tema';
import { Boleta, Entrada, Icono, Insignia, Placa } from '../components/ui';

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
          return (
            <Entrada indice={index}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${esEncargo ? `Encargo: ${item.descripcion}` : item.negocio.nombre}. Estado: ${etiquetaEstado[item.estado]}. Entrega en ${item.destino_direccion}. Ver detalle`}
                onPress={() => navigation.navigate('PedidoDetalle', { pedido: item })}
                android_ripple={{ color: 'rgba(0,124,171,0.12)' }}
                style={({ pressed }) => pressed && styles.presionada}
              >
                <Boleta
                  pie={
                    <View style={styles.pie}>
                      <Icono nombre="location-outline" tamano={18} color={colores.primarioOscuro} />
                      <Text style={styles.destino} numberOfLines={2}>{item.destino_direccion}</Text>
                      {MOSTRAR_PRECIOS ? <Text style={styles.total}>${total.toFixed(2)}</Text> : null}
                      <Icono nombre="chevron-forward" tamano={20} color={colores.suave} />
                    </View>
                  }
                >
                  <View style={styles.encabezado}>
                    <Placa numero={item.id} />
                    <Insignia estado={item.estado} />
                  </View>
                  <Text style={styles.nombre} numberOfLines={2}>{titulo}</Text>
                  {esEncargo ? <Text style={styles.descripcion} numberOfLines={2}>{item.descripcion}</Text> : null}
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
  filtros: { flexDirection: 'row', gap: 10, padding: 12, paddingBottom: 4 },
  filtro: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radio.medio,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colores.bordeCampo,
  },
  filtroActivo: { backgroundColor: colores.primario, borderColor: colores.primario },
  filtroTexto: { fontFamily: fuente.display, fontSize: 19, letterSpacing: 0.6, textTransform: 'uppercase', color: colores.tenue },
  filtroTextoActivo: { color: '#fff' },
  contador: {
    minWidth: 24,
    height: 24,
    borderRadius: 6,
    paddingHorizontal: 6,
    backgroundColor: '#e8edf0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contadorActivo: { backgroundColor: 'rgba(255,255,255,0.28)' },
  contadorTexto: { fontFamily: fuente.displayMedio, fontSize: 16, color: colores.tenue },
  contadorTextoActivo: { color: '#fff' },
  container: { backgroundColor: colores.fondo },
  lista: { padding: 12, paddingBottom: 24, gap: 14, flexGrow: 1 },
  presionada: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nombre: { marginTop: 12, fontFamily: fuente.display, fontSize: 30, lineHeight: 30, letterSpacing: 0.2, textTransform: 'uppercase', color: colores.texto },
  descripcion: { marginTop: 4, fontSize: 15, color: colores.tenue },
  pie: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  destino: { flex: 1, fontSize: 14, color: colores.texto },
  total: { fontFamily: fuente.display, fontSize: 22, color: colores.texto },
  vacio: { alignItems: 'center', gap: 12, marginTop: 56, paddingHorizontal: 32 },
  vacioTexto: { textAlign: 'center', color: colores.tenue, fontSize: 15 },
});
