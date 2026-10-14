import { useState, useCallback, useRef } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { pedir } from '../services/consultas';
import { useCargaRapida } from '../hooks/useCargaRapida';
import { useTiempoReal } from '../context/RealtimeContext';
import { esFinal, etiquetaEstado } from '../constants/estados';
import { MOSTRAR_PRECIOS } from '../constants/config';
import { colores, fuente, tipo, radio, espacio } from '../constants/tema';
import { Aviso, AvisosCarga, Boleta, Boton, Entrada, Esqueleto, Icono, Insignia, NumeroPedido, Presionable, Text } from '../components/ui';

const INTERVALO_REFRESCO_MS = 5000;
const INTERVALO_RESPALDO_MS = 30000;

// Ticket de pedido mientras llegan los datos: la misma boleta y los mismos huecos que el real, para que nada salte.
function TicketEsqueleto() {
  return (
    <View style={styles.celda}>
      <Boleta pie={<Esqueleto ancho="45%" alto={21} />}>
        <View style={styles.encabezado}>
          <Esqueleto ancho={96} alto={24} />
          <Esqueleto ancho={84} alto={28} radio={14} />
        </View>
        <Esqueleto ancho="60%" alto={27} estilo={styles.esqueletoNombre} />
        <Esqueleto ancho="80%" alto={20} estilo={styles.esqueletoDestino} />
      </Boleta>
    </View>
  );
}

const SIN_PEDIDOS = [];
const pedirPedidos = pedir('/pedidos/');

export default function MisPedidosScreen({ navigation }) {
  const { suscribir, conectado } = useTiempoReal();
  // Con el socket conectado el sondeo es solo un respaldo; sin él vuelve al ritmo rápido.
  const { datos, vinoDeCache, cargando, error, lento, recargar } = useCargaRapida('pedidos', pedirPedidos, {
    intervalo: conectado ? INTERVALO_RESPALDO_MS : INTERVALO_REFRESCO_MS,
  });
  const pedidos = datos ?? SIN_PEDIDOS;
  const [refrescando, setRefrescando] = useState(false);
  const lista = useRef(null);
  useScrollToTop(lista); // tocar de nuevo la pestaña activa vuelve al inicio de la lista
  const [verHistorial, setVerHistorial] = useState(false);

  // Un aviso del servidor ("algo cambió") vuelve a pedir la lista.
  useFocusEffect(useCallback(() => suscribir(() => recargar({ forzar: true })), [suscribir, recargar]));

  const refrescar = async () => {
    setRefrescando(true);
    await recargar({ forzar: true, manual: true });
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
            <Presionable
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
            </Presionable>
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
            : item.costo_envio == null ? 'Envío por definir' : `Envío $${parseFloat(item.costo_envio).toFixed(2)}`;
          return (
            <Entrada indice={index} estilo={styles.celda} tipo="fundido" animar={!vinoDeCache}>
              <Presionable
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
              </Presionable>
            </Entrada>
          );
        }}
        ListHeaderComponent={<AvisosCarga lento={lento} error={error} hayDatos={datos !== undefined} estilo={styles.avisoCarga} />}
        ListEmptyComponent={
          cargando ? (
            <View accessible accessibilityRole="progressbar" accessibilityLabel="Cargando" aria-busy>
              {[0, 1].map((i) => <TicketEsqueleto key={i} />)}
            </View>
          ) : error && datos === undefined ? (
            <View style={styles.errorCarga}>
              <Aviso tipo="error">No pudimos cargar tus pedidos. Revisa tu conexión.</Aviso>
              <Boton titulo="Reintentar" variante="secundario" icono="refresh" onPress={() => recargar({ forzar: true, manual: true })} />
            </View>
          ) : (
            <View style={styles.vacio}>
              <Icono nombre={verHistorial ? 'archive-outline' : 'receipt-outline'} tamano={44} color={colores.suave} />
              <Text style={styles.vacioTexto}>
                {verHistorial ? 'Aún no tienes pedidos entregados ni cancelados' : 'No tienes pedidos activos'}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  // Pestañas tipo interruptor: la activa es una pastilla blanca sobre el fondo gris.
  filtros: { flexDirection: 'row', margin: espacio.l, marginBottom: espacio.xs, padding: espacio.xs, borderRadius: radio.medio, backgroundColor: colores.relleno },
  filtro: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.s,
    borderRadius: 9,
  },
  filtroActivo: {
    backgroundColor: colores.blanco,
    elevation: 1,
    shadowColor: colores.sombra,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  filtroTexto: { ...tipo.apoyo, fontFamily: fuente.negrita, color: colores.tenue },
  filtroTextoActivo: { color: colores.primarioOscuro },
  contador: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colores.rellenoFuerte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contadorActivo: { backgroundColor: colores.acentoSuave },
  contadorTexto: { ...tipo.etiqueta, color: colores.tenue },
  contadorTextoActivo: { color: colores.primarioOscuro },
  container: { backgroundColor: colores.fondo },
  lista: { padding: espacio.l, paddingBottom: espacio.xl, flexGrow: 1 },
  celda: { marginBottom: espacio.m },
  presionada: { opacity: 0.9 },
  // Todos los tickets tienen la misma estructura (una línea de nombre, una de dirección, un pie) y por eso la misma altura.
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.s },
  nombre: { ...tipo.subtitulo, fontFamily: fuente.extra, marginTop: 10, color: colores.texto },
  destino: { ...tipo.apoyo, marginTop: 3, color: colores.tenue },
  pie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
  envio: { ...tipo.apoyo, fontFamily: fuente.extra, flex: 1, color: colores.texto },
  verDetalle: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 2 },
  verDetalleTexto: { ...tipo.apoyo, fontFamily: fuente.negrita, color: colores.primarioOscuro },
  avisoCarga: { marginBottom: espacio.m },
  errorCarga: { gap: espacio.m },
  esqueletoNombre: { marginTop: 10 },
  esqueletoDestino: { marginTop: 3 },
  vacio: { alignItems: 'center', gap: espacio.m, marginTop: 56, paddingHorizontal: 32 },
  vacioTexto: { textAlign: 'center', color: colores.tenue, fontSize: tipo.cuerpo.fontSize },
});
