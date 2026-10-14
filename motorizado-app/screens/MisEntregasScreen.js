import { useState, useCallback, useLayoutEffect, useRef } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect, useIsFocused, useScrollToTop } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pedir } from '../services/consultas';
import { useCargaRapida } from '../hooks/useCargaRapida';
import { MAX_EDAD_MS } from '../services/cargaRapida';
import { useTiempoReal } from '../context/RealtimeContext';
import { esFinal, etiquetaEstado } from '../constants/estados';
import { colores, fuente, tipo, radio, espacio } from '../constants/tema';
import { Aviso, AvisosCarga, Boleta, Boton, Cabecera, Entrada, Esqueleto, Icono, Insignia, NumeroPedido, Presionable, Text, Titulo } from '../components/ui';

const INTERVALO_REFRESCO_MS = 5000;
const INTERVALO_RESPALDO_MS = 30000;

// Un extremo de la carrera (recoger / entregar): rótulo corto y el lugar, en una sola línea.
function Tramo({ icono, rotulo, valor }) {
  return (
    <View style={styles.tramo}>
      <Icono nombre={icono} tamano={20} color={colores.primarioOscuro} estilo={styles.tramoIcono} />
      <View style={styles.tramoCuerpo}>
        <Text style={styles.rotulo}>{rotulo}</Text>
        <Text style={styles.valor} numberOfLines={1}>{valor}</Text>
      </View>
    </View>
  );
}

// Ticket de entrega mientras llegan los datos: misma boleta y mismos huecos que el real, para que nada salte.
function TramoEsqueleto() {
  return (
    <View style={styles.tramo}>
      <Esqueleto ancho={20} alto={20} radio={10} estilo={styles.tramoIcono} />
      <View style={styles.tramoCuerpo}>
        <Esqueleto ancho="30%" alto={19} />
        <Esqueleto ancho="70%" alto={25} estilo={styles.esqueletoValor} />
      </View>
    </View>
  );
}

function TicketEsqueleto() {
  return (
    <Boleta pie={<View style={styles.pie}><Esqueleto ancho="35%" alto={22} /><Esqueleto ancho={80} alto={37} /></View>}>
      <View style={styles.encabezado}>
        <Esqueleto ancho={110} alto={24} />
        <Esqueleto ancho={84} alto={28} radio={14} />
      </View>
      <TramoEsqueleto />
      <TramoEsqueleto />
    </Boleta>
  );
}

const SIN_ENTREGAS = [];
const pedirEntregas = pedir('/mis-entregas/');
const pedirPerfil = pedir('/perfil/');

const resumenEnCurso = (n) => (n === 0 ? 'Sin entregas en curso' : `${n} ${n === 1 ? 'entrega' : 'entregas'} en curso`);

