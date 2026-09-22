import { useState, useCallback } from 'react';
import { Text, View, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { useTiempoReal } from '../context/RealtimeContext';
import { colorAccion, colorEstado, siguienteEstado } from '../constants/estados';

const INTERVALO_REFRESCO_MS = 5000;
const INTERVALO_RESPALDO_MS = 30000;

const dosDigitos = (n) => String(n).padStart(2, '0');

const formatearFecha = (iso) => {
  const f = new Date(iso);
  return `${dosDigitos(f.getDate())}/${dosDigitos(f.getMonth() + 1)}/${f.getFullYear()} ${dosDigitos(f.getHours())}:${dosDigitos(f.getMinutes())}`;
};

export default function EntregaDetalleScreen({ route }) {
  const { entrega: entregaInicial } = route.params;
  const insets = useSafeAreaInsets();
  const [entrega, setEntrega] = useState(entregaInicial);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState('');
  const [reasignada, setReasignada] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const response = await api.get(`/mis-entregas/${entregaInicial.id}/`);
      setEntrega(response.data);
      setReasignada(false);
    } catch (err) {
      // 404: el despachador se la asignó a otro motorizado. Otros fallos (red): el siguiente ciclo reintenta.
      if (err.response?.status === 404) setReasignada(true);
    }
  }, [entregaInicial.id]);

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

  const proximoEstado = reasignada ? undefined : siguienteEstado[entrega.estado];
  const esEncargo = entrega.tipo === 'ENCARGO';

  const llamarAlCliente = () => {
    Linking.openURL(`tel:${entrega.cliente.telefono.replace(/[\s-]/g, '')}`).catch(() => {});
  };

  const llamarAlContacto = () => {
    Linking.openURL(`tel:${entrega.contacto.telefono.replace(/[\s-]/g, '')}`).catch(() => {});
  };

  // La dirección en texto a veces viene incompleta; esto abre Google Maps con las coordenadas exactas,
  // con ruta calculada desde donde está el motorizado ahora mismo.
  const comoLlegar = (lat, lng) => {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`).catch(() => {});
  };

  const avanzarEstado = async () => {
    setActualizando(true);
    setError('');
    try {
      const response = await api.patch(`/pedidos/${entrega.id}/estado/`, { estado: proximoEstado });
      setEntrega(response.data);
    } catch (err) {
      // 400: el estado ya cambió (p. ej. el despachador lo movió); se muestra el motivo y se recarga.
      setError(err.response?.data?.estado?.[0] ?? 'No se pudo actualizar el estado');
      cargar();
    }
    setActualizando(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contenido}>
        {reasignada ? (
          <View style={styles.avisoReasignada}>
            <Text style={styles.avisoReasignadaTexto}>
              El despachador reasignó esta entrega a otro motorizado. Ya no te corresponde.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={[styles.badge, { backgroundColor: colorEstado[entrega.estado] }]}>
            <Text style={styles.badgeTexto}>{entrega.estado}</Text>
          </View>
          <Text style={styles.titulo}>Entrega #{entrega.id}</Text>
          <Text style={styles.fecha}>{formatearFecha(entrega.creado_en)}</Text>
        </View>

        {entrega.estado === 'CANCELADO' && entrega.motivo_cancelacion ? (
          <View style={styles.card}>
            <Text style={styles.seccion}>Motivo de la cancelación</Text>
            <Text style={styles.valor}>{entrega.motivo_cancelacion}</Text>
          </View>
        ) : null}

        {entrega.costo_envio != null ? (
          <View style={styles.card}>
            <Text style={styles.seccion}>Valor de la carrera</Text>
            <Text style={styles.carrera}>${parseFloat(entrega.costo_envio).toFixed(2)}</Text>
            {entrega.distancia_km ? (
              <Text style={styles.secundario}>Aprox. {parseFloat(entrega.distancia_km).toFixed(1)} km</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.seccion}>Recoger en</Text>
          <Text style={styles.valor}>{entrega.recogida.nombre}</Text>
          <Text style={styles.secundario}>{entrega.recogida.direccion}</Text>
          {entrega.recogida.referencia ? (
            <Text style={styles.referencia}>{entrega.recogida.referencia}</Text>
          ) : null}
          <TouchableOpacity
            style={styles.comoLlegarBoton}
            onPress={() => comoLlegar(entrega.recogida.lat, entrega.recogida.lng)}
          >
            <Text style={styles.comoLlegarTexto}>📍 Cómo llegar</Text>
          </TouchableOpacity>
          {entrega.contacto ? (
            <View style={styles.contactoRecogida}>
              <Text style={styles.secundario}>Lo entrega: {entrega.contacto.nombre}</Text>
              {entrega.contacto.telefono ? (
                <TouchableOpacity onPress={llamarAlContacto}>
                  <Text style={styles.telefono}>📞 {entrega.contacto.telefono}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>

        {esEncargo && entrega.pagar_en_recogida ? (
          <View style={styles.avisoPago}>
            <Text style={styles.avisoPagoTexto}>
              Debes pagar al recoger: aprox. ${parseFloat(entrega.monto_estimado).toFixed(2)}.
              Al entregar cobras al cliente lo que pagaste más tu carrera.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.seccion}>Entregar en</Text>
          <Text style={styles.valor}>{entrega.destino_direccion}</Text>
          {entrega.destino_referencia ? (
            <Text style={styles.referencia}>{entrega.destino_referencia}</Text>
          ) : null}
          <TouchableOpacity
            style={styles.comoLlegarBoton}
            onPress={() => comoLlegar(entrega.destino_lat, entrega.destino_lng)}
          >
            <Text style={styles.comoLlegarTexto}>📍 Cómo llegar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.seccion}>Cliente</Text>
          <Text style={styles.valor}>{entrega.cliente.nombre}</Text>
          {entrega.cliente.telefono ? (
            <TouchableOpacity onPress={llamarAlCliente}>
              <Text style={styles.telefono}>📞 {entrega.cliente.telefono}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.secundario}>
              {proximoEstado ? 'Sin teléfono registrado' : 'Contacto oculto: la entrega ya finalizó'}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.seccion}>{esEncargo ? 'Qué recoger' : 'Productos'}</Text>
          {esEncargo ? <Text style={styles.producto}>{entrega.descripcion}</Text> : null}
          {entrega.detalles.map((d, i) => (
            <Text key={`${d.producto}-${i}`} style={styles.producto}>
              {d.cantidad} x {d.producto_nombre}
            </Text>
          ))}
        </View>
      </ScrollView>

      {proximoEstado ? (
        <View style={[styles.barraInferior, { paddingBottom: 16 + insets.bottom }]}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.boton, { backgroundColor: colorAccion[proximoEstado] }, actualizando && styles.botonOcupado]}
            onPress={avanzarEstado}
            disabled={actualizando}
          >
            <Text style={styles.botonTexto}>
              {actualizando ? 'Actualizando...' : `Marcar como ${proximoEstado}`}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
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
  carrera: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2e8b57',
  },
  referencia: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  avisoReasignada: {
    backgroundColor: '#fff4e0',
    borderColor: '#e08a1e',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  avisoReasignadaTexto: {
    color: '#7a4b00',
    fontSize: 13,
  },
  comoLlegarBoton: {
    alignSelf: 'flex-start',
    borderColor: '#007cab',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  comoLlegarTexto: {
    color: '#007cab',
    fontSize: 13,
    fontWeight: '600',
  },
  contactoRecogida: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  avisoPago: {
    backgroundColor: '#fff4e0',
    borderColor: '#e08a1e',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  avisoPagoTexto: {
    color: '#7a4b00',
    fontSize: 13,
  },
  telefono: {
    fontSize: 15,
    color: '#1e6fe0',
    fontWeight: '600',
    marginTop: 4,
  },
  producto: {
    fontSize: 15,
    paddingVertical: 3,
  },
  barraInferior: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  boton: {
    backgroundColor: '#007cab',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  botonOcupado: {
    backgroundColor: '#aaa',
  },
  botonTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  error: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 8,
  },
});
