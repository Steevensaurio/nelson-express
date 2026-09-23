import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import SelectorDireccion from '../components/SelectorDireccion';
import { MOSTRAR_PRECIOS, NOTA_PRECIOS } from '../constants/config';

export default function ConfirmarPedidoScreen({ route, navigation }) {
  const { negocioId, negocioNombre, carrito } = route.params;

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.titulo}>{negocioNombre}</Text>

        <View style={styles.carrito}>
          {carrito.map((item) => (
            <View key={item.producto} style={styles.itemFila}>
              <Text style={styles.itemNombre}>{item.nombre} x{item.cantidad}</Text>
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
          <View style={styles.itemFila}>
            <Text style={styles.itemNombre}>
              Envío{opcionActiva ? ` (${parseFloat(opcionActiva.distancia_km).toFixed(1)} km)` : ''}
            </Text>
            <Text style={styles.itemPrecio}>
              {opcionActiva
                ? `$${parseFloat(opcionActiva.costo_envio).toFixed(2)}`
                : errorEnvio
                  ? 'No disponible'
                  : destinoValor ? 'Calculando…' : 'Elige una dirección'}
            </Text>
          </View>
          {MOSTRAR_PRECIOS ? (
            <View style={styles.totalFila}>
              <Text style={styles.totalTexto}>Total</Text>
              <Text style={styles.totalTexto}>{opcionActiva ? `$${total.toFixed(2)}` : '—'}</Text>
            </View>
          ) : (
            <Text style={styles.notaPrecios}>{NOTA_PRECIOS}</Text>
          )}
        </View>

        <Text style={styles.subtitulo}>Dirección de entrega</Text>

        <SelectorDireccion
          direcciones={direcciones}
          valor={destinoValor}
          onCambiar={setDestinoValor}
          onNuevaDireccion={agregarDireccionGuardada}
        />

        {errorEnvio && errorEnvio !== 'No disponible' ? <Text style={styles.error}>{errorEnvio}</Text> : null}

        {opciones.length > 0 ? (
          <View style={styles.seccionSucursal}>
            <Text style={styles.subtitulo}>Sucursal de recogida</Text>
            {opciones.length === 1 ? (
              <Text style={styles.direccionTexto}>
                {opciones[0].sucursal.nombre} · {opciones[0].sucursal.direccion}
              </Text>
            ) : (
              <>
                <Text style={styles.ayuda}>
                  Elegimos la más cercana a tu dirección. Toca otra si prefieres ese local.
                </Text>
                {opciones.map(o => (
                  <TouchableOpacity
                    key={o.sucursal.id}
                    style={[
                      styles.direccionCard,
                      o.sucursal.id === opcionActiva?.sucursal.id && styles.direccionCardSeleccionada,
                    ]}
                    // Tocar la sugerida vuelve al modo automático (no se envía sucursal).
                    onPress={() => setSucursalElegida(o.sucursal.id === envio.sugerida ? null : o.sucursal.id)}
                  >
                    <View style={styles.sucursalFila}>
                      <Text style={styles.direccionEtiqueta}>{o.sucursal.nombre}</Text>
                      {o.sucursal.id === envio.sugerida ? (
                        <Text style={styles.insigniaCercana}>Más cercana</Text>
                      ) : null}
                    </View>
                    <Text style={styles.direccionTexto}>{o.sucursal.direccion}</Text>
                    <Text style={styles.direccionReferencia}>
                      {parseFloat(o.distancia_km).toFixed(1)} km · envío ${parseFloat(o.costo_envio).toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        ) : null}

        {perfilIncompleto ? (
          <TouchableOpacity style={styles.avisoPerfil} onPress={() => navigation.navigate('MisDatos')}>
            <Text style={styles.avisoPerfilTexto}>
              Para pedir necesitamos tu nombre y teléfono, así el motorizado puede contactarte.
            </Text>
            <Text style={styles.avisoPerfilAccion}>Completar mis datos</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.confirmarBoton, (!opcionActiva || perfilIncompleto) && styles.confirmarBotonDeshabilitado]}
          onPress={confirmar}
          disabled={!opcionActiva || perfilIncompleto}
        >
          <Text style={styles.confirmarTexto}>Confirmar pedido</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    padding: 16,
  },
  titulo: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  notaPrecios: {
    fontSize: 12,
    color: '#666',
    padding: 14,
  },
  seccionSucursal: {
    marginTop: 8,
  },
  ayuda: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  sucursalFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  insigniaCercana: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#007cab',
    backgroundColor: '#e0f5fd',
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  subtitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  carrito: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  itemFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemNombre: {
    fontSize: 15,
  },
  itemPrecio: {
    fontSize: 15,
    color: '#666',
  },
  totalFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
  },
  totalTexto: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  direccionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  direccionCardSeleccionada: {
    borderColor: '#007cab',
  },
  direccionEtiqueta: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  direccionTexto: {
    fontSize: 13,
    color: '#666',
  },
  direccionReferencia: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  avisoPerfil: {
    backgroundColor: '#fff4e0',
    borderColor: '#e08a1e',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  avisoPerfilTexto: {
    fontSize: 13,
    color: '#7a4b00',
  },
  avisoPerfilAccion: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#e08a1e',
    marginTop: 6,
  },
  confirmarBoton: {
    backgroundColor: '#007cab',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmarBotonDeshabilitado: {
    backgroundColor: '#aaa',
  },
  confirmarTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  error: {
    color: 'red',
    marginTop: 10,
    textAlign: 'center',
  },
});
