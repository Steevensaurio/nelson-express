import { useState } from 'react';
import { View, Text, Pressable, Switch, StyleSheet, Modal } from 'react-native';
import api from '../services/api';
import SelectorMapa from './SelectorMapa';
import { colores } from '../constants/tema';
import { Boton, Campo, Icono, estiloTarjeta } from './ui';

// Una dirección elegible. Es una opción de un grupo (radio): lo seleccionado se ve por el ícono y el
// borde, y se anuncia como "seleccionado" a los lectores de pantalla.
function Opcion({ etiqueta, direccion, referencia, seleccionada, onPress }) {
  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={seleccionada}
      accessibilityLabel={`${etiqueta}. ${direccion || 'Sin dirección'}${referencia ? `. ${referencia}` : ''}`}
      onPress={onPress}
      android_ripple={{ color: 'rgba(0,124,171,0.12)' }}
      style={({ pressed }) => [styles.card, seleccionada && styles.cardSeleccionada, pressed && styles.cardPresionada]}
    >
      <Icono
        nombre={seleccionada ? 'radio-button-on' : 'radio-button-off'}
        tamano={24}
        color={seleccionada ? colores.primario : colores.bordeCampo}
      />
      <View style={styles.cardCuerpo}>
        <Text style={styles.etiqueta}>{etiqueta}</Text>
        <Text style={styles.texto}>{direccion || 'Sin dirección'}</Text>
        {referencia ? <Text style={styles.referencia}>{referencia}</Text> : null}
      </View>
    </Pressable>
  );
}

