import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { colores, radio, tipo, espacio } from '../constants/tema';
import { Boton, Campo, Icono, Text } from './ui';

export default function SelectorMapa({ onConfirmar, onCancelar, coordenadaInicial }) {
  const [lat, setLat] = useState(coordenadaInicial ? coordenadaInicial.latitude.toString() : '');
  const [lng, setLng] = useState(coordenadaInicial ? coordenadaInicial.longitude.toString() : '');

  const confirmar = () => {
    onConfirmar(parseFloat(parseFloat(lat).toFixed(6)), parseFloat(parseFloat(lng).toFixed(6)));
  };

  return (
    <View style={styles.container}>
      <View style={styles.aviso}>
        <Icono nombre="information-circle-outline" tamano={20} color={colores.primarioOscuro} />
        <Text style={styles.avisoTexto}>
          El mapa interactivo solo funciona en la app móvil. Esta es una versión de respaldo para seguir probando en el navegador durante el desarrollo.
        </Text>
      </View>
      <Campo etiqueta="Latitud" value={lat} onChangeText={setLat} placeholder="Ej. -0.2530" keyboardType="numeric" />
      <Campo etiqueta="Longitud" value={lng} onChangeText={setLng} placeholder="Ej. -79.1730" keyboardType="numeric" />
      <Boton titulo="Confirmar ubicación" icono="checkmark" onPress={confirmar} deshabilitado={!(lat && lng)} />
      <Boton titulo="Cancelar" variante="fantasma" onPress={onCancelar} estilo={styles.cancelar} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colores.fondo, padding: espacio.l },
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colores.acentoSuave,
    borderRadius: radio.medio,
    padding: 14,
    marginBottom: espacio.l,
  },
  avisoTexto: { flex: 1, fontSize: tipo.cuerpo.fontSize, color: colores.texto, lineHeight: 20 },
  cancelar: { marginTop: 10 },
});
