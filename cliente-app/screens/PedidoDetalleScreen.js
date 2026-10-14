import { useState, useCallback } from 'react';
import { Platform, View, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useTiempoReal } from '../context/RealtimeContext';
import { MOSTRAR_PRECIOS, NOTA_PRECIOS } from '../constants/config';
import { colores, fuente } from '../constants/tema';
import { FRASES, anchoLinea, colorPaso, haloPaso } from '../constants/seguimiento';
import { Aviso, Boleta, FilaDato, Icono, Insignia, NumeroPedido, Text, Titulo, estiloTarjeta } from '../components/ui';

const INTERVALO_REFRESCO_MS = 5000;
const INTERVALO_RESPALDO_MS = 30000;

const dosDigitos = (n) => String(n).padStart(2, '0');

const formatearFecha = (iso) => {
  const f = new Date(iso);
  return `${dosDigitos(f.getDate())}/${dosDigitos(f.getMonth() + 1)}/${f.getFullYear()} ${dosDigitos(f.getHours())}:${dosDigitos(f.getMinutes())}`;
};

const PASOS = [
  { etiqueta: 'Recibido', icono: 'receipt-outline' },
  { etiqueta: 'Recogido', icono: 'bag-check-outline' },
  { etiqueta: 'En camino', icono: 'navigate' },
  { etiqueta: 'Entregado', icono: 'checkmark-circle-outline' },
];
// En la web una región con scroll debe poder enfocarse para desplazarla con el teclado.
const enfocableWeb = Platform.OS === 'web' ? { tabIndex: 0 } : {};

const PASO_DE_ESTADO = { PENDIENTE: 0, ACEPTADO: 0, RECOGIDO: 1, EN_CAMINO: 2, ENTREGADO: 3 };

