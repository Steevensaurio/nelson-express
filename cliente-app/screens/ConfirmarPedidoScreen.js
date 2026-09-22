import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import SelectorMapa from '../components/SelectorMapa';
import { MOSTRAR_PRECIOS, NOTA_PRECIOS } from '../constants/config';

export default function ConfirmarPedidoScreen({ route, navigation }) {
  const { negocioId, negocioNombre, carrito } = route.params;

  const [direcciones, setDirecciones] = useState([]);
  const [direccionSeleccionadaId, setDireccionSeleccionadaId] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('');
  const [nuevaDireccion, setNuevaDireccion] = useState('');
  const [direccionBloqueada, setDireccionBloqueada] = useState(false);
  const [nuevaReferencia, setNuevaReferencia] = useState('');
  const [nuevaLat, setNuevaLat] = useState('');
  const [nuevaLng, setNuevaLng] = useState('');
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
    const direccion = direcciones.find(d => d.id === direccionSeleccionadaId);
    setEnvio(null);
    setErrorEnvio('');
    if (!direccion) return undefined;

    let vigente = true;
    api.post('/pedidos/cotizar/', {
      negocio: negocioId,
      destino_lat: direccion.lat,
      destino_lng: direccion.lng,
    })
      .then(response => vigente && setEnvio(response.data))
      .catch(err => vigente && setErrorEnvio(err.response?.data?.detail ?? 'No disponible'));
    return () => { vigente = false; };
  }, [direccionSeleccionadaId, direcciones, negocioId]);

  const perfilIncompleto = perfil !== null && !(perfil.first_name && perfil.telefono);

  const subtotal = carrito.reduce((suma, item) => suma + item.precio * item.cantidad, 0);

  // Sucursal que se usará: la que eligió el cliente (si sigue disponible) o, por defecto, la más cercana.
  const opciones = envio?.opciones ?? [];
  const opcionElegida = opciones.find(o => o.sucursal.id === sucursalElegida);
  const opcionActiva = opcionElegida ?? opciones.find(o => o.sucursal.id === envio?.sugerida);
  const total = subtotal + (opcionActiva ? parseFloat(opcionActiva.costo_envio) : 0);

  const guardarDireccion = async () => {
    const response = await api.post('/direcciones/', {
      etiqueta: nuevaEtiqueta,
      direccion: nuevaDireccion,
      referencia: nuevaReferencia,
      lat: nuevaLat,
      lng: nuevaLng,
    });
    setDirecciones(prev => [...prev, response.data]);
    setDireccionSeleccionadaId(response.data.id);
    setMostrarFormulario(false);
    setNuevaEtiqueta('');
    setNuevaDireccion('');
    setDireccionBloqueada(false);
    setNuevaReferencia('');
    setNuevaLat('');
    setNuevaLng('');
  };

  const seleccionarUbicacion = (lat, lng, direccionSugerida) => {
    setNuevaLat(lat.toString());
    setNuevaLng(lng.toString());
    if (direccionSugerida) {
      setNuevaDireccion(direccionSugerida);
      setDireccionBloqueada(true);
    } else {
      if (direccionBloqueada) setNuevaDireccion('');
      setDireccionBloqueada(false);
    }
    setMostrarMapa(false);
  };

  const confirmar = async () => {
    const direccion = direcciones.find(d => d.id === direccionSeleccionadaId);
    try {
      await api.post('/pedidos/', {
        negocio: negocioId,
        destino_direccion: direccion.direccion,
        destino_referencia: direccion.referencia,
        destino_lat: direccion.lat,
        destino_lng: direccion.lng,
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
                  : direccionSeleccionadaId ? 'Calculando…' : 'Elige una dirección'}
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

        {direcciones.map(item => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.direccionCard,
              item.id === direccionSeleccionadaId && styles.direccionCardSeleccionada,
            ]}
            onPress={() => setDireccionSeleccionadaId(item.id)}
          >
            <Text style={styles.direccionEtiqueta}>{item.etiqueta}</Text>
            <Text style={styles.direccionTexto}>{item.direccion}</Text>
            {item.referencia ? <Text style={styles.direccionReferencia}>{item.referencia}</Text> : null}
          </TouchableOpacity>
        ))}

        {mostrarFormulario ? (
          <View style={styles.formulario}>
            <TextInput style={styles.input} value={nuevaEtiqueta} onChangeText={setNuevaEtiqueta} placeholder="Etiqueta (ej. Casa)" />

            <TouchableOpacity style={styles.mapaBoton} onPress={() => setMostrarMapa(true)}>
              <Text style={styles.mapaBotonTexto}>
                {nuevaLat && nuevaLng ? `📍 Ubicación elegida (${parseFloat(nuevaLat).toFixed(4)}, ${parseFloat(nuevaLng).toFixed(4)})` : '📍 Elegir ubicación en el mapa'}
              </Text>
            </TouchableOpacity>

            <TextInput
              style={[styles.input, direccionBloqueada && styles.inputBloqueado]}
              value={nuevaDireccion}
              onChangeText={setNuevaDireccion}
              editable={!direccionBloqueada}
              placeholder="Dirección (se completa al elegir en el mapa)"
            />
            <TextInput
              style={styles.input}
              value={nuevaReferencia}
              onChangeText={setNuevaReferencia}
              maxLength={255}
              placeholder="Referencia (ej. casa de dos pisos, al lado de la tienda azul)"
            />

            <TouchableOpacity
              style={[styles.guardarBoton, !(nuevaLat && nuevaLng) && styles.confirmarBotonDeshabilitado]}
              disabled={!(nuevaLat && nuevaLng)}
              onPress={guardarDireccion}
            >
              <Text style={styles.guardarTexto}>Guardar dirección</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setMostrarFormulario(true)}>
            <Text style={styles.agregarTexto}>+ Agregar nueva dirección</Text>
          </TouchableOpacity>
        )}

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

        <Modal visible={mostrarMapa} animationType="slide" onRequestClose={() => setMostrarMapa(false)}>
          <SelectorMapa onConfirmar={seleccionarUbicacion} onCancelar={() => setMostrarMapa(false)} />
        </Modal>

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
  inputBloqueado: {
    backgroundColor: '#eee',
    color: '#666',
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
  agregarTexto: {
    color: '#007cab',
    fontWeight: 'bold',
    marginVertical: 10,
  },
  formulario: {
    marginVertical: 10,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  mapaBoton: {
    backgroundColor: '#fff',
    borderColor: '#007cab',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  mapaBotonTexto: {
    color: '#007cab',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  guardarBoton: {
    backgroundColor: '#007cab',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  guardarTexto: {
    color: '#fff',
    fontWeight: 'bold',
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
