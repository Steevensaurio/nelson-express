import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';
import SelectorMapa from '../components/SelectorMapa';

export default function MisDireccionesScreen() {
  const [direcciones, setDirecciones] = useState([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [etiqueta, setEtiqueta] = useState('');
  const [direccion, setDireccion] = useState('');
  const [direccionBloqueada, setDireccionBloqueada] = useState(false);
  const [referencia, setReferencia] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/direcciones/').then(response => {
      setDirecciones(response.data);
    });
  }, []);

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

  const empezarEdicion = (item) => {
    setEditandoId(item.id);
    setEtiqueta(item.etiqueta);
    setDireccion(item.direccion);
    setDireccionBloqueada(Boolean(item.direccion));
    setReferencia(item.referencia ?? '');
    setLat(item.lat.toString());
    setLng(item.lng.toString());
    setMostrarFormulario(true);
  };

  const cancelar = () => {
    setMostrarFormulario(false);
    setEditandoId(null);
    setEtiqueta('');
    setDireccion('');
    setDireccionBloqueada(false);
    setReferencia('');
    setLat('');
    setLng('');
  };

  const guardar = async () => {
    try {
      if (editandoId) {
        const response = await api.patch(`/direcciones/${editandoId}/`, { etiqueta, direccion, referencia, lat, lng });
        setDirecciones(prev => prev.map(d => d.id === editandoId ? response.data : d));
      } else {
        const response = await api.post('/direcciones/', { etiqueta, direccion, referencia, lat, lng });
        setDirecciones(prev => [...prev, response.data]);
      }
      cancelar();
    } catch (err) {
      console.log('Error al guardar direccion:', JSON.stringify(err.response?.data));
      setError('No se pudo guardar la dirección');
    }
  };

  const eliminar = async () => {
    await api.delete(`/direcciones/${editandoId}/`);
    setDirecciones(prev => prev.filter(d => d.id !== editandoId));
    cancelar();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <FlatList
        data={direcciones}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => empezarEdicion(item)}>
            <Text style={styles.etiqueta}>{item.etiqueta}</Text>
            <Text style={styles.direccion}>{item.direccion}</Text>
            {item.referencia ? <Text style={styles.referencia}>{item.referencia}</Text> : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.vacio}>Todavía no tienes direcciones guardadas</Text>}
      />

      {mostrarFormulario ? (
        <View style={styles.formulario}>
          <TextInput style={styles.input} value={etiqueta} onChangeText={setEtiqueta} placeholder="Etiqueta (ej. Casa)" />

          <TouchableOpacity style={styles.mapaBoton} onPress={() => setMostrarMapa(true)}>
            <Text style={styles.mapaBotonTexto}>
              {lat && lng ? `📍 Ubicación elegida (${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)})` : '📍 Elegir ubicación en el mapa'}
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

          <TouchableOpacity
            style={[styles.guardarBoton, !(lat && lng) && styles.guardarBotonDeshabilitado]}
            disabled={!(lat && lng)}
            onPress={guardar}
          >
            <Text style={styles.guardarTexto}>{editandoId ? 'Guardar cambios' : 'Guardar dirección'}</Text>
          </TouchableOpacity>
          {editandoId && (
            <TouchableOpacity style={styles.eliminarBoton} onPress={eliminar}>
              <Text style={styles.eliminarTexto}>Eliminar dirección</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={cancelar}>
            <Text style={styles.cancelarTexto}>Cancelar</Text>
          </TouchableOpacity>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : (
        <TouchableOpacity style={styles.agregarBoton} onPress={() => setMostrarFormulario(true)}>
          <Text style={styles.agregarTexto}>+ Agregar nueva dirección</Text>
        </TouchableOpacity>
      )}

      <Modal visible={mostrarMapa} animationType="slide" onRequestClose={() => setMostrarMapa(false)}>
        <SelectorMapa
          onConfirmar={seleccionarUbicacion}
          onCancelar={() => setMostrarMapa(false)}
          coordenadaInicial={lat && lng ? { latitude: parseFloat(lat), longitude: parseFloat(lng) } : null}
        />
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  etiqueta: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  direccion: {
    fontSize: 13,
    color: '#666',
  },
  referencia: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  inputBloqueado: {
    backgroundColor: '#eee',
    color: '#666',
  },
  vacio: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
  },
  formulario: {
    marginTop: 10,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  mapaBoton: {
    backgroundColor: '#fff',
    borderColor: '#007cab',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  mapaBotonTexto: {
    color: '#007cab',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  guardarBoton: {
    backgroundColor: '#007cab',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  guardarBotonDeshabilitado: {
    backgroundColor: '#aaa',
  },
  guardarTexto: {
    color: '#fff',
    fontWeight: 'bold',
  },
  eliminarBoton: {
    backgroundColor: '#c0392b',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  eliminarTexto: {
    color: '#fff',
    fontWeight: 'bold',
  },
  cancelarTexto: {
    textAlign: 'center',
    color: '#999',
    marginTop: 10,
  },
  agregarBoton: {
    padding: 12,
    alignItems: 'center',
  },
  agregarTexto: {
    color: '#007cab',
    fontWeight: 'bold',
  },
  error: {
    color: 'red',
    textAlign: 'center',
    marginTop: 10,
  },
});