// Elige una dirección guardada o marca un punto nuevo en el mapa (con la opción de guardarlo para la
// próxima vez). Se usa igual para el origen y el destino de un encargo, y para el destino de un pedido
// de comida: ninguno de los tres es siempre una dirección ya guardada del cliente.
//
// `valor` es { direccion, referencia, lat, lng } | null. `onNuevaDireccion` avisa al padre cuando se
// guardó una dirección nueva, para que la agregue a su lista sin tener que recargarla del servidor.
export default function SelectorDireccion({ direcciones, valor, onCambiar, onNuevaDireccion }) {
  const [abierto, setAbierto] = useState(false);
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const [etiqueta, setEtiqueta] = useState('');
  const [direccion, setDireccion] = useState('');
  const [direccionBloqueada, setDireccionBloqueada] = useState(false);
  const [referencia, setReferencia] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [guardarNueva, setGuardarNueva] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const coincide = (item) => valor && String(item.lat) === String(valor.lat) && String(item.lng) === String(valor.lng);
  const valorPersonalizado = valor && !direcciones.some(coincide);

  const elegirGuardada = (item) => {
    onCambiar({ direccion: item.direccion, referencia: item.referencia ?? '', lat: item.lat, lng: item.lng });
    setAbierto(false);
  };

  const abrirNueva = () => {
    setEtiqueta('');
    setDireccion(valorPersonalizado ? valor.direccion : '');
    setReferencia(valorPersonalizado ? valor.referencia : '');
    setDireccionBloqueada(false);
    setLat(valorPersonalizado ? String(valor.lat) : '');
    setLng(valorPersonalizado ? String(valor.lng) : '');
    setGuardarNueva(false);
    setError('');
    setAbierto(true);
  };

  const seleccionarUbicacion = (nuevaLat, nuevaLng, direccionSugerida) => {
    setLat(nuevaLat.toString());
    setLng(nuevaLng.toString());
    if (direccionSugerida) {
      setDireccion(direccionSugerida);
      setDireccionBloqueada(true);
    } else {
      if (direccionBloqueada) setDireccion('');
      setDireccionBloqueada(false);
    }
    setMostrarMapa(false);
  };

  const confirmarNueva = async () => {
    const valorNuevo = { direccion: direccion.trim(), referencia: referencia.trim(), lat: parseFloat(lat), lng: parseFloat(lng) };
    if (!guardarNueva) {
      onCambiar(valorNuevo);
      setAbierto(false);
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const { data } = await api.post('/direcciones/', { etiqueta: etiqueta.trim() || 'Otra', ...valorNuevo });
      onNuevaDireccion(data);
      onCambiar({ direccion: data.direccion, referencia: data.referencia ?? '', lat: data.lat, lng: data.lng });
      setAbierto(false);
    } catch (err) {
      setError('No se pudo guardar la dirección');
    } finally {
      setGuardando(false);
    }
  };

  const listoParaUsar = Boolean(lat && lng && direccion.trim());

  return (
    <View>
      <View accessibilityRole="radiogroup" style={styles.grupo}>
        {direcciones.map((item) => (
          <Opcion
            key={item.id}
            etiqueta={item.etiqueta}
            direccion={item.direccion}
            referencia={item.referencia}
            seleccionada={Boolean(coincide(item))}
            onPress={() => elegirGuardada(item)}
          />
        ))}

        {valorPersonalizado ? (
          <Opcion
            etiqueta="Otra ubicación"
            direccion={valor.direccion}
            referencia={valor.referencia}
            seleccionada
            onPress={abrirNueva}
          />
        ) : null}
      </View>

      {abierto ? (
        <View style={styles.formulario}>
          <Boton
            titulo={lat && lng ? `Ubicación elegida (${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)})` : 'Elegir ubicación en el mapa'}
            variante="secundario"
            icono={lat && lng ? 'location' : 'map-outline'}
            onPress={() => setMostrarMapa(true)}
            estilo={styles.botonMapa}
          />
          <Campo
            etiqueta="Dirección"
            value={direccion}
            onChangeText={setDireccion}
            bloqueado={direccionBloqueada}
            placeholder="Se completa al elegir en el mapa"
            ayuda={direccionBloqueada ? 'Tomada del mapa. Vuelve a elegir el punto para cambiarla.' : undefined}
          />
          <Campo
            etiqueta="Referencia"
            value={referencia}
            onChangeText={setReferencia}
            maxLength={255}
            placeholder="Ej. casa de dos pisos, portón verde"
          />
          <View style={styles.filaSwitch}>
            <Text style={styles.switchTexto}>Guardar esta dirección para la próxima vez</Text>
            <Switch
              value={guardarNueva}
              onValueChange={setGuardarNueva}
              trackColor={{ false: '#c4cbd0', true: colores.primario }}
              thumbColor="#fff"
              accessibilityLabel="Guardar esta dirección para la próxima vez"
            />
          </View>
          {guardarNueva ? (
            <Campo etiqueta="Etiqueta" value={etiqueta} onChangeText={setEtiqueta} placeholder="Ej. Casa, Trabajo" />
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>
          ) : null}
          <Boton
            titulo={guardando ? 'Guardando…' : 'Usar esta ubicación'}
            icono="checkmark"
            onPress={confirmarNueva}
            deshabilitado={!listoParaUsar && !guardando}
            cargando={guardando}
          />
          <Boton titulo="Cancelar" variante="fantasma" onPress={() => setAbierto(false)} estilo={styles.cancelar} />
        </View>
      ) : (
        <Boton
          titulo="Otra ubicación"
          icono="add-circle-outline"
          variante="secundario"
          onPress={abrirNueva}
          estilo={styles.otra}
        />
      )}

      <Modal visible={mostrarMapa} animationType="slide" onRequestClose={() => setMostrarMapa(false)}>
        <SelectorMapa
          onConfirmar={seleccionarUbicacion}
          onCancelar={() => setMostrarMapa(false)}
          coordenadaInicial={lat && lng ? { latitude: parseFloat(lat), longitude: parseFloat(lng) } : null}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: { gap: 10 },
  card: {
    ...estiloTarjeta,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSeleccionada: { borderColor: colores.primario, backgroundColor: '#f4fbfe' },
  cardPresionada: { opacity: 0.9 },
  cardCuerpo: { flex: 1 },
  etiqueta: { fontSize: 16, fontWeight: '800', color: colores.texto },
  texto: { fontSize: 14, color: colores.tenue, marginTop: 2 },
  referencia: { fontSize: 13, color: colores.tenue, fontStyle: 'italic', marginTop: 3 },
  otra: { marginTop: 10 },
  formulario: { ...estiloTarjeta, marginTop: 12 },
  botonMapa: { marginBottom: 14 },
  filaSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 52,
    marginBottom: 12,
  },
  switchTexto: { flex: 1, fontSize: 15, color: colores.texto },
  cancelar: { marginTop: 8 },
  error: { color: colores.peligro, fontWeight: '600', fontSize: 14, marginBottom: 10, textAlign: 'center' },
});
