import { useState, useCallback } from 'react';
import { Text, View, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useTiempoReal } from '../context/RealtimeContext';
import { etiquetaEstado } from '../constants/estados';
import { MOSTRAR_PRECIOS, NOTA_PRECIOS } from '../constants/config';
import { colores } from '../constants/tema';
import { FilaDato, Icono, Insignia, Titulo, estiloTarjeta } from '../components/ui';

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
const PASO_DE_ESTADO = { PENDIENTE: 0, ACEPTADO: 0, RECOGIDO: 1, EN_CAMINO: 2, ENTREGADO: 3 };

// Seguimiento en 4 pasos. Para lectores de pantalla se anuncia como una sola barra de progreso.
function Seguimiento({ estado }) {
  const actual = PASO_DE_ESTADO[estado];
  const completo = estado === 'ENTREGADO';
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
      {PASOS.map((paso, i) => {
        const hecho = i <= actual;
        return (
          <View key={paso.etiqueta} style={styles.paso}>
            <View style={styles.pasoFila}>
              <View style={[styles.conector, i === 0 && styles.conectorOculto, i <= actual && styles.conectorHecho]} />
              <View style={[styles.pasoCirculo, hecho && styles.pasoCirculoHecho, i === actual && !completo && styles.pasoCirculoActual]}>
                <Icono nombre={hecho && (i < actual || completo) ? 'checkmark' : paso.icono} tamano={18} color={hecho ? '#fff' : colores.suave} />
              </View>
              <View style={[styles.conector, i === PASOS.length - 1 && styles.conectorOculto, i < actual && styles.conectorHecho]} />
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contenido}>
      <View style={styles.card}>
        <View style={styles.encabezado}>
          <Insignia estado={pedido.estado} />
          <Text style={styles.fecha}>{formatearFecha(pedido.creado_en)}</Text>
        </View>
        <Titulo estilo={styles.titulo}>Pedido #{pedido.id}</Titulo>
        {pedido.estado !== 'CANCELADO' ? <Seguimiento estado={pedido.estado} /> : null}
      </View>

      {pedido.estado === 'CANCELADO' ? (
        <View style={styles.cancelado} accessibilityRole="alert">
          <Icono nombre="close-circle" tamano={24} color={colores.peligro} />
          <View style={styles.canceladoCuerpo}>
            <Text style={styles.canceladoTitulo}>Pedido cancelado</Text>
            {pedido.motivo_cancelacion ? (
              <Text style={styles.canceladoTexto}>{pedido.motivo_cancelacion}</Text>
            ) : null}
          </View>
        </View>
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
          <FilaDato icono="restaurant-outline" titulo="Restaurante">
            <Text style={styles.valor}>{pedido.negocio.nombre} · {pedido.sucursal.nombre}</Text>
            <Text style={styles.secundario}>{pedido.sucursal.direccion}</Text>
          </FilaDato>
        )}
        <View style={styles.separador} />
        <FilaDato icono="location-outline" titulo="Entrega">
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
          <View style={styles.nota}>
            <Icono nombre="information-circle-outline" tamano={18} color={colores.primarioOscuro} />
            <Text style={styles.notaPrecios}>
              {esEncargo
                ? pedido.pagar_en_recogida
                  ? `Al recibir pagas el envío más lo que el motorizado gaste en el lugar (aprox. $${parseFloat(pedido.monto_estimado).toFixed(2)}).`
                  : 'Al recibir pagas solo el envío.'
                : NOTA_PRECIOS}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 16, paddingBottom: 32, gap: 14 },
  card: { ...estiloTarjeta },
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { fontSize: 24, marginTop: 12 },
  fecha: { fontSize: 13, color: colores.tenue },
  seccion: { fontSize: 17, marginBottom: 6 },
  separador: { height: 1, backgroundColor: colores.borde, marginVertical: 4 },
  valor: { fontSize: 16, fontWeight: '600', color: colores.texto, marginTop: 2 },
  secundario: { fontSize: 14, color: colores.tenue, marginTop: 3 },
  referencia: { fontSize: 14, color: colores.tenue, fontStyle: 'italic', marginTop: 3 },

  seguimiento: { flexDirection: 'row', marginTop: 18 },
  paso: { flex: 1, alignItems: 'center' },
  pasoFila: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  conector: { flex: 1, height: 3, backgroundColor: '#dfe5e9' },
  conectorOculto: { backgroundColor: 'transparent' },
  conectorHecho: { backgroundColor: colores.primario },
  pasoCirculo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e8edf0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasoCirculoHecho: { backgroundColor: colores.primario },
  pasoCirculoActual: { borderWidth: 3, borderColor: colores.acentoSuave, width: 44, height: 44, borderRadius: 22 },
  pasoTexto: { fontSize: 12, fontWeight: '600', color: colores.suave, marginTop: 6 },
  pasoTextoHecho: { color: colores.texto, fontWeight: '800' },

  cancelado: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colores.peligroSuave,
    borderRadius: 16,
    borderLeftWidth: 5,
    borderLeftColor: colores.peligro,
    padding: 16,
  },
  canceladoCuerpo: { flex: 1 },
  canceladoTitulo: { fontSize: 16, fontWeight: '800', color: colores.peligro },
  canceladoTexto: { fontSize: 15, color: colores.texto, marginTop: 4 },

  fila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  filaNombre: { fontSize: 15, flex: 1, paddingRight: 8, color: colores.texto },
  filaPrecio: { fontSize: 15, color: colores.tenue },
  filaTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colores.borde,
    marginTop: 8,
    paddingTop: 12,
  },
  totalTexto: { fontSize: 17, fontWeight: '800' },
  nota: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colores.acentoSuave,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  notaPrecios: { flex: 1, fontSize: 13, color: colores.texto, lineHeight: 18 },
});