// Seguimiento en 4 pasos. Para lectores de pantalla se anuncia como una sola barra de progreso.
// Lo recorrido (círculos y línea) toma el color del estado; el paso actual lleva un halo del mismo tono, en color sólido.
// La pista va del centro del primer círculo al del último (cada paso ocupa 1/4 del ancho), así que la línea no pasa del final.
function Seguimiento({ estado }) {
  const actual = PASO_DE_ESTADO[estado];
  const completo = estado === 'ENTREGADO';
  const color = colorPaso(estado);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Seguimiento del pedido"
      aria-valuemin={1}
      aria-valuemax={PASOS.length}
      aria-valuenow={actual + 1}
      aria-valuetext={`Paso ${actual + 1} de ${PASOS.length}: ${PASOS[actual].etiqueta}`}
      style={styles.seguimiento}
    >
      <View style={[styles.pista, { left: `${50 / PASOS.length}%`, right: `${50 / PASOS.length}%` }]}>
        <View style={[styles.relleno, { width: `${anchoLinea(actual, PASOS.length) * 100}%`, backgroundColor: color }]} />
      </View>
      {PASOS.map((paso, i) => {
        const hecho = i <= actual;
        return (
          <View key={paso.etiqueta} style={styles.paso}>
            <View style={[styles.halo, i === actual && !completo && { backgroundColor: haloPaso(estado) }]}>
              <View style={[styles.pasoCirculo, hecho && { backgroundColor: color }]}>
                <Icono nombre={hecho && (i < actual || completo) ? 'checkmark' : paso.icono} tamano={16} color={hecho ? '#fff' : colores.suave} />
              </View>
            </View>
            <Text style={[styles.pasoTexto, hecho && styles.pasoTextoHecho]} numberOfLines={1}>{paso.etiqueta}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function PedidoDetalleScreen({ route }) {
  const { pedido: pedidoInicial } = route.params;
  const [pedido, setPedido] = useState(pedidoInicial);

  const cargar = useCallback(async () => {
    try {
      const response = await api.get(`/pedidos/${pedidoInicial.id}/`);
      setPedido(response.data);
    } catch (err) {
      // un fallo puntual de red no debe romper la pantalla; el siguiente ciclo reintenta
    }
  }, [pedidoInicial.id]);

  const { suscribir, conectado } = useTiempoReal();

  useFocusEffect(
    useCallback(() => {
      cargar();
      const desuscribir = suscribir(cargar);
      const id = setInterval(cargar, conectado ? INTERVALO_RESPALDO_MS : INTERVALO_REFRESCO_MS);
      return () => {
        desuscribir();
        clearInterval(id);
      };
    }, [cargar, suscribir, conectado])
  );

  const subtotal = pedido.detalles.reduce(
    (suma, d) => suma + parseFloat(d.precio_unitario) * d.cantidad,
    0
  );
  // Los pedidos hechos antes de existir las tarifas no tienen envío.
  const envio = pedido.costo_envio == null ? null : parseFloat(pedido.costo_envio);
  const total = subtotal + (envio ?? 0);
  const esEncargo = pedido.tipo === 'ENCARGO';
  const cancelado = pedido.estado === 'CANCELADO';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contenido} {...enfocableWeb}>
      <View testID="ticket-detalle">
        <Boleta
          pie={<Text style={styles.fecha}>Pedido hecho el {formatearFecha(pedido.creado_en)}</Text>}
        >
          <View style={styles.encabezado}>
            <NumeroPedido numero={pedido.id} />
            <Insignia estado={pedido.estado} />
          </View>
          <Text style={[styles.frase, cancelado && styles.cancelada]}>
            {cancelado ? 'Pedido cancelado' : FRASES[pedido.estado]}
          </Text>
          {!cancelado ? <Seguimiento estado={pedido.estado} /> : null}
        </Boleta>
      </View>

      {cancelado && pedido.motivo_cancelacion ? (
        <Aviso tipo="error" icono="close-circle">{`Motivo: ${pedido.motivo_cancelacion}`}</Aviso>
      ) : null}

      <View style={styles.card}>
        {esEncargo ? (
          <FilaDato icono="cube-outline" titulo="Recoger en">
            <Text style={styles.valor}>{pedido.recogida.direccion}</Text>
            {pedido.recogida.referencia ? <Text style={styles.referencia}>{pedido.recogida.referencia}</Text> : null}
            <Text style={styles.secundario}>
              Lo entrega: {pedido.recogida_contacto.nombre} · {pedido.recogida_contacto.telefono}
            </Text>
          </FilaDato>
        ) : (
          <FilaDato icono="restaurant-outline" titulo="Recoger en">
            <Text style={styles.valor}>{pedido.negocio.nombre} · {pedido.sucursal.nombre}</Text>
            <Text style={styles.secundario}>{pedido.sucursal.direccion}</Text>
          </FilaDato>
        )}
        <View style={styles.separador} />
        <FilaDato icono="location-outline" titulo="Entregar en">
          <Text style={styles.valor}>{pedido.destino_direccion}</Text>
          {pedido.destino_referencia ? <Text style={styles.referencia}>{pedido.destino_referencia}</Text> : null}
          {esEncargo ? (
            <Text style={styles.secundario}>
              Lo recibe: {pedido.entrega_contacto.nombre} · {pedido.entrega_contacto.telefono}
            </Text>
          ) : null}
        </FilaDato>
      </View>

      <View style={styles.card}>
        <Titulo estilo={styles.seccion}>{esEncargo ? 'Encargo' : 'Productos'}</Titulo>
        {esEncargo ? <Text style={styles.valor}>{pedido.descripcion}</Text> : null}
        {pedido.detalles.map((d, i) => (
          <View key={`${d.producto}-${i}`} style={styles.fila}>
            <Text style={styles.filaNombre}>{d.cantidad} x {d.producto_nombre}</Text>
            {MOSTRAR_PRECIOS ? (
              <Text style={styles.filaPrecio}>
                ${(parseFloat(d.precio_unitario) * d.cantidad).toFixed(2)}
              </Text>
            ) : null}
          </View>
        ))}
        {envio != null ? (
          <View style={styles.fila}>
            <Text style={styles.filaNombre}>
              Envío{pedido.distancia_km ? ` (${parseFloat(pedido.distancia_km).toFixed(1)} km)` : ''}
            </Text>
            <Text style={styles.filaPrecio}>${envio.toFixed(2)}</Text>
          </View>
        ) : null}
        {MOSTRAR_PRECIOS ? (
          <View style={styles.filaTotal}>
            <Text style={styles.totalTexto}>Total</Text>
            <Text style={styles.totalTexto}>${total.toFixed(2)}</Text>
          </View>
        ) : (
          <Aviso tipo="info" estilo={styles.nota}>
            {esEncargo
              ? pedido.pagar_en_recogida
                ? `Al recibir pagas el envío más lo que el motorizado gaste en el lugar (aprox. $${parseFloat(pedido.monto_estimado).toFixed(2)}).`
                : 'Al recibir pagas solo el envío.'
              : NOTA_PRECIOS}
          </Aviso>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 16, paddingBottom: 32, gap: 14 },
  card: { ...estiloTarjeta },
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  fecha: { fontFamily: fuente.media, fontSize: 13, color: colores.tenue },
  frase: { marginTop: 12, fontFamily: fuente.extra, fontSize: 18, lineHeight: 24, color: colores.texto },
  cancelada: { color: colores.peligro },
  seccion: { fontSize: 17, marginBottom: 6 },
  separador: { height: 1, backgroundColor: colores.borde, marginVertical: 4 },
  valor: { fontFamily: fuente.negrita, fontSize: 15, color: colores.texto, marginTop: 2 },
  secundario: { fontFamily: fuente.media, fontSize: 13, color: colores.tenue, marginTop: 3 },
  referencia: { fontFamily: fuente.media, fontSize: 13, color: colores.tenue, marginTop: 4 },

  // La pista va detrás de los círculos y llega solo hasta el centro del último: el relleno nunca lo pasa.
  seguimiento: { flexDirection: 'row', marginTop: 16 },
  pista: { position: 'absolute', top: 18, height: 4, borderRadius: 2, backgroundColor: '#dfe6ea' },
  relleno: { height: 4, borderRadius: 2 },
  paso: { flex: 1, alignItems: 'center' },
  halo: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pasoCirculo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dfe6ea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasoTexto: { fontFamily: fuente.negrita, fontSize: 10.5, color: colores.suave, marginTop: 4 },
  pasoTextoHecho: { color: colores.texto },

  fila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  filaNombre: { fontFamily: fuente.media, fontSize: 14.5, flex: 1, paddingRight: 8, color: colores.texto },
  filaPrecio: { fontFamily: fuente.media, fontSize: 14.5, color: colores.tenue },
  filaTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderTopWidth: 1,
    borderTopColor: colores.borde,
    marginTop: 8,
    paddingTop: 12,
  },
  totalTexto: { fontFamily: fuente.extra, fontSize: 20, color: colores.texto },
  nota: { marginTop: 10 },
});
