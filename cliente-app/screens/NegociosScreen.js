import { useState, useLayoutEffect, useRef, useMemo } from 'react';
import { View, Image, FlatList, Pressable, TextInput, StyleSheet, Platform } from 'react-native';
import { useScrollToTop, useIsFocused } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pedir } from '../services/consultas';
import { useCargaRapida } from '../hooks/useCargaRapida';
import { colores, fuente } from '../constants/tema';
import { filtrarNegocios } from '../constants/negocios';
import { Aviso, AvisosCarga, Boton, BotonEncargo, Cabecera, Entrada, Esqueleto, Icono, Text, Titulo } from '../components/ui';

// Abierto si al menos una sucursal lo está; el número es el de sucursales abiertas.
const resumenSucursales = (sucursales) => {
  const n = sucursales.filter((s) => s.abierta).length;
  return n === 0 ? null : `Abierto · ${n} ${n === 1 ? 'sucursal' : 'sucursales'}`;
};

// Logo del negocio o, si no tiene, un recuadro con un ícono.
function Logo({ negocio }) {
  return (
    <View style={styles.logo}>
      {negocio.imagen ? (
        <Image source={{ uri: negocio.imagen }} style={styles.logoImagen} resizeMode="contain" />
      ) : (
        <Icono nombre="storefront-outline" tamano={26} color={colores.primarioOscuro} />
      )}
    </View>
  );
}

// Lo que se ve mientras llegan los restaurantes: filas de la misma medida que las reales (76 px) para que nada salte.
function FilaEsqueleto() {
  return (
    <View style={[styles.fila, styles.celda]}>
      <Esqueleto ancho={54} alto={54} radio={14} />
      <View style={styles.textos}>
        <Esqueleto ancho="55%" alto={16} />
        <Esqueleto ancho="35%" alto={13} estilo={styles.esqueletoLinea} />
      </View>
    </View>
  );
}

const SIN_NEGOCIOS = [];
const pedirNegocios = pedir('/negocios/');
const pedirPerfil = pedir('/perfil/');

