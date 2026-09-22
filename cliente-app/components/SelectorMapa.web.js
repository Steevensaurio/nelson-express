import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

export default function SelectorMapa({ onConfirmar, onCancelar, coordenadaInicial }) {
  const [lat, setLat] = useState(coordenadaInicial ? coordenadaInicial.latitude.toString() : '');
  const [lng, setLng] = useState(coordenadaInicial ? coordenadaInicial.longitude.toString() : '');

  const confirmar = () => {
    onConfirmar(parseFloat(parseFloat(lat).toFixed(6)), parseFloat(parseFloat(lng).toFixed(6)));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.aviso}>
        El mapa interactivo solo funciona en la app móvil (Expo Go). Esta es una versión de respaldo para seguir probando en el navegador durante el desarrollo.
      </Text>
      <TextInput style={styles.input} value={lat} onChangeText={setLat} placeholder="Latitud" keyboardType="numeric" />
      <TextInput style={styles.input} value={lng} onChangeText={setLng} placeholder="Longitud" keyboardType="numeric" />
      <TouchableOpacity style={styles.confirmarBoton} onPress={confirmar}>
        <Text style={styles.confirmarTexto}>Confirmar ubicación</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onCancelar}>
        <Text style={styles.cancelarTexto}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    padding: 16,
  },
  aviso: {
    color: '#666',
    marginBottom: 16,
    fontSize: 13,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  confirmarBoton: {
    backgroundColor: '#007cab',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmarTexto: {
    color: '#fff',
    fontWeight: 'bold',
  },
  cancelarTexto: {
    textAlign: 'center',
    color: '#999',
    marginTop: 14,
  },
});
