import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { guardar as guardarEnCache, leer } from '../services/cache';
import { useCargaRapida } from '../hooks/useCargaRapida';
import { useTiempoReal } from '../context/RealtimeContext';
import { colorAccion, iconoEstado, siguienteEstado, textoAccion } from '../constants/estados';
import { colores, fuente, radio, tipo, espacio } from '../constants/tema';
import { Aviso, Boleta, Boton, Icono, Insignia, NumeroPedido, Text, Titulo, estiloTarjeta } from '../components/ui';

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
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState('');
  const [reasignada, setReasignada] = useState(false);
  const { suscribir, conectado } = useTiempoReal();

  // 404: el despachador se la asignó a otro motorizado. Otros fallos (red): el siguiente ciclo reintenta.
  const pedirEntrega = async () => {
    try {
      const response = await api.get(`/mis-entregas/${entregaInicial.id}/`);
      setReasignada(false);
      return response.data;
    } catch (err) {
      if (err.response?.status === 404) setReasignada(true);
      throw err;
    }
  };

  // Ya se tiene la entrega de la lista: se muestra al instante y se refresca por detrás (sondeo y avisos del servidor).
  const { datos: entrega, recargar, actualizar } = useCargaRapida(`entrega:${entregaInicial.id}`, pedirEntrega, {
    inicial: entregaInicial,
    intervalo: conectado ? INTERVALO_RESPALDO_MS : INTERVALO_REFRESCO_MS,
  });

  useFocusEffect(useCallback(() => suscribir(() => recargar({ forzar: true })), [suscribir, recargar]));

  const proximoEstado = reasignada ? undefined : siguienteEstado[entrega.estado];
  const esEncargo = entrega.tipo === 'ENCARGO';

  const avanzarEstado = async () => {
    setActualizando(true);
    setError('');
    try {
      const response = await api.patch(`/pedidos/${entrega.id}/estado/`, { estado: proximoEstado });
      actualizar(response.data);
      // La lista de Mis entregas guardada también debe mostrar el estado nuevo al volver (misma forma de datos).
      const lista = leer('entregas');
      if (lista) guardarEnCache('entregas', lista.map((e) => (e.id === response.data.id ? response.data : e)));
    } catch (err) {
      // 400: el estado ya cambió (p. ej. el despachador lo movió); se muestra el motivo y se recarga.
      setError(err.response?.data?.estado?.[0] ?? 'No se pudo actualizar el estado');
      recargar({ forzar: true });
    }
    setActualizando(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.contenido, !proximoEstado && { paddingBottom: espacio.xl + insets.bottom }]}>
        {reasignada ? (
          <Aviso tipo="alerta" icono="swap-horizontal">
            El despachador reasignó esta entrega a otro motorizado. Ya no te corresponde.
          </Aviso>
        ) : null}

        <View testID="ticket-entrega-detalle">
          <Boleta pie={<Text style={styles.fecha}>Pedido hecho el {formatearFecha(entrega.creado_en)}</Text>}>
            <View style={styles.encabezado}>
              <NumeroPedido numero={entrega.id} prefijo="Entrega" />
              <Insignia estado={entrega.estado} />
            </View>
            {/* Los pedidos hechos antes de existir las tarifas no tienen valor de carrera: se muestra "—". */}
            <View
              style={styles.carrera}
              accessible
              accessibilityLabel={
                entrega.costo_envio != null
                  ? `Valor de la carrera: ${parseFloat(entrega.costo_envio).toFixed(2)} dólares${entrega.distancia_km ? `, aproximadamente ${parseFloat(entrega.distancia_km).toFixed(1)} kilómetros` : ''}`
                  : 'Valor de la carrera: sin valor registrado'
              }
            >
              <Text style={styles.carreraRotulo}>Tu carrera</Text>
              <Text style={styles.carreraValor}>
                {entrega.costo_envio != null ? `$${parseFloat(entrega.costo_envio).toFixed(2)}` : '—'}
              </Text>
              {entrega.costo_envio != null && entrega.distancia_km ? (
                <Text style={styles.carreraKm}>Aprox. {parseFloat(entrega.distancia_km).toFixed(1)} km</Text>
              ) : null}
            </View>
          </Boleta>
        </View>

        {entrega.estado === 'CANCELADO' ? (
          <Aviso tipo="error" icono="close-circle">
            {`Entrega cancelada${entrega.motivo_cancelacion ? `: ${entrega.motivo_cancelacion}` : ''}`}
          </Aviso>
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
          <Aviso tipo="alerta" icono="cash-outline">
            {`Debes pagar al recoger: aprox. $${parseFloat(entrega.monto_estimado).toFixed(2)}. Al entregar cobras al cliente lo que pagaste más tu carrera.`}
          </Aviso>
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
        <View style={[styles.barraInferior, { paddingBottom: espacio.m + insets.bottom }]}>
          {error ? <Aviso tipo="error" estilo={styles.error}>{error}</Aviso> : null}
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
  contenido: { padding: espacio.l, gap: 14 },
  card: { ...estiloTarjeta },
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.s },
  fecha: { ...tipo.apoyo, color: colores.tenue },

  carrera: { marginTop: 14 },
  carreraRotulo: { ...tipo.apoyo, fontFamily: fuente.negrita, color: colores.tenue },
  carreraValor: { fontFamily: fuente.extra, fontSize: 28, lineHeight: 34, color: colores.verde },
  carreraKm: { ...tipo.apoyo, color: colores.tenue },

  bloqueCabecera: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  bloqueIcono: {
    width: 36,
    height: 36,
    borderRadius: radio.chico,
    backgroundColor: colores.acentoSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloqueTitulo: { fontSize: tipo.subtitulo.fontSize },
  valor: { ...tipo.cuerpo, fontFamily: fuente.extra, color: colores.texto },
  secundario: { ...tipo.apoyo, color: colores.tenue, marginTop: 3 },
  referencia: { ...tipo.apoyo, color: colores.tenue, marginTop: espacio.xs },
  botonSecundario: { marginTop: espacio.m, minHeight: 56 },

  contacto: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colores.borde },
  contactoRotulo: { ...tipo.etiqueta, color: colores.tenue },
  contactoNombre: { ...tipo.cuerpo, fontFamily: fuente.extra, color: colores.texto, marginTop: 2 },

  producto: { ...tipo.cuerpo, paddingVertical: 3, color: colores.texto },

  barraInferior: {
    backgroundColor: colores.tarjeta,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
    paddingHorizontal: espacio.l,
    paddingTop: espacio.m,
  },
  botonAccion: { minHeight: 60 },
  error: { marginBottom: 10 },
});
