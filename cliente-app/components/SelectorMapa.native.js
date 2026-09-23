import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';

// Mismo mapa gratuito (Leaflet + OpenStreetMap, sin API key) que ya usa el panel del despachador,
// cargado en un WebView: react-native-maps solo funciona con Google Maps en Android y necesita una
// clave de pago para el APK compilado (en Expo Go "funciona" porque usa la clave de desarrollo de Expo).
const CENTRO_SANTO_DOMINGO = { lat: -0.253, lng: -79.173 };

const paginaMapa = ({ lat, lng, zoom, conMarcador }) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #mapa { height: 100%; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="mapa"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const mapa = L.map('mapa').setView([${lat}, ${lng}], ${zoom});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(mapa);

    let marcador = ${conMarcador ? `L.marker([${lat}, ${lng}], { draggable: true }).addTo(mapa)` : 'null'};
    if (marcador) marcador.on('dragend', () => avisar(marcador.getLatLng()));

    function avisar(posicion) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: posicion.lat, lng: posicion.lng }));
    }

    mapa.on('click', (e) => {
      if (marcador) {
        marcador.setLatLng(e.latlng);
      } else {
        marcador = L.marker(e.latlng, { draggable: true }).addTo(mapa);
        marcador.on('dragend', () => avisar(marcador.getLatLng()));
      }
      avisar(e.latlng);
    });
  </script>
</body>
</html>
`;

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
  const webviewRef = useRef(null);

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

  const recibirMensaje = (e) => {
    try {
      const { lat, lng } = JSON.parse(e.nativeEvent.data);
      setCoordenada({ latitude: lat, longitude: lng });
    } catch (err) {
      // mensaje inesperado del WebView: se ignora
    }
  };

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

  const html = paginaMapa({
    lat: coordenada?.latitude ?? CENTRO_SANTO_DOMINGO.lat,
    lng: coordenada?.longitude ?? CENTRO_SANTO_DOMINGO.lng,
    zoom: coordenada ? 16 : 13,
    conMarcador: Boolean(coordenada),
  });

  return (
    <View style={styles.container}>
      <WebView
        ref={webviewRef}
        style={styles.mapa}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={recibirMensaje}
      />

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