export default function NegociosScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  // Lo último conocido se pinta al instante y se refresca por detrás (el perfil, que se comparte con otras pantallas, solo cada 60 s).
  const { datos, cargando, error, lento, recargar } = useCargaRapida('negocios', pedirNegocios, { maxEdad: 60000 });
  const { datos: perfil } = useCargaRapida('perfil', pedirPerfil, { maxEdad: 60000 });
  const negocios = datos ?? SIN_NEGOCIOS;
  const nombre = perfil?.first_name ?? '';
  const [busqueda, setBusqueda] = useState('');
  const [foco, setFoco] = useState(false);
  const lista = useRef(null);
  const buscador = useRef(null);
  const enfocada = useIsFocused(); // la barra de estado es clara solo mientras se ve esta cabecera celeste
  useScrollToTop(lista); // tocar de nuevo la pestaña activa vuelve al inicio de la lista

  // La cabecera celeste hace de encabezado de la pantalla.
  useLayoutEffect(() => { navigation.setOptions({ headerShown: false }); }, [navigation]);

  const visibles = useMemo(() => filtrarNegocios(negocios, busqueda), [negocios, busqueda]);
  const sinResultados = negocios.length > 0 && visibles.length === 0;

  return (
    <View style={styles.container}>
      {enfocada ? <StatusBar style="light" /> : null}
      <Cabecera estilo={{ paddingTop: insets.top + 14 }}>
        <Titulo estilo={styles.saludo}>{nombre ? `Hola, ${nombre}` : 'Hola'}{'\n'}¿qué pedimos hoy?</Titulo>
        <Pressable
          accessible={false}
          tabIndex={-1}
          onPress={() => buscador.current?.focus()}
          style={[styles.busca, foco && styles.buscaFoco]}
        >
          <Icono nombre="search" tamano={20} color={colores.suave} />
          <TextInput
            ref={buscador}
            style={styles.buscaInput}
            value={busqueda}
            onChangeText={setBusqueda}
            onFocus={() => setFoco(true)}
            onBlur={() => setFoco(false)}
            placeholder="Buscar restaurante"
            placeholderTextColor={colores.placeholder}
            accessibilityLabel="Buscar restaurante"
            returnKeyType="search"
            autoCorrect={false}
          />
        </Pressable>
      </Cabecera>
      <FlatList
        ref={lista}
        style={styles.flex}
        contentContainerStyle={styles.lista}
        keyboardShouldPersistTaps="handled"
        data={visibles}
        ListHeaderComponent={
          <>
            <BotonEncargo
              titulo="Pedir un encargo"
              subtitulo="Lo que necesites, a tu puerta"
              onPress={() => navigation.navigate('NuevoEncargo')}
              estilo={styles.encargo}
            />
            <AvisosCarga lento={lento} error={error} hayDatos={datos !== undefined} estilo={styles.avisoCarga} />
          </>
        }
        ListEmptyComponent={
          cargando ? (
            <View accessibilityRole="progressbar" accessibilityLabel="Cargando" aria-busy>
              {[0, 1, 2, 3, 4, 5].map((i) => <FilaEsqueleto key={i} />)}
            </View>
          ) : error && datos === undefined ? (
            <View style={styles.aviso}>
              <Aviso tipo="error">No pudimos cargar los restaurantes. Revisa tu conexión.</Aviso>
              <Boton titulo="Reintentar" variante="secundario" icono="refresh" onPress={recargar} />
            </View>
          ) : sinResultados ? (
            <Aviso estilo={styles.aviso}>No encontramos ese restaurante</Aviso>
          ) : (
            <Text style={styles.vacio}>Todavía no hay restaurantes disponibles.</Text>
          )
        }
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item, index }) => {
          const resumen = resumenSucursales(item.sucursales);
          return (
            <Entrada indice={index} estilo={styles.celda}>
              <Pressable
                testID="fila-negocio"
                accessibilityRole="button"
                accessibilityLabel={`${item.nombre}. ${resumen ?? 'Cerrado'}. Ver menú`}
                onPress={() => navigation.navigate('Menu', { negocioId: item.id, negocioNombre: item.nombre })}
                android_ripple={{ color: 'rgba(0,124,171,0.15)' }}
                style={({ pressed }) => [styles.fila, pressed && styles.filaPresionada]}
              >
                <View style={!resumen && styles.atenuado}>
                  <Logo negocio={item} />
                </View>
                <View style={styles.textos}>
                  <Text style={[styles.nombre, !resumen && styles.nombreCerrado]} numberOfLines={1}>{item.nombre}</Text>
                  <View style={styles.estado}>
                    {resumen ? <View style={styles.punto} /> : <Icono nombre="close-circle-outline" tamano={14} color={colores.tenue} />}
                    <Text style={styles.estadoTexto} numberOfLines={1}>{resumen ?? 'Cerrado'}</Text>
                  </View>
                </View>
                <Icono nombre="chevron-forward" tamano={20} color={colores.suave} />
              </Pressable>
            </Entrada>
          );
        }}
      />
    </View>
  );
}

const web = Platform.select({ web: { outlineStyle: 'none' }, default: {} });

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colores.fondo },
  flex: { flex: 1 },
  lista: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28 },

  saludo: { fontSize: 22, lineHeight: 28, color: '#fff' },
  busca: {
    marginTop: 14,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#fff',
    paddingHorizontal: 14,
  },
  buscaFoco: { borderColor: '#0b2530' },
  buscaInput: { flex: 1, minHeight: 44, fontFamily: fuente.media, fontSize: 16, color: colores.texto, ...web },

  encargo: { marginBottom: 14 },
  avisoCarga: { marginBottom: 14 },

  celda: { marginBottom: 10 },
  fila: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colores.tarjeta,
    borderRadius: 16,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 14,
    elevation: 1,
    shadowColor: '#0b2530',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  filaPresionada: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  atenuado: { opacity: 0.45 },
  logo: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#f1f4f6',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImagen: { width: '100%', height: '100%' },
  textos: { flex: 1, minWidth: 0 },
  nombre: { fontFamily: fuente.extra, fontSize: 16, color: colores.texto },
  nombreCerrado: { color: colores.tenue },
  estado: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: colores.verde },
  esqueletoLinea: { marginTop: 8 },
  estadoTexto: { flexShrink: 1, fontFamily: fuente.media, fontSize: 13, color: colores.tenue },

  vacio: { textAlign: 'center', color: colores.tenue, marginTop: 40, fontSize: 15 },
  aviso: { gap: 12, marginTop: 10 },
});
