import { useCallback, useState } from 'react';
import { Text, View, FlatList, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { useTiempoReal } from '../context/RealtimeContext';
import { colores, radio } from '../constants/tema';
import { Icono, estiloTarjeta } from '../components/ui';

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

          {error ? (
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>
          ) : null}

          {resumen && !cargando ? (
            <>
              <View
                style={styles.tarjetaGrande}
                accessible
                accessibilityLabel={`${resumen.carreras} ${resumen.carreras === 1 ? 'entrega completada' : 'entregas completadas'}`}
              >
                <View style={styles.tarjetaGrandeIcono}>
                  <Icono nombre="checkmark-done" tamano={26} color="#fff" />
                </View>
                <View>
                  <Text style={styles.tarjetaGrandeNumero}>{resumen.carreras}</Text>
                  <Text style={styles.tarjetaGrandeTexto}>
                    {resumen.carreras === 1 ? 'entrega completada' : 'entregas completadas'}
                  </Text>
                </View>
              </View>

              <View style={styles.filaTarjetas}>
                <View
                  style={[styles.tarjeta, styles.tarjetaDebes]}
                  accessible
                  accessibilityLabel={`Debes entregar${porcentaje ? ` ${porcentaje}` : ''}: ${resumen.comision} dólares`}
                >
                  <Icono nombre="arrow-up-circle" tamano={26} color={colores.naranja} />
                  <Text style={styles.tarjetaNumero}>${resumen.comision}</Text>
                  <Text style={styles.tarjetaTexto}>Debes entregar{porcentaje ? ` (${porcentaje})` : ''}</Text>
                </View>
                <View
                  style={[styles.tarjeta, styles.tarjetaGanas]}
                  accessible
                  accessibilityLabel={`Te quedas tú: ${resumen.neto} dólares`}
                >
                  <Icono nombre="wallet" tamano={26} color={colores.verde} />
                  <Text style={styles.tarjetaNumero}>${resumen.neto}</Text>
                  <Text style={styles.tarjetaTexto}>Te quedas tú</Text>
                </View>
              </View>

              <Text style={styles.totalGenerado}>Total generado en envíos: ${resumen.total}</Text>

              {resumen.sin_valor > 0 ? (
                <View style={styles.aviso}>
                  <Icono nombre="information-circle" tamano={20} color={colores.naranja} />
                  <Text style={styles.avisoTexto}>
                    {resumen.sin_valor} {resumen.sin_valor === 1 ? 'entrega no tiene' : 'entregas no tienen'} valor de
                    envío registrado y cuentan como $0.00.
                  </Text>
                </View>
              ) : null}

              <Text accessibilityRole="header" style={styles.seccion}>Detalle</Text>
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
    borderRadius: radio.pastilla,
    backgroundColor: colores.tarjeta,
    borderWidth: 1.5,
    borderColor: colores.bordeCampo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atajoActivo: { backgroundColor: colores.primario, borderColor: colores.primario },
  atajoTexto: { fontWeight: '700', fontSize: 14, color: colores.tenue },
  atajoTextoActivo: { color: '#fff' },

  tarjetaGrande: {
    ...estiloTarjeta,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  tarjetaGrandeIcono: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colores.primario,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tarjetaGrandeNumero: { fontSize: 36, fontWeight: '800', color: colores.texto, lineHeight: 40 },
  tarjetaGrandeTexto: { fontSize: 14, color: colores.tenue },

  filaTarjetas: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  tarjeta: { flex: 1, borderRadius: radio.grande, padding: 16, alignItems: 'center', gap: 6 },
  tarjetaDebes: { backgroundColor: '#fff4e0' },
  tarjetaGanas: { backgroundColor: '#e6f6ec' },
  tarjetaNumero: { fontSize: 26, fontWeight: '800', color: colores.texto },
  tarjetaTexto: { fontSize: 13, fontWeight: '600', color: colores.tenue, textAlign: 'center' },
  totalGenerado: { fontSize: 13, color: colores.tenue, textAlign: 'center', marginBottom: 12 },
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fff4e0',
    borderRadius: radio.medio,
    padding: 12,
    marginBottom: 12,
  },
  avisoTexto: { flex: 1, fontSize: 13, color: '#5c3300', lineHeight: 18 },
  seccion: { fontSize: 13, fontWeight: '800', color: colores.suave, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 6, marginBottom: 8 },
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
  filaValor: { fontSize: 17, fontWeight: '800', color: colores.verde },
  vacio: { alignItems: 'center', gap: 12, marginTop: 40, paddingHorizontal: 32 },
  vacioTexto: { textAlign: 'center', color: colores.tenue, fontSize: 15 },
  error: { color: colores.peligro, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
});
