import { useState, useCallback } from 'react';
import { Text, View, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useTiempoReal } from '../context/RealtimeContext';
import { colorEstado } from '../constants/estados';
import { MOSTRAR_PRECIOS, NOTA_PRECIOS } from '../constants/config';

const INTERVALO_REFRESCO_MS = 5000;
const INTERVALO_RESPALDO_MS = 30000;

const dosDigitos = (n) => String(n).padStart(2, '0');

const formatearFecha = (iso) => {
  const f = new Date(iso);
  return `${dosDigitos(f.getDate())}/${dosDigitos(f.getMonth() + 1)}/${f.getFullYear()} ${dosDigitos(f.getHours())}:${dosDigitos(f.getMinutes())}`;
};

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
        <View style={[styles.badge, { backgroundColor: colorEstado[pedido.estado] }]}>
          <Text style={styles.badgeTexto}>{pedido.estado}</Text>
        </View>
        <Text style={styles.titulo}>Pedido #{pedido.id}</Text>
        <Text style={styles.fecha}>{formatearFecha(pedido.creado_en)}</Text>
      </View>

      {pedido.estado === 'CANCELADO' && pedido.motivo_cancelacion ? (
        <View style={styles.card}>
          <Text style={styles.seccion}>Motivo de la cancelación</Text>
          <Text style={styles.valor}>{pedido.motivo_cancelacion}</Text>
        </View>
      ) : null}

      {esEncargo ? (
        <View style={styles.card}>
          <Text style={styles.seccion}>Recoger en</Text>
          <Text style={styles.valor}>{pedido.recogida.direccion}</Text>
          {pedido.recogida.referencia ? (
            <Text style={styles.referencia}>{pedido.recogida.referencia}</Text>
          ) : null}
          <Text style={styles.secundario}>
            Lo entrega: {pedido.contacto.nombre} · {pedido.contacto.telefono}
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.seccion}>Restaurante</Text>
          <Text style={styles.valor}>{pedido.negocio.nombre} · {pedido.sucursal.nombre}</Text>
          <Text style={styles.secundario}>{pedido.sucursal.direccion}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.seccion}>Entrega</Text>
        <Text style={styles.valor}>{pedido.destino_direccion}</Text>
        {pedido.destino_referencia ? (
          <Text style={styles.referencia}>{pedido.destino_referencia}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.seccion}>{esEncargo ? 'Encargo' : 'Productos'}</Text>
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
          <Text style={styles.notaPrecios}>
            {esEncargo
              ? pedido.pagar_en_recogida
                ? `Al recibir pagas el envío más lo que el motorizado gaste en el lugar (aprox. $${parseFloat(pedido.monto_estimado).toFixed(2)}).`
                : 'Al recibir pagas solo el envío.'
              : NOTA_PRECIOS}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
  },
  contenido: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
  titulo: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  fecha: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  seccion: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  valor: {
    fontSize: 15,
    fontWeight: '600',
  },
  secundario: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  referencia: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  notaPrecios: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  filaNombre: {
    fontSize: 15,
    flex: 1,
    paddingRight: 8,
  },
  filaPrecio: {
    fontSize: 15,
    color: '#666',
  },
  filaTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    marginTop: 8,
    paddingTop: 10,
  },
  totalTexto: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
