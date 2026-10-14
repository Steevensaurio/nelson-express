import { useState } from 'react';
import { FlatList, View, Image, Modal, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pedir } from '../services/consultas';
import { useCargaRapida } from '../hooks/useCargaRapida';
import { MOSTRAR_PRECIOS } from '../constants/config';
import { colores, fuente, radio } from '../constants/tema';
import { Aviso, AvisosCarga, Boton, Esqueleto, Icono, Text, estiloTarjeta } from '../components/ui';

// Foto del producto o, si no tiene, un recuadro con un ícono. Es decorativa: el nombre ya va en el texto.
function FotoProducto({ producto, style }) {
  if (producto.imagen) {
    return <Image source={{ uri: producto.imagen }} style={[styles.foto, style]} resizeMode="cover" accessible={false} />;
  }
  return (
    <View style={[styles.foto, styles.fotoVacia, style]}>
      <Icono nombre="fast-food-outline" tamano={40} color={colores.primarioOscuro} />
    </View>
  );
}

// Tarjetas de producto mientras llegan los datos: mismas medidas que las reales, en filas de dos.
function TarjetaEsqueleto() {
  return (
    <View style={styles.card}>
      <Esqueleto alto="auto" radio={0} estilo={styles.esqueletoFoto} />
      <View style={styles.info}>
        <View style={styles.esqueletoNombre}>
          <Esqueleto ancho="85%" alto={16} />
          <Esqueleto ancho="55%" alto={16} estilo={styles.esqueletoLinea2} />
        </View>
        {MOSTRAR_PRECIOS ? <Esqueleto ancho="35%" alto={22} estilo={styles.esqueletoPrecio} /> : null}
      </View>
    </View>
  );
}

const SIN_PRODUCTOS = [];

