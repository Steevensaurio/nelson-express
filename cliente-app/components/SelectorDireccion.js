import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, StyleSheet, Modal } from 'react-native';
import api from '../services/api';
import SelectorMapa from './SelectorMapa';

const COLOR = '#007cab';

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

  return (
    <View>
      {direcciones.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[styles.card, coincide(item) && styles.cardSeleccionada]}
          onPress={() => elegirGuardada(item)}
        >
          <Text style={styles.etiqueta}>{item.etiqueta}</Text>
          <Text style={styles.texto}>{item.direccion}</Text>
          {item.referencia ? <Text style={styles.referencia}>{item.referencia}</Text> : null}
        </TouchableOpacity>
      ))}

      {valorPersonalizado ? (
        <TouchableOpacity style={[styles.card, styles.cardSeleccionada]} onPress={abrirNueva}>
          <Text style={styles.etiqueta}>Otra ubicación</Text>
          <Text style={styles.texto}>{valor.direccion || 'Sin dirección'}</Text>
          {valor.referencia ? <Text style={styles.referencia}>{valor.referencia}</Text> : null}
        </TouchableOpacity>
      ) : null}

      {abierto ? (
        <View style={styles.formulario}>
          <TouchableOpacity style={styles.mapaBoton} onPress={() => setMostrarMapa(true)}>
            <Text style={styles.mapaBotonTexto}>
              {lat && lng
                ? `📍 Ubicación elegida (${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)})`
                : '📍 Elegir ubicación en el mapa'}
            </Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.input, direccionBloqueada && styles.inputBloqueado]}
            value={direccion}
            onChangeText={setDireccion}
            editable={!direccionBloqueada}
            placeholder="Dirección (se completa al elegir en el mapa)"
          />
          <TextInput
            style={styles.input}
            value={referencia}
            onChangeText={setReferencia}
            maxLength={255}
            placeholder="Referencia (ej. casa de dos pisos, al lado de la tienda azul)"
          />
          <View style={styles.filaSwitch}>
            <Text style={styles.switchTexto}>Guardar esta dirección para la próxima vez</Text>
            <Switch value={guardarNueva} onValueChange={setGuardarNueva} trackColor={{ true: COLOR }} />
          </View>
          {guardarNueva ? (
            <TextInput style={styles.input} value={etiqueta} onChangeText={setEtiqueta} placeholder="Etiqueta (ej. Casa, Trabajo)" />
          ) : null}
          <TouchableOpacity
            style={[styles.confirmarBoton, !(lat && lng && direccion.trim()) && styles.botonDeshabilitado]}
            disabled={!(lat && lng && direccion.trim()) || guardando}
            onPress={confirmarNueva}
          >
            <Text style={styles.confirmarTexto}>{guardando ? 'Guardando...' : 'Usar esta ubicación'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAbierto(false)}>
            <Text style={styles.cancelarTexto}>Cancelar</Text>
          </TouchableOpacity>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : (
        <TouchableOpacity onPress={abrirNueva}>
          <Text style={styles.agregarTexto}>+ Otra ubicación</Text>
        </TouchableOpacity>
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSeleccionada: { borderColor: COLOR },
  etiqueta: { fontSize: 15, fontWeight: 'bold' },
  texto: { fontSize: 13, color: '#666' },
  referencia: { fontSize: 12, color: '#999', fontStyle: 'italic', marginTop: 2 },
  agregarTexto: { color: COLOR, fontWeight: 'bold', marginVertical: 10 },
  formulario: { marginTop: 4, marginBottom: 10 },
  input: {
    backgroundColor: '#fff',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  inputBloqueado: { backgroundColor: '#eee', color: '#666' },
  mapaBoton: {
    backgroundColor: '#fff',
    borderColor: COLOR,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  mapaBotonTexto: { color: COLOR, fontWeight: 'bold', textAlign: 'center' },
  filaSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  switchTexto: { flex: 1, fontSize: 14, paddingRight: 8 },
  confirmarBoton: {
    backgroundColor: COLOR,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  botonDeshabilitado: { backgroundColor: '#aaa' },
  confirmarTexto: { color: '#fff', fontWeight: 'bold' },
  cancelarTexto: { textAlign: 'center', color: '#999', marginTop: 10 },
  error: { color: 'red', textAlign: 'center', marginTop: 10 },
});
