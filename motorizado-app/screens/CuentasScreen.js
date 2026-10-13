import { useCallback, useState } from 'react';
import { Text, View, FlatList, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { useTiempoReal } from '../context/RealtimeContext';
import { colores, fuente, radio } from '../constants/tema';
import { Aviso, Boleta, Icono, Titulo, estiloTarjeta } from '../components/ui';

const dosDigitos = (n) => String(n).padStart(2, '0');
const aISO = (fecha) => `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;
const sumarDias = (fecha, dias) => {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
};
const horaCorta = (iso) => {
  const f = new Date(iso);
  return `${dosDigitos(f.getDate())}/${dosDigitos(f.getMonth() + 1)} ${dosDigitos(f.getHours())}:${dosDigitos(f.getMinutes())}`;
};

const ATAJOS = [
  { texto: 'Hoy', rango: () => [new Date(), new Date()] },
  { texto: 'Ayer', rango: () => [sumarDias(new Date(), -1), sumarDias(new Date(), -1)] },
  { texto: '7 días', rango: () => [sumarDias(new Date(), -6), new Date()] },
  { texto: 'Este mes', rango: () => [new Date(new Date().getFullYear(), new Date().getMonth(), 1), new Date()] },
];

export default function CuentasScreen() {
  const insets = useSafeAreaInsets();
  const [atajo, setAtajo] = useState('Hoy');
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async (nombreAtajo) => {
    const elegido = ATAJOS.find((a) => a.texto === nombreAtajo) ?? ATAJOS.find((a) => a.texto === atajo);
    const [desde, hasta] = elegido.rango();
    try {
      const { data } = await api.get('/mis-entregas/ganancias/', {
        params: { desde: aISO(desde), hasta: aISO(hasta) },
      });
      setDatos(data);
      setError('');
    } catch (err) {
      setError('No se pudieron cargar tus cuentas');
    }
    setCargando(false);
    setRefrescando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atajo]);

  const { suscribir } = useTiempoReal();

  useFocusEffect(
    useCallback(() => {
      cargar();
      return suscribir(cargar); // si se entrega un pedido mientras miras esta pantalla, se actualiza sola
    }, [cargar, suscribir])
  );

  const elegirAtajo = (texto) => {
    setAtajo(texto);
    setCargando(true);
    cargar(texto);
  };

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
  };

  const resumen = datos?.resumen;
  const porcentaje = datos?.comision_porcentaje ? `${datos.comision_porcentaje}%` : '';

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[styles.contenido, { paddingBottom: 16 + insets.bottom }]}
      refreshing={refrescando}
      onRefresh={refrescar}
      data={datos?.carreras ?? []}
      keyExtractor={(item) => item.id.toString()}
      ListHeaderComponent={
        <>
          <View style={styles.atajos} accessibilityRole="tablist">
            {ATAJOS.map((a) => {
              const activo = atajo === a.texto;
              return (
                <Pressable
                  key={a.texto}
                  accessibilityRole="tab"
                  aria-selected={activo}
                  accessibilityLabel={a.texto}
                  style={[styles.atajo, activo && styles.atajoActivo]}
                  onPress={() => elegirAtajo(a.texto)}
                >
                  <Text style={[styles.atajoTexto, activo && styles.atajoTextoActivo]}>{a.texto}</Text>
                </Pressable>
              );
            })}
          </View>

          {error ? <Aviso tipo="error" estilo={styles.espacioAviso}>{error}</Aviso> : null}

          {resumen && !cargando ? (
            <>
              {/* Liquidación del período, como una boleta: lo que te queda es lo que importa. */}
              <Boleta
                estilo={styles.liquidacion}
                pie={
                  <View style={styles.liquidacionPie} accessible accessibilityLabel={`Te quedas tú: ${resumen.neto} dólares`}>
                    <Text style={styles.netoRotulo}>Te quedas tú</Text>
                    <Text style={styles.netoValor}>${resumen.neto}</Text>
                  </View>
                }
              >
                <View
                  style={styles.liquidacionLinea}
                  accessible
                  accessibilityLabel={`${resumen.carreras} ${resumen.carreras === 1 ? 'entrega completada' : 'entregas completadas'}`}
                >
                  <Text style={styles.lineaRotulo}>{resumen.carreras === 1 ? 'Entrega completada' : 'Entregas completadas'}</Text>
                  <Text style={styles.lineaValor}>{resumen.carreras}</Text>
                </View>
                <View style={styles.liquidacionLinea} accessible accessibilityLabel={`Total generado en envíos: ${resumen.total} dólares`}>
                  <Text style={styles.lineaRotulo}>Total en envíos</Text>
                  <Text style={styles.lineaValor}>${resumen.total}</Text>
                </View>
                <View
                  style={styles.liquidacionLinea}
                  accessible
                  accessibilityLabel={`Debes entregar${porcentaje ? ` ${porcentaje}` : ''}: ${resumen.comision} dólares`}
                >
                  <Text style={[styles.lineaRotulo, styles.lineaDebes]}>Debes entregar{porcentaje ? ` (${porcentaje})` : ''}</Text>
                  <Text style={[styles.lineaValor, styles.lineaDebes]}>−${resumen.comision}</Text>
                </View>
              </Boleta>

              {resumen.sin_valor > 0 ? (
                <Aviso tipo="alerta" estilo={styles.espacioAviso}>
                  {`${resumen.sin_valor} ${resumen.sin_valor === 1 ? 'entrega no tiene' : 'entregas no tienen'} valor de envío registrado y cuentan como $0.00.`}
                </Aviso>
              ) : null}

              <Titulo estilo={styles.seccion}>Detalle</Titulo>
            </>
          ) : null}
        </>
      }
      renderItem={({ item }) => (
        <View
          style={styles.fila}
          accessible
          accessibilityLabel={`${item.recogida} hacia ${item.destino_direccion}, ${horaCorta(item.entregado_en)}, ${item.costo_envio != null ? `${item.costo_envio} dólares` : 'sin valor'}`}
        >
          <View style={styles.filaInfo}>
            <Text style={styles.filaRecogida} numberOfLines={1}>{item.recogida}</Text>
            <Text style={styles.filaDestino} numberOfLines={1}>{item.destino_direccion}</Text>
            <Text style={styles.filaFecha}>{horaCorta(item.entregado_en)}</Text>
          </View>
          <Text style={styles.filaValor}>{item.costo_envio != null ? `$${item.costo_envio}` : '—'}</Text>
        </View>
      )}
      ListEmptyComponent={
        !cargando ? (
          <View style={styles.vacio}>
            <Icono nombre="wallet-outline" tamano={44} color={colores.suave} />
            <Text style={styles.vacioTexto}>No tienes entregas completadas en este período.</Text>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colores.fondo },
  contenido: { padding: 16 },
  atajos: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  atajo: {
    flex: 1,
    minHeight: 48,
    borderRadius: radio.medio,
    backgroundColor: colores.tarjeta,
    borderWidth: 1.5,
    borderColor: colores.bordeCampo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atajoActivo: { backgroundColor: colores.primario, borderColor: colores.primario },
  atajoTexto: { fontFamily: fuente.display, fontSize: 18, letterSpacing: 0.6, textTransform: 'uppercase', color: colores.tenue },
  atajoTextoActivo: { color: '#fff' },

  liquidacion: { marginBottom: 14 },
  liquidacionLinea: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingVertical: 6 },
  lineaRotulo: { fontSize: 15, color: colores.tenue },
  lineaValor: { fontFamily: fuente.display, fontSize: 26, color: colores.texto },
  lineaDebes: { color: colores.naranja },
  liquidacionPie: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  netoRotulo: { fontFamily: fuente.displayMedio, fontSize: 20, letterSpacing: 0.8, textTransform: 'uppercase', color: colores.texto },
  netoValor: { fontFamily: fuente.display, fontSize: 52, lineHeight: 52, color: colores.verde },
  espacioAviso: { marginBottom: 14 },
  seccion: { fontSize: 24, marginTop: 6, marginBottom: 10 },
  fila: {
    ...estiloTarjeta,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    marginBottom: 10,
    borderRadius: radio.medio,
  },
  filaInfo: { flex: 1, paddingRight: 10 },
  filaRecogida: { fontSize: 15, fontWeight: '700', color: colores.texto },
  filaDestino: { fontSize: 13, color: colores.tenue, marginTop: 1 },
  filaFecha: { fontSize: 12, color: colores.suave, marginTop: 3 },
  filaValor: { fontFamily: fuente.display, fontSize: 24, color: colores.verde },
  vacio: { alignItems: 'center', gap: 12, marginTop: 40, paddingHorizontal: 32 },
  vacioTexto: { textAlign: 'center', color: colores.tenue, fontSize: 15 },
});
