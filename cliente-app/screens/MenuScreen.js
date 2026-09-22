import { useState, useEffect } from 'react';
import { Text, FlatList, View, Image, Modal, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { MOSTRAR_PRECIOS } from '../constants/config';

const COLOR_PRIMARIO = '#007cab';

// Foto del producto o, si no tiene, un recuadro con un ícono.
function FotoProducto({ producto, style }) {
  if (producto.imagen) {
    return <Image source={{ uri: producto.imagen }} style={[styles.foto, style]} resizeMode="cover" />;
  }
  return (
    <View style={[styles.foto, styles.fotoVacia, style]}>
      <Ionicons name="fast-food-outline" size={36} color={COLOR_PRIMARIO} />
    </View>
  );
}

export default function MenuScreen({ route, navigation }) {
  const { negocioId, negocioNombre } = route.params;
  const insets = useSafeAreaInsets();
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cantidades, setCantidades] = useState({}); // el carrito: { productoId: cantidad }
  const [seleccionado, setSeleccionado] = useState(null); // producto abierto en la vista previa
  const [cantidadModal, setCantidadModal] = useState(1);

  useEffect(() => {
    api.get(`/negocios/${negocioId}/productos/`)
      .then(response => setProductos(response.data))
      .finally(() => setCargando(false));
  }, []);

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
        ListEmptyComponent={
          <Text style={styles.vacio}>
            {cargando ? 'Cargando menú…' : 'Este restaurante aún no tiene productos.'}
          </Text>
        }
        renderItem={({ item }) => {
          const cantidad = cantidades[item.id] || 0;
          return (
            <TouchableOpacity style={styles.card} onPress={() => abrirProducto(item)} activeOpacity={0.85}>
              <FotoProducto producto={item} />
              {cantidad > 0 ? (
                <View style={styles.insignia}>
                  <Text style={styles.insigniaTexto}>{cantidad}</Text>
                </View>
              ) : null}
              <View style={styles.info}>
                <Text style={styles.nombre} numberOfLines={2}>{item.nombre}</Text>
                {MOSTRAR_PRECIOS ? (
                  <Text style={styles.precio}>${parseFloat(item.precio).toFixed(2)}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {totalItems > 0 && (
        <TouchableOpacity
          style={[styles.confirmarBoton, { marginBottom: 8 + insets.bottom }]}
          onPress={confirmarPedido}
        >
          <Text style={styles.confirmarTexto}>
            Confirmar pedido ({totalItems}){MOSTRAR_PRECIOS ? ` · $${totalPrecio.toFixed(2)}` : ''}
          </Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={seleccionado !== null}
        transparent
        animationType="slide"
        onRequestClose={cerrarProducto}
      >
        <Pressable style={styles.fondoModal} onPress={cerrarProducto}>
          {seleccionado ? (
            // Pressable interno: tocar la hoja no cierra el modal.
            <Pressable style={[styles.hoja, { paddingBottom: 16 + insets.bottom }]} onPress={() => {}}>
              <FotoProducto producto={seleccionado} style={styles.fotoGrande} />
              <TouchableOpacity style={styles.cerrar} onPress={cerrarProducto} accessibilityLabel="Cerrar">
                <Ionicons name="close" size={22} color="#1b1b1b" />
              </TouchableOpacity>

              <View style={styles.hojaCuerpo}>
                <Text style={styles.hojaNombre}>{seleccionado.nombre}</Text>
                {MOSTRAR_PRECIOS ? (
                  <Text style={styles.hojaPrecio}>${parseFloat(seleccionado.precio).toFixed(2)}</Text>
                ) : null}
                {seleccionado.descripcion ? (
                  <Text style={styles.hojaDescripcion}>{seleccionado.descripcion}</Text>
                ) : null}

                <View style={styles.selector}>
                  <TouchableOpacity
                    style={[styles.selectorBoton, cantidadModal <= 1 && styles.selectorDeshabilitado]}
                    disabled={cantidadModal <= 1}
                    onPress={() => setCantidadModal(c => c - 1)}
                  >
                    <Ionicons name="remove" size={22} color="#1b1b1b" />
                  </TouchableOpacity>
                  <Text style={styles.selectorCantidad}>{cantidadModal}</Text>
                  <TouchableOpacity style={styles.selectorBoton} onPress={() => setCantidadModal(c => c + 1)}>
                    <Ionicons name="add" size={22} color="#1b1b1b" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.agregarBoton} onPress={() => guardarEnCarrito(cantidadModal)}>
                  <Text style={styles.agregarTexto}>
                    {enCarrito ? 'Actualizar carrito' : 'Agregar al carrito'}
                    {MOSTRAR_PRECIOS ? ` · $${(parseFloat(seleccionado.precio) * cantidadModal).toFixed(2)}` : ''}
                  </Text>
                </TouchableOpacity>

                {enCarrito ? (
                  <TouchableOpacity onPress={() => guardarEnCarrito(0)}>
                    <Text style={styles.quitarTexto}>Quitar del carrito</Text>
                  </TouchableOpacity>
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
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
  },
  lista: {
    padding: 10,
    paddingBottom: 24,
  },
  columnas: {
    gap: 10,
    marginBottom: 10,
  },
  vacio: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
  },
  card: {
    flex: 1,
    maxWidth: '49%', // un producto suelto en la última fila no se estira a todo el ancho
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  foto: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#e0f5fd',
  },
  fotoVacia: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    padding: 10,
  },
  nombre: {
    fontSize: 14,
    fontWeight: '600',
    minHeight: 36,
    color: '#1b1b1b',
  },
  precio: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 4,
  },
  insignia: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 6,
    backgroundColor: COLOR_PRIMARIO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insigniaTexto: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  confirmarBoton: {
    backgroundColor: COLOR_PRIMARIO,
    padding: 16,
    marginHorizontal: 10,
    marginTop: 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmarTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fondoModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  hoja: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  fotoGrande: {
    aspectRatio: 16 / 10,
  },
  cerrar: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  hojaCuerpo: {
    padding: 16,
  },
  hojaNombre: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1b1b1b',
  },
  hojaPrecio: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 4,
  },
  hojaDescripcion: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginVertical: 18,
  },
  selectorBoton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorDeshabilitado: {
    opacity: 0.4,
  },
  selectorCantidad: {
    fontSize: 22,
    fontWeight: 'bold',
    minWidth: 36,
    textAlign: 'center',
  },
  agregarBoton: {
    backgroundColor: COLOR_PRIMARIO,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  agregarTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quitarTexto: {
    color: '#c0392b',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 14,
  },
});
