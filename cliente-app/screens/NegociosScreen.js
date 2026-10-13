import { useState, useEffect, useRef, useCallback } from 'react';
import { Text, View, Image, FlatList, Pressable, StyleSheet } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import api from '../services/api';
import { colores, fuente, radio } from '../constants/tema';
import { Aviso, Boton, Entrada, Icono, Rayas, Titulo, estiloTarjeta } from '../components/ui';

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
      <Rayas estilo={styles.encargoRayas} />
      <View style={styles.encargoCuerpo}>
        <Text style={styles.encargoTitulo}>Pedir un encargo</Text>
        <Text style={styles.encargoTexto}>Recogemos lo que necesites en cualquier lugar y te lo llevamos.</Text>
      </View>
      <View style={styles.encargoFlecha}>
        <Icono nombre="arrow-forward" tamano={22} color={colores.primarioOscuro} />
      </View>
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
          <View style={styles.aviso}>
            <Aviso tipo="error">No pudimos cargar los restaurantes. Revisa tu conexión.</Aviso>
            <Boton titulo="Reintentar" variante="secundario" icono="refresh" onPress={cargar} />
          </View>
        ) : (
          <Text style={styles.vacio}>{cargando ? 'Cargando restaurantes…' : 'Todavía no hay restaurantes disponibles.'}</Text>
        )
      }
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item, index }) => {
        const resumen = resumenSucursales(item.sucursales);
        const cerrado = item.sucursales.every((s) => !s.abierta);
        return (
          <Entrada indice={index} estilo={styles.celda}>
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
          </Entrada>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colores.fondo },
  lista: { padding: 12, paddingBottom: 28 },
  columnas: { gap: 12, marginBottom: 12 },
  seccion: { fontSize: 30, marginTop: 10, marginBottom: 12 },

  encargo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colores.primario,
    borderRadius: radio.grande,
    paddingVertical: 20,
    paddingLeft: 18,
    paddingRight: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },
  encargoPresionado: { backgroundColor: colores.primarioOscuro },
  encargoRayas: { right: 56 },
  encargoCuerpo: { flex: 1 },
  encargoTitulo: { color: '#fff', fontFamily: fuente.display, fontSize: 30, letterSpacing: 0.3, textTransform: 'uppercase' },
  encargoTexto: { color: '#fff', fontSize: 14, marginTop: 2, lineHeight: 19, maxWidth: '86%' },
  encargoFlecha: {
    width: 44,
    height: 44,
    borderRadius: radio.medio,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  celda: { flex: 1, maxWidth: '48.5%' },
  card: { ...estiloTarjeta, padding: 0, overflow: 'hidden' },
  cardPresionada: { opacity: 0.9, transform: [{ scale: 0.985 }] },
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
  veloTexto: { color: '#fff', fontFamily: fuente.display, fontSize: 24, letterSpacing: 1, textTransform: 'uppercase' },
  info: { padding: 12 },
  nombre: { fontFamily: fuente.display, fontSize: 21, lineHeight: 22, letterSpacing: 0.2, textTransform: 'uppercase', minHeight: 44, color: colores.texto },
  resumen: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 6 },
  direccion: { flex: 1, fontSize: 13, color: colores.tenue },

  vacio: { textAlign: 'center', color: colores.tenue, marginTop: 40, fontSize: 15 },
  aviso: { gap: 12, marginTop: 24 },
});
