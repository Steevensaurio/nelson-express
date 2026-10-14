import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { invalidar } from '../services/cache';
import { pedir } from '../services/consultas';
import { useCargaRapida } from '../hooks/useCargaRapida';
import { MAX_EDAD_MS } from '../services/cargaRapida';
import SelectorDireccion from '../components/SelectorDireccion';
import { MOSTRAR_PRECIOS, NOTA_PRECIOS } from '../constants/config';
import { colores, fuente, radio, tipo, espacio } from '../constants/tema';
import { Aviso, Boton, Icono, Presionable, Text, Titulo, estiloTarjeta } from '../components/ui';

const SIN_DIRECCIONES = [];
const pedirDirecciones = pedir('/direcciones/');
const pedirPerfil = pedir('/perfil/');

export default function ConfirmarPedidoScreen({ route, navigation }) {
  const { negocioId, negocioNombre, carrito } = route.params;
  const insets = useSafeAreaInsets();

  // Direcciones y perfil salen de la caché compartida (misma clave que Perfil y Mis direcciones) y se refrescan por detrás.
  const { datos: direccionesGuardadas, actualizar: actualizarDirecciones } = useCargaRapida('direcciones', pedirDirecciones, { maxEdad: MAX_EDAD_MS });
  const direcciones = direccionesGuardadas ?? SIN_DIRECCIONES;
  const [destinoValor, setDestinoValor] = useState(null); // { direccion, referencia, lat, lng }
  const { datos: perfilGuardado } = useCargaRapida('perfil', pedirPerfil, { maxEdad: MAX_EDAD_MS });
  const perfil = perfilGuardado ?? null;
  const [envio, setEnvio] = useState(null); // { sugerida, opciones: [{ sucursal, distancia_km, costo_envio }] }
  const [sucursalElegida, setSucursalElegida] = useState(null); // null = la más cercana (automática)
  const [errorEnvio, setErrorEnvio] = useState('');
  const [error, setError] = useState('');

  const agregarDireccionGuardada = (direccion) => actualizarDirecciones(prev => [...(prev ?? []), direccion]);

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
      invalidar('pedidos'); // la lista guardada ya no tiene este pedido: Mis pedidos la vuelve a pedir
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
        contentContainerStyle={[styles.contenido, { paddingBottom: espacio.xl + insets.bottom }]}
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
          <Aviso tipo="error" estilo={styles.error}>{errorEnvio}</Aviso>
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
                      <Presionable
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
                      </Presionable>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        ) : null}

        {perfilIncompleto ? (
          <Presionable
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
          </Presionable>
        ) : null}

        <Boton
          titulo="Confirmar pedido"
          icono="bag-check-outline"
          onPress={confirmar}
          deshabilitado={!puedeConfirmar}
          estilo={styles.confirmar}
        />

        {error ? (
          <Aviso tipo="error" estilo={styles.error}>{error}</Aviso>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.l },
  titulo: { fontSize: tipo.titulo.fontSize, marginBottom: 14 },
  subtitulo: { fontSize: tipo.seccion.fontSize, marginTop: 20, marginBottom: 10 },
  carrito: { ...estiloTarjeta, padding: 6 },
  itemFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingHorizontal: espacio.m, paddingVertical: 10 },
  cantidad: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colores.acentoSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cantidadTexto: { ...tipo.apoyo, fontFamily: fuente.extra, color: colores.primarioOscuro },
  itemNombre: { ...tipo.cuerpo, flex: 1, color: colores.texto },
  itemPrecio: { ...tipo.cuerpo, fontFamily: fuente.extra, color: colores.texto },
  envioFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colores.acentoSuave,
    borderRadius: radio.medio,
    padding: 14,
    margin: 6,
  },
  envioIzquierda: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexShrink: 1 },
  envioTexto: { ...tipo.cuerpoFuerte, color: colores.texto },
  envioPrecio: { ...tipo.precio, color: colores.primarioOscuro },
  envioPrecioTenue: { ...tipo.apoyo, color: colores.tenue, textAlign: 'right', flexShrink: 1 },
  totalFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  totalTexto: { ...tipo.titulo, color: colores.texto },
  nota: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.s, paddingHorizontal: 14, paddingVertical: espacio.m },
  notaPrecios: { ...tipo.apoyo, flex: 1, color: colores.tenue, lineHeight: 18 },

  seccionSucursal: { marginTop: espacio.xs },
  ayuda: { ...tipo.apoyo, color: colores.tenue, marginBottom: 10 },
  unica: { ...estiloTarjeta, flexDirection: 'row', alignItems: 'center', gap: espacio.m, padding: 14 },
  unicaTexto: { ...tipo.cuerpo, flex: 1, color: colores.texto },
  sucursales: { gap: 10 },
  sucursal: {
    ...estiloTarjeta,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    padding: 14,
    borderWidth: 2,
    borderColor: colores.borde,
  },
  sucursalSeleccionada: { borderColor: colores.primario, backgroundColor: colores.acentoPalido },
  presionada: { opacity: 0.9 },
  sucursalCuerpo: { flex: 1 },
  sucursalFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.s },
  sucursalNombre: { ...tipo.cuerpo, fontFamily: fuente.extra, flexShrink: 1, color: colores.texto },
  cercana: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colores.acentoSuave,
    borderRadius: radio.pastilla,
    paddingVertical: 3,
    paddingHorizontal: espacio.s,
  },
  cercanaTexto: { ...tipo.etiqueta, fontFamily: fuente.extra, color: colores.primarioOscuro },
  sucursalDireccion: { ...tipo.apoyo, color: colores.tenue, marginTop: 2 },
  sucursalDetalle: { ...tipo.apoyo, color: colores.texto, marginTop: espacio.xs },

  avisoPerfil: {
    flexDirection: 'row',
    gap: espacio.m,
    alignItems: 'center',
    backgroundColor: colores.alertaFondo,
    borderWidth: 1,
    borderColor: colores.alertaBorde,
    borderRadius: radio.medio,
    padding: 14,
    marginTop: espacio.l,
  },
  avisoCuerpo: { flex: 1 },
  avisoPerfilTexto: { ...tipo.cuerpo, color: colores.alertaTexto },
  avisoPerfilAccion: { ...tipo.cuerpo, fontFamily: fuente.extra, color: colores.naranja, marginTop: 6 },
  confirmar: { marginTop: 20 },
  error: { marginTop: espacio.m },
});
