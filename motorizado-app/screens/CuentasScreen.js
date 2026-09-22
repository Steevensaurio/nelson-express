import { useCallback, useState } from 'react';
import { Text, View, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { useTiempoReal } from '../context/RealtimeContext';
import { colores, sombraTarjeta } from '../constants/tema';

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
          <View style={styles.atajos}>
            {ATAJOS.map((a) => (
              <TouchableOpacity
                key={a.texto}
                style={[styles.atajo, atajo === a.texto && styles.atajoActivo]}
                onPress={() => elegirAtajo(a.texto)}
              >
                <Text style={[styles.atajoTexto, atajo === a.texto && styles.atajoTextoActivo]}>{a.texto}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {resumen && !cargando ? (
            <>
              <View style={styles.tarjetaGrande}>
                <Text style={styles.tarjetaGrandeNumero}>{resumen.carreras}</Text>
                <Text style={styles.tarjetaGrandeTexto}>
                  {resumen.carreras === 1 ? 'entrega completada' : 'entregas completadas'}
                </Text>
              </View>

              <View style={styles.filaTarjetas}>
                <View style={[styles.tarjeta, styles.tarjetaDebes]}>
                  <Text style={styles.tarjetaNumero}>${resumen.comision}</Text>
                  <Text style={styles.tarjetaTexto}>Debes entregar{porcentaje ? ` (${porcentaje})` : ''}</Text>
                </View>
                <View style={[styles.tarjeta, styles.tarjetaGanas]}>
                  <Text style={styles.tarjetaNumero}>${resumen.neto}</Text>
                  <Text style={styles.tarjetaTexto}>Te quedas tú</Text>
                </View>
              </View>

              <Text style={styles.totalGenerado}>Total generado en envíos: ${resumen.total}</Text>

              {resumen.sin_valor > 0 ? (
                <Text style={styles.aviso}>
                  {resumen.sin_valor} {resumen.sin_valor === 1 ? 'entrega no tiene' : 'entregas no tienen'} valor de
                  envío registrado y cuentan como $0.00.
                </Text>
              ) : null}

              <Text style={styles.seccion}>Detalle</Text>
            </>
          ) : null}
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.fila}>
          <View style={styles.filaInfo}>
            <Text style={styles.filaRecogida} numberOfLines={1}>{item.recogida}</Text>
            <Text style={styles.filaDestino} numberOfLines={1}>{item.destino_direccion}</Text>
            <Text style={styles.filaFecha}>{horaCorta(item.entregado_en)}</Text>
          </View>
          <Text style={styles.filaValor}>{item.costo_envio != null ? `$${item.costo_envio}` : '—'}</Text>
        </View>
      )}
      ListEmptyComponent={
        !cargando ? <Text style={styles.vacio}>No tienes entregas completadas en este período.</Text> : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colores.fondo,
  },
  contenido: {
    padding: 16,
  },
  atajos: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  atajo: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colores.tarjeta,
    borderWidth: 1,
    borderColor: colores.borde,
    alignItems: 'center',
  },
  atajoActivo: {
    backgroundColor: colores.primario,
    borderColor: colores.primario,
  },
  atajoTexto: {
    fontWeight: '600',
    fontSize: 13,
    color: colores.tenue,
  },
  atajoTextoActivo: {
    color: '#fff',
  },
  tarjetaGrande: {
    backgroundColor: colores.tarjeta,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 10,
    ...sombraTarjeta,
  },
  tarjetaGrandeNumero: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colores.texto,
  },
  tarjetaGrandeTexto: {
    fontSize: 13,
    color: colores.tenue,
    marginTop: 2,
  },
  filaTarjetas: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  tarjeta: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    ...sombraTarjeta,
  },
  tarjetaDebes: {
    backgroundColor: '#fff4e0',
  },
  tarjetaGanas: {
    backgroundColor: '#e6f6ec',
  },
  tarjetaNumero: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colores.texto,
  },
  tarjetaTexto: {
    fontSize: 12,
    color: colores.tenue,
    marginTop: 4,
    textAlign: 'center',
  },
  totalGenerado: {
    fontSize: 12,
    color: colores.tenue,
    textAlign: 'center',
    marginBottom: 10,
  },
  aviso: {
    fontSize: 12,
    color: '#7a4b00',
    backgroundColor: '#fff4e0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  seccion: {
    fontSize: 12,
    color: colores.suave,
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 6,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colores.tarjeta,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    ...sombraTarjeta,
  },
  filaInfo: {
    flex: 1,
    paddingRight: 10,
  },
  filaRecogida: {
    fontSize: 14,
    fontWeight: '600',
    color: colores.texto,
  },
  filaDestino: {
    fontSize: 12,
    color: colores.tenue,
    marginTop: 1,
  },
  filaFecha: {
    fontSize: 11,
    color: colores.suave,
    marginTop: 3,
  },
  filaValor: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colores.texto,
  },
  vacio: {
    textAlign: 'center',
    color: colores.suave,
    marginTop: 24,
  },
  error: {
    color: colores.peligro,
    textAlign: 'center',
    marginBottom: 10,
  },
});
