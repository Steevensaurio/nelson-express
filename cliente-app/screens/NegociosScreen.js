import { useState, useEffect, useRef, useCallback } from 'react';
import { Text, View, Image, FlatList, Pressable, StyleSheet } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import api from '../services/api';
import { colores, radio } from '../constants/tema';
import { Boton, Icono, Titulo, estiloTarjeta } from '../components/ui';

// Una sola sucursal: su dirección. Varias: cuántas hay. Ninguna abierta: aviso.
const resumenSucursales = (sucursales) => {
  const abiertas = sucursales.filter((s) => s.abierta);
  if (abiertas.length === 0) return 'Cerrado por ahora';
  if (sucursales.length === 1) return sucursales[0].direccion;
  return `${abiertas.length} ${abiertas.length === 1 ? 'sucursal abierta' : 'sucursales abiertas'}`;
};

// Foto del negocio o, si no tiene, un recuadro con un ícono.
function FotoNegocio({ negocio, cerrado }) {
  return (
    <View style={styles.foto}>
      {negocio.imagen ? (
        <Image source={{ uri: negocio.imagen }} style={styles.fotoImagen} resizeMode="cover" />
      ) : (
        <Icono nombre="storefront-outline" tamano={40} color={colores.primarioOscuro} />
      )}
      {cerrado ? (
        <View style={styles.velo}>
          <Text style={styles.veloTexto}>Cerrado</Text>
        </View>
      ) : null}
    </View>
  );
}

function TarjetaEncargo({ onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Pedir un encargo. Recogemos lo que necesites en cualquier lugar y te lo llevamos."
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
      style={({ pressed }) => [styles.encargo, pressed && styles.encargoPresionado]}
    >
      <View style={styles.encargoBurbuja} pointerEvents="none" />
      <View style={styles.encargoIcono}>
        <Icono nombre="cube-outline" tamano={28} color="#fff" />
      </View>
      <View style={styles.encargoCuerpo}>
        <Text style={styles.encargoTitulo}>Pedir un encargo</Text>
        <Text style={styles.encargoTexto}>Recogemos lo que necesites en cualquier lugar y te lo llevamos.</Text>
      </View>
      <Icono nombre="chevron-forward" tamano={22} color="#fff" />
    </Pressable>
  );
}

export default function NegociosScreen({ navigation }) {
  const [negocios, setNegocios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const lista = useRef(null);
  useScrollToTop(lista); // tocar de nuevo la pestaña activa vuelve al inicio de la lista

  const cargar = useCallback(() => {
    setCargando(true);
    setError(false);
    api.get('/negocios/')
      .then((response) => setNegocios(response.data))
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }, []);

  useEffect(cargar, [cargar]);

  return (
    <FlatList
      ref={lista}
      style={styles.container}
      contentContainerStyle={styles.lista}
      columnWrapperStyle={styles.columnas}
      data={negocios}
      numColumns={2}
      ListHeaderComponent={
        <View>
          <TarjetaEncargo onPress={() => navigation.navigate('NuevoEncargo')} />
          <Titulo estilo={styles.seccion}>Restaurantes</Titulo>
        </View>
      }
      ListEmptyComponent={
        error ? (
          <View style={styles.aviso} accessibilityRole="alert">
            <Icono nombre="cloud-offline-outline" tamano={36} color={colores.suave} />
            <Text style={styles.avisoTexto}>No pudimos cargar los restaurantes. Revisa tu conexión.</Text>
            <Boton titulo="Reintentar" variante="secundario" icono="refresh" onPress={cargar} />
          </View>
        ) : (
          <Text style={styles.vacio}>{cargando ? 'Cargando restaurantes…' : 'Todavía no hay restaurantes disponibles.'}</Text>
        )
      }
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => {
        const resumen = resumenSucursales(item.sucursales);
        const cerrado = item.sucursales.every((s) => !s.abierta);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.nombre}. ${resumen}. Ver menú`}
            onPress={() => navigation.navigate('Menu', { negocioId: item.id, negocioNombre: item.nombre })}
            android_ripple={{ color: 'rgba(0,124,171,0.15)' }}
            style={({ pressed }) => [styles.card, pressed && styles.cardPresionada]}
          >
            <FotoNegocio negocio={item} cerrado={cerrado} />
            <View style={styles.info}>
              <Text style={styles.nombre} numberOfLines={2}>{item.nombre}</Text>
              <View style={styles.resumen}>
                <Icono nombre="location-outline" tamano={14} color={colores.suave} />
                <Text style={styles.direccion} numberOfLines={2}>{resumen}</Text>
              </View>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colores.fondo },
  lista: { padding: 12, paddingBottom: 28 },
  columnas: { gap: 12, marginBottom: 12 },
  seccion: { fontSize: 20, marginTop: 8, marginBottom: 12 },

  encargo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colores.primario,
    borderRadius: radio.grande,
    padding: 18,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: colores.primario,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  encargoPresionado: { backgroundColor: colores.primarioOscuro },
  encargoBurbuja: {
    position: 'absolute',
    right: -40,
    top: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colores.primarioOscuro,
    opacity: 0.55,
  },
  encargoIcono: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  encargoCuerpo: { flex: 1 },
  encargoTitulo: { color: '#fff', fontSize: 18, fontWeight: '800' },
  encargoTexto: { color: '#fff', fontSize: 14, marginTop: 3, lineHeight: 19 },

  card: {
    ...estiloTarjeta,
    flex: 1,
    maxWidth: '48.5%', // un negocio suelto en la última fila no se estira a todo el ancho
    padding: 0,
    overflow: 'hidden',
  },
  cardPresionada: { opacity: 0.9 },
  foto: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colores.acentoSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoImagen: { width: '100%', height: '100%' },
  velo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,10,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  veloTexto: { color: '#fff', fontWeight: '800', fontSize: 15 },
  info: { padding: 12 },
  nombre: { fontSize: 16, fontWeight: '700', minHeight: 40, color: colores.texto },
  resumen: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 4 },
  direccion: { flex: 1, fontSize: 13, color: colores.tenue },

  vacio: { textAlign: 'center', color: colores.tenue, marginTop: 40, fontSize: 15 },
  aviso: { alignItems: 'center', gap: 12, marginTop: 32, paddingHorizontal: 24 },
  avisoTexto: { textAlign: 'center', color: colores.tenue, fontSize: 15 },
});
