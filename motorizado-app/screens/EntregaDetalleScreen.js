import { useState, useCallback } from 'react';
import { Text, View, ScrollView, StyleSheet, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { useTiempoReal } from '../context/RealtimeContext';
import { colorAccion, iconoEstado, siguienteEstado, textoAccion } from '../constants/estados';
import { colores, radio } from '../constants/tema';
import { Boton, Icono, Insignia, Titulo, estiloTarjeta } from '../components/ui';

const INTERVALO_REFRESCO_MS = 5000;
const INTERVALO_RESPALDO_MS = 30000;

const dosDigitos = (n) => String(n).padStart(2, '0');

const formatearFecha = (iso) => {
  const f = new Date(iso);
  return `${dosDigitos(f.getDate())}/${dosDigitos(f.getMonth() + 1)}/${f.getFullYear()} ${dosDigitos(f.getHours())}:${dosDigitos(f.getMinutes())}`;
};

const llamar = (telefono) => {
  Linking.openURL(`tel:${telefono.replace(/[\s-]/g, '')}`).catch(() => {});
};

// La dirección en texto a veces viene incompleta; esto abre Google Maps con las coordenadas exactas,
// con ruta calculada desde donde está el motorizado ahora mismo.
const comoLlegar = (lat, lng) => {
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`).catch(() => {});
};

// Quien entrega o recibe en un extremo, con un botón grande para llamarle (se usa con el pulgar en moto).
function Contacto({ rotulo, contacto }) {
  if (!contacto) return null;
  return (
    <View style={styles.contacto}>
      <Text style={styles.contactoRotulo}>{rotulo}</Text>
      <Text style={styles.contactoNombre}>{contacto.nombre}</Text>
      {contacto.telefono ? (
        <Boton
          titulo={contacto.telefono}
          etiqueta={`Llamar a ${contacto.nombre}, ${contacto.telefono}`}
          variante="secundario"
          icono="call-outline"
          onPress={() => llamar(contacto.telefono)}
          estilo={styles.botonSecundario}
        />
      ) : null}
    </View>
  );
}

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
      <ScrollView contentContainerStyle={[styles.contenido, !proximoEstado && { paddingBottom: 24 + insets.bottom }]}>
        {reasignada ? (
          <View style={styles.reasignada} accessibilityRole="alert">
            <Icono nombre="swap-horizontal" tamano={22} color={colores.naranja} />
            <Text style={styles.reasignadaTexto}>
              El despachador reasignó esta entrega a otro motorizado. Ya no te corresponde.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.encabezado}>
            <Insignia estado={entrega.estado} />
            <Text style={styles.fecha}>{formatearFecha(entrega.creado_en)}</Text>
          </View>
          <Titulo estilo={styles.titulo}>Entrega #{entrega.id}</Titulo>
        </View>

        {entrega.estado === 'CANCELADO' ? (
          <View style={styles.cancelado} accessibilityRole="alert">
            <Icono nombre="close-circle" tamano={24} color={colores.peligro} />
            <View style={styles.canceladoCuerpo}>
              <Text style={styles.canceladoTitulo}>Entrega cancelada</Text>
              {entrega.motivo_cancelacion ? <Text style={styles.canceladoTexto}>{entrega.motivo_cancelacion}</Text> : null}
            </View>
          </View>
        ) : null}

        {entrega.costo_envio != null ? (
          <View style={styles.carrera} accessible accessibilityLabel={`Valor de la carrera: ${parseFloat(entrega.costo_envio).toFixed(2)} dólares${entrega.distancia_km ? `, aproximadamente ${parseFloat(entrega.distancia_km).toFixed(1)} kilómetros` : ''}`}>
            <View>
              <Text style={styles.carreraRotulo}>Valor de la carrera</Text>
              {entrega.distancia_km ? (
                <Text style={styles.carreraKm}>Aprox. {parseFloat(entrega.distancia_km).toFixed(1)} km</Text>
              ) : null}
            </View>
            <Text style={styles.carreraValor}>${parseFloat(entrega.costo_envio).toFixed(2)}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.bloqueCabecera}>
            <View style={styles.bloqueIcono}>
              <Icono nombre={esEncargo ? 'cube-outline' : 'storefront-outline'} tamano={20} color={colores.primarioOscuro} />
            </View>
            <Titulo estilo={styles.bloqueTitulo}>Recoger en</Titulo>
          </View>
          <Text style={styles.valor}>{entrega.recogida.nombre}</Text>
          <Text style={styles.secundario}>{entrega.recogida.direccion}</Text>
          {entrega.recogida.referencia ? <Text style={styles.referencia}>{entrega.recogida.referencia}</Text> : null}
          <Boton
            titulo="Cómo llegar"
            etiqueta="Cómo llegar al punto de recogida"
            variante="secundario"
            icono="navigate-outline"
            onPress={() => comoLlegar(entrega.recogida.lat, entrega.recogida.lng)}
            estilo={styles.botonSecundario}
          />
          <Contacto rotulo="Lo entrega" contacto={entrega.recogida_contacto} />
        </View>

        {esEncargo && entrega.pagar_en_recogida ? (
          <View style={styles.avisoPago} accessibilityRole="alert">
            <Icono nombre="cash-outline" tamano={24} color={colores.naranja} />
            <Text style={styles.avisoPagoTexto}>
              Debes pagar al recoger: aprox. ${parseFloat(entrega.monto_estimado).toFixed(2)}. Al entregar cobras al
              cliente lo que pagaste más tu carrera.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.bloqueCabecera}>
            <View style={styles.bloqueIcono}>
              <Icono nombre="location-outline" tamano={20} color={colores.primarioOscuro} />
            </View>
            <Titulo estilo={styles.bloqueTitulo}>Entregar en</Titulo>
          </View>
          <Text style={styles.valor}>{entrega.destino_direccion}</Text>
          {entrega.destino_referencia ? <Text style={styles.referencia}>{entrega.destino_referencia}</Text> : null}
          <Boton
            titulo="Cómo llegar"
            etiqueta="Cómo llegar al punto de entrega"
            variante="secundario"
            icono="navigate-outline"
            onPress={() => comoLlegar(entrega.destino_lat, entrega.destino_lng)}
            estilo={styles.botonSecundario}
          />
          <Contacto rotulo="Lo recibe" contacto={entrega.entrega_contacto} />
        </View>

        <View style={styles.card}>
          <View style={styles.bloqueCabecera}>
            <View style={styles.bloqueIcono}>
              <Icono nombre="person-outline" tamano={20} color={colores.primarioOscuro} />
            </View>
            <Titulo estilo={styles.bloqueTitulo}>Cliente</Titulo>
          </View>
          <Text style={styles.valor}>{entrega.cliente.nombre}</Text>
          {entrega.cliente.telefono ? (
            <Boton
              titulo={entrega.cliente.telefono}
              etiqueta={`Llamar a ${entrega.cliente.nombre}, ${entrega.cliente.telefono}`}
              variante="secundario"
              icono="call-outline"
              onPress={() => llamar(entrega.cliente.telefono)}
              estilo={styles.botonSecundario}
            />
          ) : (
            <Text style={styles.secundario}>
              {proximoEstado ? 'Sin teléfono registrado' : 'Contacto oculto: la entrega ya finalizó'}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.bloqueCabecera}>
            <View style={styles.bloqueIcono}>
              <Icono nombre="bag-outline" tamano={20} color={colores.primarioOscuro} />
            </View>
            <Titulo estilo={styles.bloqueTitulo}>{esEncargo ? 'Qué recoger' : 'Productos'}</Titulo>
          </View>
          {esEncargo ? <Text style={styles.producto}>{entrega.descripcion}</Text> : null}
          {entrega.detalles.map((d, i) => (
            <Text key={`${d.producto}-${i}`} style={styles.producto}>
              {d.cantidad} x {d.producto_nombre}
            </Text>
          ))}
        </View>
      </ScrollView>

      {proximoEstado ? (
        <View style={[styles.barraInferior, { paddingBottom: 12 + insets.bottom }]}>
          {error ? (
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>
          ) : null}
          <Boton
            titulo={actualizando ? 'Actualizando…' : textoAccion[proximoEstado]}
            etiqueta={textoAccion[proximoEstado]}
            icono={iconoEstado[proximoEstado]}
            colorFondo={colorAccion[proximoEstado]}
            onPress={avanzarEstado}
            cargando={actualizando}
            estilo={styles.botonAccion}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 16, gap: 14 },
  card: { ...estiloTarjeta },
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { fontSize: 24, marginTop: 12 },
  fecha: { fontSize: 13, color: colores.tenue },

  reasignada: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff4e0',
    borderLeftWidth: 5,
    borderLeftColor: colores.naranja,
    borderRadius: radio.medio,
    padding: 14,
  },
  reasignadaTexto: { flex: 1, fontSize: 15, fontWeight: '600', color: '#5c3300' },

  cancelado: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colores.peligroSuave,
    borderRadius: radio.grande,
    borderLeftWidth: 5,
    borderLeftColor: colores.peligro,
    padding: 16,
  },
  canceladoCuerpo: { flex: 1 },
  canceladoTitulo: { fontSize: 16, fontWeight: '800', color: colores.peligro },
  canceladoTexto: { fontSize: 15, color: colores.texto, marginTop: 4 },

  carrera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e6f6ec',
    borderRadius: radio.grande,
    padding: 18,
  },
  carreraRotulo: { fontSize: 14, fontWeight: '700', color: colores.texto },
  carreraKm: { fontSize: 13, color: colores.tenue, marginTop: 2 },
  carreraValor: { fontSize: 34, fontWeight: '800', color: colores.verde },

  bloqueCabecera: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  bloqueIcono: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colores.acentoSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloqueTitulo: { fontSize: 16 },
  valor: { fontSize: 17, fontWeight: '700', color: colores.texto },
  secundario: { fontSize: 15, color: colores.tenue, marginTop: 3 },
  referencia: { fontSize: 15, color: colores.tenue, fontStyle: 'italic', marginTop: 4 },
  botonSecundario: { marginTop: 12, minHeight: 56 },

  contacto: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colores.borde },
  contactoRotulo: { fontSize: 12, fontWeight: '700', color: colores.suave, textTransform: 'uppercase', letterSpacing: 0.4 },
  contactoNombre: { fontSize: 16, fontWeight: '700', color: colores.texto, marginTop: 2 },

  avisoPago: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff4e0',
    borderLeftWidth: 5,
    borderLeftColor: colores.naranja,
    borderRadius: radio.medio,
    padding: 14,
  },
  avisoPagoTexto: { flex: 1, fontSize: 15, fontWeight: '600', color: '#5c3300', lineHeight: 21 },

  producto: { fontSize: 16, paddingVertical: 3, color: colores.texto },

  barraInferior: {
    backgroundColor: colores.tarjeta,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  botonAccion: { minHeight: 60 },
  error: { color: colores.peligro, fontWeight: '600', fontSize: 14, textAlign: 'center', marginBottom: 8 },
});
