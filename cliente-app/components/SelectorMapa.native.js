import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

const formatearDireccion = (r) => {
  if (!r) return '';
  if (r.formattedAddress) return r.formattedAddress;
  const calle = [r.street, r.streetNumber].filter(Boolean).join(' ');
  const partes = [calle || r.name, r.district, r.city].filter(Boolean);
  return [...new Set(partes)].join(', ');
};

export default function SelectorMapa({ onConfirmar, onCancelar, coordenadaInicial }) {
  const [coordenada, setCoordenada] = useState(coordenadaInicial ?? null);
  const [cargando, setCargando] = useState(!coordenadaInicial);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (coordenadaInicial) return;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const posicion = await Location.getCurrentPositionAsync({});
        setCoordenada({
          latitude: posicion.coords.latitude,
          longitude: posicion.coords.longitude,
        });
      }
      setCargando(false);
    })();
  }, []);

  const confirmar = async () => {
    setConfirmando(true);
    const latitude = parseFloat(coordenada.latitude.toFixed(6));
    const longitude = parseFloat(coordenada.longitude.toFixed(6));

    let direccionSugerida = '';
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const resultados = await Location.reverseGeocodeAsync({ latitude, longitude });
        direccionSugerida = formatearDireccion(resultados[0]);
      }
    } catch (err) {
      // sin sugerencia: el usuario puede escribir la dirección a mano
    }

    setConfirmando(false);
    onConfirmar(latitude, longitude, direccionSugerida);
  };

  if (cargando) {
    return (
      <View style={styles.cargandoContainer}>
        <ActivityIndicator size="large" color="#007cab" />
        <Text style={styles.cargandoTexto}>Obteniendo tu ubicación...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.mapa}
        initialRegion={{
          latitude: coordenada?.latitude ?? -0.1806,
          longitude: coordenada?.longitude ?? -78.4678,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onPress={(e) => setCoordenada(e.nativeEvent.coordinate)}
      >
        {coordenada && <Marker coordinate={coordenada} />}
      </MapView>

      <View style={styles.ayuda}>
        <Text style={styles.ayudaTexto}>
          {coordenada
            ? 'Toca otro punto para ajustar, o "Confirmar" para usar este'
            : 'No se pudo obtener tu ubicación — toca el mapa para marcarla a mano'}
        </Text>
      </View>

      <TouchableOpacity style={styles.cancelarBoton} onPress={onCancelar}>
        <Text style={styles.cancelarTexto}>Cancelar</Text>
      </TouchableOpacity>

      {coordenada && (
        <TouchableOpacity
          style={[styles.confirmarBoton, confirmando && styles.confirmarBotonOcupado]}
          onPress={confirmar}
          disabled={confirmando}
        >
          <Text style={styles.confirmarTexto}>
            {confirmando ? 'Obteniendo dirección...' : 'Confirmar ubicación'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cargandoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cargandoTexto: {
    marginTop: 10,
    color: '#666',
  },
  mapa: {
    flex: 1,
  },
  ayuda: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 10,
    elevation: 3,
  },
  ayudaTexto: {
    textAlign: 'center',
    fontSize: 13,
  },
  cancelarBoton: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    elevation: 3,
  },
  cancelarTexto: {
    color: '#c0392b',
    fontWeight: 'bold',
  },
  confirmarBoton: {
    backgroundColor: '#007cab',
    padding: 16,
    alignItems: 'center',
  },
  confirmarBotonOcupado: {
    backgroundColor: '#aaa',
  },
  confirmarTexto: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
