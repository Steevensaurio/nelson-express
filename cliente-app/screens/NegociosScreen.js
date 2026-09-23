import { useState, useEffect, useRef } from 'react';
import { Text, View, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useScrollToTop } from '@react-navigation/native';
import api from '../services/api';

const COLOR_PRIMARIO = '#007cab';

// Una sola sucursal: su dirección. Varias: cuántas hay. Ninguna abierta: aviso.
const resumenSucursales = (sucursales) => {
  const abiertas = sucursales.filter((s) => s.abierta);
  if (abiertas.length === 0) return 'Cerrado por ahora';
  if (sucursales.length === 1) return sucursales[0].direccion;
  return `${abiertas.length} ${abiertas.length === 1 ? 'sucursal abierta' : 'sucursales abiertas'}`;
};

export default function NegociosScreen({ navigation }) {
  const [negocios, setNegocios] = useState([]);
  const lista = useRef(null);
  useScrollToTop(lista); // tocar de nuevo la pestaña activa vuelve al inicio de la lista

  useEffect(() => {
    api.get('/negocios/').then(response => {
      setNegocios(response.data);
    });
  }, []);

  return (
    <FlatList
      ref={lista}
      style={styles.container}
      contentContainerStyle={styles.lista}
      columnWrapperStyle={styles.columnas}
      data={negocios}
      numColumns={2}
      ListHeaderComponent={
        <TouchableOpacity style={styles.encargoCard} onPress={() => navigation.navigate('NuevoEncargo')}>
          <Text style={styles.encargoTitulo}>📦 Pedir un encargo</Text>
          <Text style={styles.encargoTexto}>
            Recogemos lo que necesites en cualquier lugar y te lo llevamos.
          </Text>
        </TouchableOpacity>
      }
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Menu', { negocioId: item.id, negocioNombre: item.nombre })}
          activeOpacity={0.85}
        >
          <View style={styles.icono}>
            <Ionicons name="storefront-outline" size={36} color={COLOR_PRIMARIO} />
          </View>
          <View style={styles.info}>
            <Text style={styles.nombre} numberOfLines={2}>{item.nombre}</Text>
            <Text style={styles.direccion} numberOfLines={2}>{resumenSucursales(item.sucursales)}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
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
  card: {
    flex: 1,
    maxWidth: '49%', // un negocio suelto en la última fila no se estira a todo el ancho
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  icono: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#e0f5fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    padding: 10,
  },
  encargoCard: {
    backgroundColor: '#007cab',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  encargoTitulo: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  encargoTexto: {
    color: '#e0f5fd',
    fontSize: 13,
    marginTop: 4,
  },
  nombre: {
    fontSize: 15,
    fontWeight: '600',
    minHeight: 38,
    color: '#1b1b1b',
  },
  direccion: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});
