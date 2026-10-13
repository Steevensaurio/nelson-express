import { useState, useCallback, useRef } from 'react';
import { Text, View, FlatList, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import api from '../services/api';
import { useTiempoReal } from '../context/RealtimeContext';
import { esFinal, etiquetaEstado } from '../constants/estados';
import { colores, fuente, radio } from '../constants/tema';
import { Boleta, Entrada, Icono, Insignia, Placa } from '../components/ui';

const INTERVALO_REFRESCO_MS = 5000;
const INTERVALO_RESPALDO_MS = 30000;

// Un extremo de la carrera (recoger / entregar): rótulo corto y el lugar.
function Tramo({ icono, rotulo, titulo, detalle }) {
  return (
    <View style={styles.tramo}>
      <Icono nombre={icono} tamano={20} color={colores.primarioOscuro} estilo={styles.tramoIcono} />
      <View style={styles.tramoCuerpo}>
        <Text style={styles.rotulo}>{rotulo}</Text>
        <Text style={styles.valor}>{titulo}</Text>
        {detalle ? <Text style={styles.detalle}>{detalle}</Text> : null}
      </View>
    </View>
  );
}

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
        renderItem={({ item, index }) => {
          const valor = item.costo_envio != null ? `$${parseFloat(item.costo_envio).toFixed(2)}` : null;
          return (
            <Entrada indice={index}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Entrega ${item.id}${valor ? `, ${valor}` : ''}. Estado: ${etiquetaEstado[item.estado]}. Recoger en ${item.recogida.nombre}, ${item.recogida.direccion}. Entregar en ${item.destino_direccion}. Ver detalle`}
                onPress={() => navigation.navigate('EntregaDetalle', { entrega: item })}
                android_ripple={{ color: 'rgba(0,124,171,0.12)' }}
                style={({ pressed }) => pressed && styles.presionada}
              >
                <Boleta
                  pie={
                    <View style={styles.pie}>
                      <Text style={styles.pieRotulo}>Tu carrera</Text>
                      <Text style={styles.precio}>{valor ?? '—'}</Text>
                      <Icono nombre="chevron-forward" tamano={20} color={colores.suave} />
                    </View>
                  }
                >
                  <View style={styles.encabezado}>
                    <Placa numero={item.id} />
                    <Insignia estado={item.estado} />
                  </View>
                  <Tramo
                    icono={item.tipo === 'ENCARGO' ? 'cube-outline' : 'storefront-outline'}
                    rotulo="Recoger en"
                    titulo={item.recogida.nombre}
                    detalle={item.recogida.direccion}
                  />
                  <Tramo
                    icono="location-outline"
                    rotulo="Entregar en"
                    titulo={item.destino_direccion}
                    detalle={item.destino_referencia}
                  />
                </Boleta>
              </Pressable>
            </Entrada>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  container: { backgroundColor: colores.fondo },
  lista: { padding: 12, paddingBottom: 24, gap: 14, flexGrow: 1 },
  filtros: { flexDirection: 'row', gap: 10, padding: 12, paddingBottom: 4 },
  filtro: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radio.medio,
    backgroundColor: colores.tarjeta,
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

  presionada: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  tramo: { flexDirection: 'row', gap: 12, marginTop: 14 },
  tramoIcono: { marginTop: 2 },
  tramoCuerpo: { flex: 1 },
  rotulo: { fontFamily: fuente.displayMedio, fontSize: 15, letterSpacing: 0.8, textTransform: 'uppercase', color: colores.suave },
  valor: { fontSize: 16, fontWeight: '700', color: colores.texto, marginTop: 1 },
  detalle: { fontSize: 14, color: colores.tenue, marginTop: 1 },
  pie: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pieRotulo: { flex: 1, fontFamily: fuente.displayMedio, fontSize: 16, letterSpacing: 0.8, textTransform: 'uppercase', color: colores.tenue },
  precio: { fontFamily: fuente.display, fontSize: 34, lineHeight: 34, color: colores.verde },
  vacio: { alignItems: 'center', gap: 12, marginTop: 56, paddingHorizontal: 32 },
  vacioTexto: { textAlign: 'center', color: colores.tenue, fontSize: 15 },
});
