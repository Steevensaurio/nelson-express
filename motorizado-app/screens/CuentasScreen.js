import { useCallback, useState } from 'react';
import { View, FlatList, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { useCargaRapida } from '../hooks/useCargaRapida';
import { useTiempoReal } from '../context/RealtimeContext';
import { colores, fuente, radio } from '../constants/tema';
import { Aviso, AvisosCarga, Boleta, Esqueleto, Icono, Text, Titulo, estiloTarjeta } from '../components/ui';

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

// Liquidación y filas mientras llegan los datos: mismas medidas que las reales, para que nada salte al cargar.
function FilaLiquidacionEsqueleto() {
  return (
    <View style={styles.liquidacionLinea}>
      <Esqueleto ancho="45%" alto={23} />
      <Esqueleto ancho={56} alto={31} />
    </View>
  );
}

function FilaEsqueleto() {
  return (
    <View style={styles.fila}>
      <View style={styles.filaInfo}>
        <Esqueleto ancho="55%" alto={24} />
        <Esqueleto ancho="75%" alto={20} estilo={styles.esqueletoDestino} />
        <Esqueleto ancho="30%" alto={18} estilo={styles.esqueletoFecha} />
      </View>
      <Esqueleto ancho={52} alto={31} />
    </View>
  );
}

const SIN_CARRERAS = [];

export default function CuentasScreen() {
  const insets = useSafeAreaInsets();
  const [atajo, setAtajo] = useState('Hoy');
  const [refrescando, setRefrescando] = useState(false);
  const { suscribir } = useTiempoReal();

  // Una clave por período: al cambiar de pestaña se ve al instante lo último de ese período y se refresca por detrás.
  const pedirCuentas = async () => {
    const [desde, hasta] = ATAJOS.find((a) => a.texto === atajo).rango();
    const { data } = await api.get('/mis-entregas/ganancias/', { params: { desde: aISO(desde), hasta: aISO(hasta) } });
    return data;
  };
  const { datos, cargando, error, lento, recargar } = useCargaRapida(`cuentas:${atajo}`, pedirCuentas);

  // Si se entrega un pedido mientras miras esta pantalla, se actualiza sola.
  useFocusEffect(useCallback(() => suscribir(recargar), [suscribir, recargar]));

  const refrescar = async () => {
    setRefrescando(true);
    await recargar();
    setRefrescando(false);
  };

  const resumen = datos?.resumen;
  const porcentaje = datos?.comision_porcentaje ? `${datos.comision_porcentaje}%` : '';

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[styles.contenido, { paddingBottom: 16 + insets.bottom }]}
      refreshing={refrescando}
      onRefresh={refrescar}
      data={datos?.carreras ?? SIN_CARRERAS}
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
                  onPress={() => setAtajo(a.texto)}
                >
                  <Text style={[styles.atajoTexto, activo && styles.atajoTextoActivo]}>{a.texto}</Text>
                </Pressable>
              );
            })}
          </View>

          {error && !datos ? <Aviso tipo="error" estilo={styles.espacioAviso}>No se pudieron cargar tus cuentas</Aviso> : null}
          <AvisosCarga lento={lento} error={error} hayDatos={Boolean(datos)} estilo={styles.espacioAviso} />

          {cargando ? (
            <View accessibilityRole="progressbar" accessibilityLabel="Cargando" aria-busy>
              <View style={styles.liquidacion}>
                <Boleta
                  pie={
                    <View style={styles.liquidacionPie}>
                      <Esqueleto ancho="40%" alto={27} />
                      <Esqueleto ancho={96} alto={55} />
                    </View>
                  }
                >
                  <FilaLiquidacionEsqueleto />
                  <FilaLiquidacionEsqueleto />
                  <FilaLiquidacionEsqueleto />
                </Boleta>
              </View>
              <Esqueleto ancho={90} alto={24} estilo={styles.esqueletoSeccion} />
              <FilaEsqueleto />
              <FilaEsqueleto />
            </View>
          ) : null}

          {resumen ? (
            <>
              {/* Liquidación del período, como una boleta: lo que te queda es lo que importa. */}
              <View testID="ticket-liquidacion" style={styles.liquidacion}>
                <Boleta
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
              </View>

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
        datos ? (
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
  // Pestañas tipo interruptor: la activa es una pastilla blanca sobre el fondo gris.
  atajos: { flexDirection: 'row', padding: 4, borderRadius: 12, backgroundColor: '#e6ecf0', marginBottom: 16 },
  atajo: {
    flex: 1,
    minHeight: 48,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atajoActivo: {
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#002838',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  atajoTexto: { fontFamily: fuente.negrita, fontSize: 13.5, color: '#4d5b64' },
  atajoTextoActivo: { color: colores.primarioOscuro },

  liquidacion: { marginBottom: 14 },
  liquidacionLinea: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingVertical: 6 },
  lineaRotulo: { fontFamily: fuente.media, fontSize: 15, color: colores.tenue },
  lineaValor: { fontFamily: fuente.extra, fontSize: 20, color: colores.texto },
  lineaDebes: { color: colores.naranja },
  liquidacionPie: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  netoRotulo: { fontFamily: fuente.extra, fontSize: 17, color: colores.texto },
  netoValor: { fontFamily: fuente.extra, fontSize: 40, lineHeight: 48, color: colores.verde },
  espacioAviso: { marginBottom: 14 },
  esqueletoDestino: { marginTop: 1 },
  esqueletoFecha: { marginTop: 3 },
  esqueletoSeccion: { marginTop: 6, marginBottom: 10 },
  seccion: { marginTop: 6, marginBottom: 10 },
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
  filaRecogida: { fontFamily: fuente.extra, fontSize: 15, color: colores.texto },
  filaDestino: { fontFamily: fuente.media, fontSize: 13, color: colores.tenue, marginTop: 1 },
  filaFecha: { fontFamily: fuente.media, fontSize: 12, color: colores.suave, marginTop: 3 },
  filaValor: { fontFamily: fuente.extra, fontSize: 20, color: colores.verde },
  vacio: { alignItems: 'center', gap: 12, marginTop: 40, paddingHorizontal: 32 },
  vacioTexto: { textAlign: 'center', color: colores.tenue, fontSize: 15 },
});
