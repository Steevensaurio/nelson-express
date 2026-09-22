import { useState, useEffect, useRef } from 'react';
import { Text, View, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import api from '../services/api';

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
      data={negocios}
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
        >
          <Text style={styles.nombre}>{item.nombre}</Text>
          <Text style={styles.direccion}>{resumenSucursales(item.sucursales)}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f2f2f2',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  encargoCard: {
    backgroundColor: '#007cab',
    borderRadius: 12,
    padding: 16,
    margin: 8,
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
    fontSize: 18,
    fontWeight: 'bold',
  },
  direccion: {
    fontSize: 14,
    color: '#666',
  },
});
