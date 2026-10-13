import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import SelectorDireccion from '../components/SelectorDireccion';
import { MOSTRAR_PRECIOS, NOTA_PRECIOS } from '../constants/config';
import { colores, radio } from '../constants/tema';
import { Boton, Icono, Titulo, estiloTarjeta } from '../components/ui';

export default function ConfirmarPedidoScreen({ route, navigation }) {
  const { negocioId, negocioNombre, carrito } = route.params;
  const insets = useSafeAreaInsets();

  const [direcciones, setDirecciones] = useState([]);
  const [destinoValor, setDestinoValor] = useState(null); // { direccion, referencia, lat, lng }
  const [perfil, setPerfil] = useState(null);
  const [envio, setEnvio] = useState(null); // { sugerida, opciones: [{ sucursal, distancia_km, costo_envio }] }
  const [sucursalElegida, setSucursalElegida] = useState(null); // null = la más cercana (automática)
  const [errorEnvio, setErrorEnvio] = useState('');
  const [error, setError] = useState('');

  const cargarDirecciones = () => {
    api.get('/direcciones/').then(response => {
      setDirecciones(response.data);
    });
  };

  const agregarDireccionGuardada = (direccion) => setDirecciones(prev => [...prev, direccion]);

  useEffect(() => {
    cargarDirecciones();
  }, []);

  useFocusEffect(
    useCallback(() => {
      api.get('/perfil/')
        .then(response => setPerfil(response.data))
        .catch(() => {});
    }, [])
  );

  // Cada vez que cambia la dirección elegida se pide el envío al servidor (él es quien calcula el precio).
  useEffect(() => {
    setEnvio(null);
    setErrorEnvio('');
    if (!destinoValor) return undefined;

    let vigente = true;
    api.post('/pedidos/cotizar/', {
      negocio: negocioId,
      destino_lat: destinoValor.lat,
      destino_lng: destinoValor.lng,
    })
      .then(response => vigente && setEnvio(response.data))
      .catch(err => vigente && setErrorEnvio(err.response?.data?.detail ?? 'No disponible'));
    return () => { vigente = false; };
  }, [destinoValor?.lat, destinoValor?.lng, negocioId]);

  const perfilIncompleto = perfil !== null && !(perfil.first_name && perfil.telefono);

  const subtotal = carrito.reduce((suma, item) => suma + item.precio * item.cantidad, 0);

  // Sucursal que se usará: la que eligió el cliente (si sigue disponible) o, por defecto, la más cercana.
  const opciones = envio?.opciones ?? [];
  const opcionElegida = opciones.find(o => o.sucursal.id === sucursalElegida);
  const opcionActiva = opcionElegida ?? opciones.find(o => o.sucursal.id === envio?.sugerida);
  const total = subtotal + (opcionActiva ? parseFloat(opcionActiva.costo_envio) : 0);

  const confirmar = async () => {
    try {
      await api.post('/pedidos/', {
        negocio: negocioId,
        destino_direccion: destinoValor.direccion,
        destino_referencia: destinoValor.referencia,
        destino_lat: destinoValor.lat,
        destino_lng: destinoValor.lng,
        // Solo se envía si el cliente eligió una sucursal; si no, el servidor asigna la más cercana.
        ...(opcionElegida ? { sucursal: opcionElegida.sucursal.id } : {}),
        detalles: carrito.map(item => ({ producto: item.producto, cantidad: item.cantidad })),
      });
      navigation.navigate('Main', { screen: 'Negocios' });
    } catch (err) {
      const datos = err.response?.data;
      setError(datos?.detail ?? datos?.sucursal?.[0] ?? datos?.detalles?.[0] ?? 'No se pudo crear el pedido');
    }
  };

  const textoEnvio = opcionActiva
    ? `$${parseFloat(opcionActiva.costo_envio).toFixed(2)}`
    : errorEnvio
      ? 'No disponible'
      : destinoValor ? 'Calculando…' : 'Elige una dirección';
  const puedeConfirmar = Boolean(opcionActiva && !perfilIncompleto);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.contenido, { paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Titulo estilo={styles.titulo}>{negocioNombre}</Titulo>

        <View style={styles.carrito}>
          {carrito.map((item) => (
            <View key={item.producto} style={styles.itemFila}>
              <View style={styles.cantidad}>
                <Text style={styles.cantidadTexto}>{item.cantidad}</Text>
              </View>
              <Text style={styles.itemNombre}>{item.nombre}</Text>
              {MOSTRAR_PRECIOS ? (
                <Text style={styles.itemPrecio}>${(item.precio * item.cantidad).toFixed(2)}</Text>
              ) : null}
            </View>
          ))}
          {MOSTRAR_PRECIOS ? (
            <View style={styles.itemFila}>
              <Text style={styles.itemNombre}>Subtotal</Text>
              <Text style={styles.itemPrecio}>${subtotal.toFixed(2)}</Text>
            </View>
          ) : null}
          <View
            style={styles.envioFila}
            accessible
            accessibilityLabel={`Envío${opcionActiva ? `, ${parseFloat(opcionActiva.distancia_km).toFixed(1)} kilómetros` : ''}: ${textoEnvio}`}
            accessibilityLiveRegion="polite"
          >
            <View style={styles.envioIzquierda}>
              <Icono nombre="navigate-outline" tamano={20} color={colores.primarioOscuro} />
              <Text style={styles.envioTexto}>
                Envío{opcionActiva ? ` (${parseFloat(opcionActiva.distancia_km).toFixed(1)} km)` : ''}
              </Text>
            </View>
            <Text style={[styles.envioPrecio, !opcionActiva && styles.envioPrecioTenue]}>{textoEnvio}</Text>
          </View>
          {MOSTRAR_PRECIOS ? (
            <View style={styles.totalFila}>
              <Text style={styles.totalTexto}>Total</Text>
              <Text style={styles.totalTexto}>{opcionActiva ? `$${total.toFixed(2)}` : '—'}</Text>
            </View>
          ) : (
            <View style={styles.nota}>
              <Icono nombre="information-circle-outline" tamano={18} color={colores.primarioOscuro} />
              <Text style={styles.notaPrecios}>{NOTA_PRECIOS}</Text>
            </View>
          )}
        </View>

        <Titulo estilo={styles.subtitulo}>Dirección de entrega</Titulo>

        <SelectorDireccion
          direcciones={direcciones}
          valor={destinoValor}
          onCambiar={setDestinoValor}
          onNuevaDireccion={agregarDireccionGuardada}
        />

        {errorEnvio && errorEnvio !== 'No disponible' ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{errorEnvio}</Text>
        ) : null}

        {opciones.length > 0 ? (
          <View style={styles.seccionSucursal}>
            <Titulo estilo={styles.subtitulo}>Sucursal de recogida</Titulo>
            {opciones.length === 1 ? (
              <View style={styles.unica}>
                <Icono nombre="storefront-outline" tamano={22} color={colores.primarioOscuro} />
                <Text style={styles.unicaTexto}>
                  {opciones[0].sucursal.nombre} · {opciones[0].sucursal.direccion}
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.ayuda}>
                  Elegimos la más cercana a tu dirección. Toca otra si prefieres ese local.
                </Text>
                <View accessibilityRole="radiogroup" style={styles.sucursales}>
                  {opciones.map(o => {
                    const seleccionada = o.sucursal.id === opcionActiva?.sucursal.id;
                    const cercana = o.sucursal.id === envio.sugerida;
                    return (
                      <Pressable
                        key={o.sucursal.id}
                        accessibilityRole="radio"
                        aria-checked={seleccionada}
                        accessibilityLabel={`${o.sucursal.nombre}${cercana ? ', la más cercana' : ''}. ${o.sucursal.direccion}. ${parseFloat(o.distancia_km).toFixed(1)} kilómetros, envío ${parseFloat(o.costo_envio).toFixed(2)} dólares`}
                        style={({ pressed }) => [styles.sucursal, seleccionada && styles.sucursalSeleccionada, pressed && styles.presionada]}
                        // Tocar la sugerida vuelve al modo automático (no se envía sucursal).
                        onPress={() => setSucursalElegida(cercana ? null : o.sucursal.id)}
                      >
                        <Icono
                          nombre={seleccionada ? 'radio-button-on' : 'radio-button-off'}
                          tamano={24}
                          color={seleccionada ? colores.primario : colores.bordeCampo}
                        />
                        <View style={styles.sucursalCuerpo}>
                          <View style={styles.sucursalFila}>
                            <Text style={styles.sucursalNombre}>{o.sucursal.nombre}</Text>
                            {cercana ? (
                              <View style={styles.cercana}>
                                <Icono nombre="flash" tamano={12} color={colores.primarioOscuro} />
                                <Text style={styles.cercanaTexto}>Más cercana</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.sucursalDireccion}>{o.sucursal.direccion}</Text>
                          <Text style={styles.sucursalDetalle}>
                            {parseFloat(o.distancia_km).toFixed(1)} km · envío ${parseFloat(o.costo_envio).toFixed(2)}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        ) : null}

        {perfilIncompleto ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Para pedir necesitamos tu nombre y teléfono. Completar mis datos"
            style={styles.avisoPerfil}
            onPress={() => navigation.navigate('MisDatos')}
          >
            <Icono nombre="alert-circle" tamano={22} color={colores.naranja} />
            <View style={styles.avisoCuerpo}>
              <Text style={styles.avisoPerfilTexto}>
                Para pedir necesitamos tu nombre y teléfono, así el motorizado puede contactarte.
              </Text>
              <Text style={styles.avisoPerfilAccion}>Completar mis datos</Text>
            </View>
          </Pressable>
        ) : null}

        <Boton
          titulo="Confirmar pedido"
          icono="bag-check-outline"
          onPress={confirmar}
          deshabilitado={!puedeConfirmar}
          estilo={styles.confirmar}
        />

        {error ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 16 },
  titulo: { fontSize: 22, marginBottom: 14 },
  subtitulo: { fontSize: 18, marginTop: 20, marginBottom: 10 },
  carrito: { ...estiloTarjeta, padding: 6 },
  itemFila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  cantidad: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colores.acentoSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cantidadTexto: { fontSize: 14, fontWeight: '800', color: colores.primarioOscuro },
  itemNombre: { flex: 1, fontSize: 16, color: colores.texto },
  itemPrecio: { fontSize: 15, color: colores.tenue },
  envioFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colores.acentoSuave,
    borderRadius: radio.medio,
    padding: 14,
    margin: 6,
  },
  envioIzquierda: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  envioTexto: { fontSize: 16, fontWeight: '700', color: colores.texto },
  envioPrecio: { fontSize: 20, fontWeight: '800', color: colores.primarioOscuro },
  envioPrecioTenue: { fontSize: 14, fontWeight: '600', color: colores.tenue, textAlign: 'right', flexShrink: 1 },
  totalFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  totalTexto: { fontSize: 17, fontWeight: '800' },
  nota: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  notaPrecios: { flex: 1, fontSize: 13, color: colores.tenue, lineHeight: 18 },

  seccionSucursal: { marginTop: 4 },
  ayuda: { fontSize: 14, color: colores.tenue, marginBottom: 10 },
  unica: { ...estiloTarjeta, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  unicaTexto: { flex: 1, fontSize: 15, color: colores.texto },
  sucursales: { gap: 10 },
  sucursal: {
    ...estiloTarjeta,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sucursalSeleccionada: { borderColor: colores.primario, backgroundColor: '#f4fbfe' },
  presionada: { opacity: 0.9 },
  sucursalCuerpo: { flex: 1 },
  sucursalFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sucursalNombre: { fontSize: 16, fontWeight: '800', color: colores.texto },
  cercana: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colores.acentoSuave,
    borderRadius: radio.pastilla,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  cercanaTexto: { fontSize: 12, fontWeight: '800', color: colores.primarioOscuro },
  sucursalDireccion: { fontSize: 14, color: colores.tenue, marginTop: 2 },
  sucursalDetalle: { fontSize: 13, fontWeight: '600', color: colores.texto, marginTop: 4 },

  avisoPerfil: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: '#fff4e0',
    borderLeftWidth: 5,
    borderLeftColor: colores.naranja,
    borderRadius: radio.medio,
    padding: 14,
    marginTop: 16,
  },
  avisoCuerpo: { flex: 1 },
  avisoPerfilTexto: { fontSize: 14, color: '#5c3300' },
  avisoPerfilAccion: { fontSize: 14, fontWeight: '800', color: colores.naranja, marginTop: 6 },
  confirmar: { marginTop: 20 },
  error: { color: colores.peligro, fontWeight: '600', fontSize: 14, marginTop: 12, textAlign: 'center' },
});