export default function MenuScreen({ route, navigation }) {
  const { negocioId, negocioNombre } = route.params;
  const insets = useSafeAreaInsets();
  const { datos, cargando, error, lento, recargar } = useCargaRapida(
    `productos:${negocioId}`,
    pedir(`/negocios/${negocioId}/productos/`),
    { maxEdad: 60000 },
  );
  const productos = datos ?? SIN_PRODUCTOS;
  const [cantidades, setCantidades] = useState({}); // el carrito: { productoId: cantidad }
  const [seleccionado, setSeleccionado] = useState(null); // producto abierto en la vista previa
  const [cantidadModal, setCantidadModal] = useState(1);

  const abrirProducto = (producto) => {
    setSeleccionado(producto);
    setCantidadModal(Math.max(1, cantidades[producto.id] || 0));
  };

  const cerrarProducto = () => setSeleccionado(null);

  const guardarEnCarrito = (cantidad) => {
    setCantidades(prev => ({ ...prev, [seleccionado.id]: cantidad }));
    cerrarProducto();
  };

  const totalItems = Object.values(cantidades).reduce((sum, c) => sum + c, 0);
  const totalPrecio = productos.reduce((sum, p) => sum + parseFloat(p.precio) * (cantidades[p.id] || 0), 0);

  const confirmarPedido = () => {
    const carrito = productos
      .filter(p => (cantidades[p.id] || 0) > 0)
      .map(p => ({ producto: p.id, nombre: p.nombre, precio: p.precio, cantidad: cantidades[p.id] }));

    navigation.navigate('ConfirmarPedido', {
      negocioId,
      negocioNombre,
      carrito,
    });
  };

  const enCarrito = seleccionado ? (cantidades[seleccionado.id] || 0) > 0 : false;

  return (
    <View style={styles.container}>
      <FlatList
        data={productos}
        numColumns={2}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.lista}
        columnWrapperStyle={styles.columnas}
        ListHeaderComponent={<AvisosCarga lento={lento} error={error} hayDatos={datos !== undefined} estilo={styles.avisoCarga} />}
        ListEmptyComponent={
          cargando ? (
            <View accessibilityRole="progressbar" accessibilityLabel="Cargando" aria-busy>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.columnas, styles.filaEsqueleto]}>
                  <TarjetaEsqueleto />
                  <TarjetaEsqueleto />
                </View>
              ))}
            </View>
          ) : error && datos === undefined ? (
            <View style={styles.errorCarga}>
              <Aviso tipo="error">No pudimos cargar el menú. Revisa tu conexión.</Aviso>
              <Boton titulo="Reintentar" variante="secundario" icono="refresh" onPress={() => recargar({ forzar: true, manual: true })} />
            </View>
          ) : (
            <Text style={styles.vacio}>Este restaurante aún no tiene productos.</Text>
          )
        }
        renderItem={({ item }) => {
          const cantidad = cantidades[item.id] || 0;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.nombre}${cantidad > 0 ? `, ${cantidad} en el carrito` : ''}. Toca para ver detalles y agregar`}
              onPress={() => abrirProducto(item)}
              android_ripple={{ color: 'rgba(0,124,171,0.15)' }}
              style={({ pressed }) => [styles.card, pressed && styles.cardPresionada]}
            >
              <FotoProducto producto={item} />
              <View style={[styles.insignia, cantidad === 0 && styles.insigniaMas]}>
                {cantidad > 0 ? (
                  <Text style={styles.insigniaTexto}>{cantidad}</Text>
                ) : (
                  <Icono nombre="add" tamano={20} color={colores.primarioOscuro} />
                )}
              </View>
              <View style={styles.info}>
                <Text style={styles.nombre} numberOfLines={2}>{item.nombre}</Text>
                {MOSTRAR_PRECIOS ? (
                  <Text style={styles.precio}>${parseFloat(item.precio).toFixed(2)}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />

      {totalItems > 0 && (
        <View style={[styles.barraConfirmar, { paddingBottom: 12 + insets.bottom }]}>
          <Boton
            titulo={`Confirmar pedido (${totalItems})${MOSTRAR_PRECIOS ? ` · $${totalPrecio.toFixed(2)}` : ''}`}
            icono="bag-check-outline"
            onPress={confirmarPedido}
          />
        </View>
      )}

      <Modal
        visible={seleccionado !== null}
        transparent
        animationType="slide"
        onRequestClose={cerrarProducto}
        aria-label={seleccionado?.nombre ?? 'Producto'} // react-native-web le pone role="dialog" y axe exige un nombre
      >
        <Pressable style={styles.fondoModal} onPress={cerrarProducto} accessible={false}>
          {seleccionado ? (
            // Pressable interno: tocar la hoja no cierra el modal.
            <Pressable
              style={[styles.hoja, { paddingBottom: 16 + insets.bottom }]}
              onPress={() => {}}
              accessible={false}
            >
              <FotoProducto producto={seleccionado} style={styles.fotoGrande} />
              <Pressable
                style={styles.cerrar}
                onPress={cerrarProducto}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Icono nombre="close" tamano={22} color={colores.texto} />
              </Pressable>

              <View style={styles.hojaCuerpo}>
                <Text accessibilityRole="header" style={styles.hojaNombre}>{seleccionado.nombre}</Text>
                {MOSTRAR_PRECIOS ? (
                  <Text style={styles.hojaPrecio}>${parseFloat(seleccionado.precio).toFixed(2)}</Text>
                ) : null}
                {seleccionado.descripcion ? (
                  <Text style={styles.hojaDescripcion}>{seleccionado.descripcion}</Text>
                ) : null}

                <View style={styles.selector}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.selectorBoton,
                      cantidadModal <= 1 && styles.selectorDeshabilitado,
                      pressed && styles.selectorPresionado,
                    ]}
                    disabled={cantidadModal <= 1}
                    onPress={() => setCantidadModal(c => c - 1)}
                    accessibilityRole="button"
                    accessibilityLabel="Disminuir cantidad"
                    aria-disabled={cantidadModal <= 1}
                  >
                    <Icono nombre="remove" tamano={24} color={colores.texto} />
                  </Pressable>
                  <Text
                    style={styles.selectorCantidad}
                    accessibilityLabel={`Cantidad: ${cantidadModal}`}
                    accessibilityLiveRegion="polite"
                  >
                    {cantidadModal}
                  </Text>
                  <Pressable
                    style={({ pressed }) => [styles.selectorBoton, pressed && styles.selectorPresionado]}
                    onPress={() => setCantidadModal(c => c + 1)}
                    accessibilityRole="button"
                    accessibilityLabel="Aumentar cantidad"
                  >
                    <Icono nombre="add" tamano={24} color={colores.texto} />
                  </Pressable>
                </View>

                <Boton
                  titulo={`${enCarrito ? 'Actualizar carrito' : 'Agregar al carrito'}${MOSTRAR_PRECIOS ? ` · $${(parseFloat(seleccionado.precio) * cantidadModal).toFixed(2)}` : ''}`}
                  icono="cart-outline"
                  onPress={() => guardarEnCarrito(cantidadModal)}
                />

                {enCarrito ? (
                  <Boton
                    titulo="Quitar del carrito"
                    variante="peligroSuave"
                    icono="trash-outline"
                    onPress={() => guardarEnCarrito(0)}
                    estilo={styles.quitar}
                  />
                ) : null}
              </View>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colores.fondo },
  lista: { padding: 12, paddingBottom: 24 },
  columnas: { gap: 12, marginBottom: 12 },
  avisoCarga: { marginBottom: 12 },
  errorCarga: { gap: 12 },
  filaEsqueleto: { flexDirection: 'row' }, // FlatList lo hace sola con numColumns; aquí hay que pedirlo
  esqueletoFoto: { aspectRatio: 4 / 3 },
  esqueletoNombre: { minHeight: 42 },
  esqueletoLinea2: { marginTop: 5 },
  esqueletoPrecio: { marginTop: 8 },
  vacio: { textAlign: 'center', color: colores.tenue, marginTop: 40, fontSize: 15 },
  card: {
    ...estiloTarjeta,
    flex: 1,
    maxWidth: '48.5%', // un producto suelto en la última fila no se estira a todo el ancho
    padding: 0,
    overflow: 'hidden',
  },
  cardPresionada: { opacity: 0.9 },
  foto: { width: '100%', aspectRatio: 4 / 3, backgroundColor: colores.acentoSuave },
  fotoVacia: { alignItems: 'center', justifyContent: 'center' },
  info: { padding: 12 },
  nombre: { fontFamily: fuente.extra, fontSize: 16, lineHeight: 21, minHeight: 42, color: colores.texto },
  precio: { fontFamily: fuente.extra, fontSize: 20, color: colores.texto, marginTop: 2 },
  insignia: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 7,
    backgroundColor: colores.primario,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  insigniaMas: { backgroundColor: '#fff' },
  insigniaTexto: { color: '#fff', fontFamily: fuente.extra, fontSize: 14 },
  barraConfirmar: {
    backgroundColor: colores.tarjeta,
    paddingHorizontal: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
  },
  fondoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  hoja: {
    backgroundColor: colores.tarjeta,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  fotoGrande: { aspectRatio: 16 / 10 },
  cerrar: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  hojaCuerpo: { padding: 18 },
  hojaNombre: { fontFamily: fuente.extra, fontSize: 22, lineHeight: 28, color: colores.texto },
  hojaPrecio: { fontFamily: fuente.extra, fontSize: 24, color: colores.texto, marginTop: 4 },
  hojaDescripcion: { fontSize: 15, color: colores.tenue, marginTop: 8, lineHeight: 21 },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginVertical: 18,
  },
  selectorBoton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#e8edf0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorPresionado: { backgroundColor: colores.acentoSuave },
  selectorDeshabilitado: { opacity: 0.45 },
  selectorCantidad: { fontFamily: fuente.extra, fontSize: 28, minWidth: 44, textAlign: 'center', color: colores.texto },
  quitar: { marginTop: 10 },
});
