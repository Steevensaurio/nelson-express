import { useState, useEffect, useRef } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colores, fuente, radio } from '../constants/tema';
import { Boton, Icono, Text } from './ui';

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
  const insets = useSafeAreaInsets();

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
      <View style={styles.cargandoContainer} accessibilityLiveRegion="polite">
        <ActivityIndicator size="large" color={colores.primario} />
        <Text style={styles.cargandoTexto}>Obteniendo tu ubicación…</Text>
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
        accessibilityLabel="Mapa para elegir la ubicación. Toca un punto para marcarlo"
      />

      <View style={[styles.ayuda, { top: insets.top + 64 }]} accessibilityLiveRegion="polite">
        <Icono nombre="information-circle" tamano={20} color={colores.primarioOscuro} />
        <Text style={styles.ayudaTexto}>
          {coordenada
            ? 'Toca otro punto para ajustar, o confirma este'
            : 'No se pudo obtener tu ubicación. Toca el mapa para marcarla a mano'}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancelar"
        onPress={onCancelar}
        hitSlop={6}
        style={({ pressed }) => [styles.cancelarBoton, { top: insets.top + 10 }, pressed && styles.cancelarPresionado]}
      >
        <Icono nombre="close" tamano={20} color={colores.peligro} />
        <Text style={styles.cancelarTexto}>Cancelar</Text>
      </Pressable>

      {coordenada && (
        <View style={[styles.barra, { paddingBottom: 12 + insets.bottom }]}>
          <Boton
            titulo={confirmando ? 'Obteniendo dirección…' : 'Confirmar ubicación'}
            icono="checkmark"
            onPress={confirmar}
            cargando={confirmando}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cargandoContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.fondo },
  cargandoTexto: { marginTop: 12, color: colores.tenue, fontSize: 16 },
  mapa: { flex: 1 },
  ayuda: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: radio.medio,
    elevation: 4,
  },
  ayudaTexto: { flex: 1, fontSize: 14, color: colores.texto },
  cancelarBoton: {
    position: 'absolute',
    left: 12,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    borderRadius: radio.pastilla,
    elevation: 4,
  },
  cancelarPresionado: { backgroundColor: colores.peligroSuave },
  cancelarTexto: { color: colores.peligro, fontFamily: fuente.extra, fontSize: 15 },
  barra: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
  },
});
