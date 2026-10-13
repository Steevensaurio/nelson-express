import { useState, useCallback, useRef } from 'react';
import { Text, View, FlatList, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import api from '../services/api';
import { useTiempoReal } from '../context/RealtimeContext';
import { colorEstado, esFinal, etiquetaEstado } from '../constants/estados';
import { colores, radio } from '../constants/tema';
import { Icono, Insignia, estiloTarjeta } from '../components/ui';

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
      <View style={styles.filtros} accessibilityRole="tablist">
        {[
          { texto: 'En curso', cantidad: enCurso.length, historial: false },
          { texto: 'Historial', cantidad: historial.length, historial: true },
        ].map((f) => {
          const activo = verHistorial === f.historial;
          return (
            <Pressable
              key={f.texto}
              accessibilityRole="tab"
              aria-selected={activo}
              accessibilityLabel={`${f.texto}, ${f.cantidad} ${f.cantidad === 1 ? 'entrega' : 'entregas'}`}
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
        data={verHistorial ? historial : enCurso}
        refreshing={refrescando}
        onRefresh={refrescar}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={
          <View style={styles.vacio}>
            <Icono nombre={verHistorial ? 'archive-outline' : 'bicycle'} tamano={44} color={colores.suave} />
            <Text style={styles.vacioTexto}>
              {verHistorial ? 'Aún no tienes entregas finalizadas' : 'No tienes entregas en curso'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const valor = item.costo_envio != null ? `$${parseFloat(item.costo_envio).toFixed(2)}` : null;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Entrega ${item.id}${valor ? `, ${valor}` : ''}. Estado: ${etiquetaEstado[item.estado]}. Recoger en ${item.recogida.nombre}, ${item.recogida.direccion}. Entregar en ${item.destino_direccion}. Ver detalle`}
              onPress={() => navigation.navigate('EntregaDetalle', { entrega: item })}
              android_ripple={{ color: 'rgba(0,124,171,0.12)' }}
              style={({ pressed }) => [styles.card, pressed && styles.cardPresionada]}
            >
              <View style={[styles.franja, { backgroundColor: colorEstado[item.estado] }]} />
              <View style={styles.cuerpo}>
                <View style={styles.encabezado}>
                  <Insignia estado={item.estado} />
                  <View style={styles.precioCol}>
                    {valor ? <Text style={styles.precio}>{valor}</Text> : null}
                    <Text style={styles.numero}>#{item.id}</Text>
                  </View>
                </View>

                <View style={styles.fila}>
                  <View style={styles.filaIcono}>
                    <Icono nombre={item.tipo === 'ENCARGO' ? 'cube-outline' : 'storefront-outline'} tamano={18} color={colores.primarioOscuro} />
                  </View>
                  <View style={styles.filaContenido}>
                    <Text style={styles.etiqueta}>Recoger en</Text>
                    <Text style={styles.valor}>{item.recogida.nombre}</Text>
                    <Text style={styles.detalle}>{item.recogida.direccion}</Text>
                  </View>
                </View>

                <View style={styles.fila}>
                  <View style={styles.filaIcono}>
                    <Icono nombre="location-outline" tamano={18} color={colores.primarioOscuro} />
                  </View>
                  <View style={styles.filaContenido}>
                    <Text style={styles.etiqueta}>Entregar en</Text>
                    <Text style={styles.valor}>{item.destino_direccion}</Text>
                    {item.destino_referencia ? <Text style={styles.referencia}>{item.destino_referencia}</Text> : null}
                  </View>
                </View>
              </View>
              <Icono nombre="chevron-forward" tamano={20} color={colores.suave} estilo={styles.flecha} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  container: { backgroundColor: colores.fondo },
  lista: { padding: 12, paddingBottom: 24, gap: 12, flexGrow: 1 },
  filtros: { flexDirection: 'row', gap: 10, padding: 12, paddingBottom: 4 },
  filtro: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radio.pastilla,
    backgroundColor: colores.tarjeta,
    borderWidth: 1.5,
    borderColor: colores.bordeCampo,
  },
  filtroActivo: { backgroundColor: colores.primario, borderColor: colores.primario },
  filtroTexto: { fontWeight: '700', fontSize: 15, color: colores.tenue },
  filtroTextoActivo: { color: '#fff' },
  contador: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    backgroundColor: '#e8edf0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contadorActivo: { backgroundColor: 'rgba(255,255,255,0.28)' },
  contadorTexto: { fontSize: 13, fontWeight: '800', color: colores.tenue },
  contadorTextoActivo: { color: '#fff' },

  card: { ...estiloTarjeta, padding: 0, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  cardPresionada: { opacity: 0.9 },
  franja: { width: 6, alignSelf: 'stretch' },
  cuerpo: { flex: 1, padding: 14 },
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  precioCol: { alignItems: 'flex-end' },
  precio: { fontSize: 22, fontWeight: '800', color: colores.verde },
  numero: { fontSize: 13, fontWeight: '700', color: colores.suave },
  fila: { flexDirection: 'row', gap: 12, marginTop: 14 },
  filaIcono: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colores.acentoSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filaContenido: { flex: 1 },
  etiqueta: { fontSize: 12, fontWeight: '700', color: colores.suave, textTransform: 'uppercase', letterSpacing: 0.4 },
  valor: { fontSize: 16, fontWeight: '700', color: colores.texto, marginTop: 1 },
  detalle: { fontSize: 14, color: colores.tenue, marginTop: 1 },
  referencia: { fontSize: 14, color: colores.tenue, fontStyle: 'italic', marginTop: 2 },
  flecha: { marginRight: 10 },
  vacio: { alignItems: 'center', gap: 12, marginTop: 56, paddingHorizontal: 32 },
  vacioTexto: { textAlign: 'center', color: colores.tenue, fontSize: 15 },
});