export default function MisEntregasScreen({ navigation }) {
  const { suscribir, conectado } = useTiempoReal();
  // Con el socket conectado el sondeo es solo un respaldo; sin él vuelve al ritmo rápido.
  const { datos, vinoDeCache, cargando, error, lento, recargar } = useCargaRapida('entregas', pedirEntregas, {
    intervalo: conectado ? INTERVALO_RESPALDO_MS : INTERVALO_REFRESCO_MS,
  });
  const entregas = datos ?? SIN_ENTREGAS;
  // Mismo perfil (misma clave) que la pestaña Perfil: una petición cada 60 s sirve a las dos.
  const { datos: perfil } = useCargaRapida('perfil', pedirPerfil, { maxEdad: MAX_EDAD_MS });
  const nombre = perfil?.first_name ?? '';
  const [refrescando, setRefrescando] = useState(false);
  const insets = useSafeAreaInsets();
  const lista = useRef(null);
  const enfocada = useIsFocused(); // la barra de estado es clara solo mientras se ve esta cabecera celeste
  useScrollToTop(lista); // tocar de nuevo la pestaña activa vuelve al inicio de la lista
  const [verHistorial, setVerHistorial] = useState(false);

  // La cabecera celeste hace de encabezado de la pantalla.
  useLayoutEffect(() => { navigation.setOptions({ headerShown: false }); }, [navigation]);

  // Un aviso del servidor ("algo cambió") vuelve a pedir la lista.
  useFocusEffect(useCallback(() => suscribir(() => recargar({ forzar: true })), [suscribir, recargar]));

  const refrescar = async () => {
    setRefrescando(true);
    await recargar({ forzar: true, manual: true });
    setRefrescando(false);
  };

  const enCurso = entregas.filter((e) => !esFinal(e.estado));
  const historial = entregas.filter((e) => esFinal(e.estado));

  return (
    <View style={styles.pantalla}>
      {enfocada ? <StatusBar style="light" /> : null}
      <Cabecera estilo={{ paddingTop: insets.top + 14 }}>
        <Titulo estilo={styles.saludo}>{nombre ? `Hola, ${nombre}` : 'Hola'}</Titulo>
        {datos === undefined && !error ? (
          <Esqueleto ancho={170} alto={20} estilo={styles.esqueletoResumen} />
        ) : (
          <Text style={styles.resumen}>{resumenEnCurso(enCurso.length)}</Text>
        )}
      </Cabecera>
      <View style={styles.filtros} accessibilityRole="tablist">
        {[
          { texto: 'En curso', cantidad: enCurso.length, historial: false },
          { texto: 'Historial', cantidad: historial.length, historial: true },
        ].map((f) => {
          const activo = verHistorial === f.historial;
          return (
            <Presionable
              key={f.texto}
              accessibilityRole="tab"
              aria-selected={activo}
              accessibilityLabel={`${f.texto}, ${f.cantidad} ${f.cantidad === 1 ? 'entrega' : 'entregas'}`}
              style={[styles.filtro, activo && styles.filtroActivo]}
              onPress={() => setVerHistorial(f.historial)}
            >
              <Text style={[styles.filtroTexto, activo && styles.filtroTextoActivo]}>{f.texto}</Text>
              <View style={[styles.contador, activo && styles.contadorActivo]}>
                <Text style={[styles.contadorTexto, activo && styles.contadorTextoActivo]}>{f.cantidad}</Text>
              </View>
            </Presionable>
          );
        })}
      </View>
      <FlatList
        ref={lista}
        style={styles.container}
        contentContainerStyle={styles.lista}
        data={verHistorial ? historial : enCurso}
        refreshing={refrescando}
        onRefresh={refrescar}
        keyExtractor={(item) => item.id.toString()}
        // Solo cuando hay aviso: la lista usa `gap` y un encabezado vacío sumaría un hueco de 12 px.
        ListHeaderComponent={(datos === undefined ? lento : error) ? <AvisosCarga lento={lento} error={error} hayDatos={datos !== undefined} /> : null}
        ListEmptyComponent={
          cargando ? (
            <View style={styles.esqueletos} accessible accessibilityRole="progressbar" accessibilityLabel="Cargando" aria-busy>
              {[0, 1].map((i) => <TicketEsqueleto key={i} />)}
            </View>
          ) : error && datos === undefined ? (
            <View style={styles.esqueletos}>
              <Aviso tipo="error">No pudimos cargar tus entregas. Revisa tu conexión.</Aviso>
              <Boton titulo="Reintentar" variante="secundario" icono="refresh" onPress={() => recargar({ forzar: true, manual: true })} />
            </View>
          ) : (
            <View style={styles.vacio}>
              <Icono nombre={verHistorial ? 'archive-outline' : 'bicycle'} tamano={44} color={colores.suave} />
              <Text style={styles.vacioTexto}>
                {verHistorial ? 'Aún no tienes entregas finalizadas' : 'No tienes entregas en curso'}
              </Text>
            </View>
          )
        }
        renderItem={({ item, index }) => {
          const valor = item.costo_envio != null ? `$${parseFloat(item.costo_envio).toFixed(2)}` : null;
          return (
            <Entrada indice={index} tipo="fundido" animar={!vinoDeCache}>
              <Presionable
                testID="ticket-entrega"
                accessibilityRole="button"
                accessibilityLabel={`Entrega ${item.id}${valor ? `, ${valor}` : ''}. Estado: ${etiquetaEstado[item.estado]}. Recoger en ${item.recogida.nombre}, ${item.recogida.direccion}. Entregar en ${item.destino_direccion}. Ver detalle`}
                onPress={() => navigation.navigate('EntregaDetalle', { entrega: item })}
                android_ripple={{ color: 'rgba(0,124,171,0.12)' }}
                style={({ pressed }) => pressed && styles.presionada}
              >
                <Boleta
                  pie={
                    <View style={styles.pie}>
                      <Text style={styles.pieRotulo}>Tu carrera</Text>
                      <Text style={styles.precio}>{valor ?? '—'}</Text>
                      <Icono nombre="chevron-forward" tamano={20} color={colores.suave} />
                    </View>
                  }
                >
                  <View style={styles.encabezado}>
                    <NumeroPedido numero={item.id} prefijo="Entrega" />
                    <Insignia estado={item.estado} />
                  </View>
                  <Tramo
                    icono={item.tipo === 'ENCARGO' ? 'cube-outline' : 'storefront-outline'}
                    rotulo="Recoger en"
                    valor={item.recogida.nombre}
                  />
                  <Tramo icono="location-outline" rotulo="Entregar en" valor={item.destino_direccion} />
                </Boleta>
              </Presionable>
            </Entrada>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  container: { backgroundColor: colores.fondo },
  lista: { paddingHorizontal: espacio.l, paddingTop: espacio.m, paddingBottom: espacio.xl, gap: espacio.m, flexGrow: 1 },

  saludo: { fontSize: tipo.titulo.fontSize, lineHeight: 28, color: colores.blanco },
  esqueletoResumen: { marginTop: 2 },
  esqueletos: { gap: espacio.m },
  esqueletoValor: { marginTop: 1 },
  resumen: { ...tipo.apoyo, marginTop: 2, color: colores.blanco },

  // Pestañas tipo interruptor: la activa es una pastilla blanca sobre el fondo gris.
  filtros: { flexDirection: 'row', margin: espacio.l, marginBottom: espacio.xs, padding: espacio.xs, borderRadius: radio.medio, backgroundColor: colores.relleno },
  filtro: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.s,
    borderRadius: 9,
  },
  filtroActivo: {
    backgroundColor: colores.blanco,
    elevation: 1,
    shadowColor: colores.sombra,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  filtroTexto: { ...tipo.apoyo, fontFamily: fuente.negrita, color: colores.tenue },
  filtroTextoActivo: { color: colores.primarioOscuro },
  contador: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colores.rellenoFuerte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contadorActivo: { backgroundColor: colores.acentoSuave },
  contadorTexto: { ...tipo.etiqueta, color: colores.tenue },
  contadorTextoActivo: { color: colores.primarioOscuro },

  presionada: { opacity: 0.9 },
  // Todos los tickets tienen la misma estructura (dos tramos de una línea cada uno y un pie), así que miden lo mismo.
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.s },
  tramo: { flexDirection: 'row', gap: espacio.m, marginTop: 10 },
  tramoIcono: { marginTop: 2 },
  tramoCuerpo: { flex: 1, minWidth: 0 },
  rotulo: { ...tipo.etiqueta, color: colores.tenue },
  valor: { ...tipo.cuerpo, fontFamily: fuente.extra, color: colores.texto, marginTop: 1 },
  pie: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  pieRotulo: { ...tipo.apoyo, fontFamily: fuente.negrita, flex: 1, color: colores.tenue },
  precio: { fontFamily: fuente.extra, fontSize: 26, lineHeight: 32, color: colores.verde },
  vacio: { alignItems: 'center', gap: espacio.m, marginTop: 56, paddingHorizontal: 32 },
  vacioTexto: { textAlign: 'center', color: colores.tenue, fontSize: tipo.cuerpo.fontSize },
});
