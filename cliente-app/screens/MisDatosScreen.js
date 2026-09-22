import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';

export default function MisDatosScreen({ navigation }) {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/perfil/')
      .then(response => {
        setNombre(response.data.first_name);
        setApellido(response.data.last_name);
        setTelefono(response.data.telefono);
      })
      .catch(() => setError('No se pudieron cargar tus datos'))
      .finally(() => setCargando(false));
  }, []);

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      await api.patch('/perfil/', {
        first_name: nombre.trim(),
        last_name: apellido.trim(),
        telefono: telefono.trim(),
      });
      navigation.goBack();
    } catch (err) {
      const data = err.response?.data;
      setError(data?.telefono?.[0] ?? data?.first_name?.[0] ?? 'No se pudieron guardar tus datos');
      setGuardando(false);
    }
  };

  const puedeGuardar = nombre.trim() && telefono.trim() && !guardando && !cargando;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <Text style={styles.ayuda}>
          El motorizado verá tu nombre y teléfono para poder contactarte al entregar tu pedido.
        </Text>

        <TextInput
          style={styles.input}
          value={nombre}
          onChangeText={setNombre}
          placeholder="Nombre"
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          value={apellido}
          onChangeText={setApellido}
          placeholder="Apellido"
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          value={telefono}
          onChangeText={setTelefono}
          placeholder="Teléfono (ej. 0991234567)"
          keyboardType="phone-pad"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.boton, !puedeGuardar && styles.botonDeshabilitado]}
          disabled={!puedeGuardar}
          onPress={guardar}
        >
          <Text style={styles.botonTexto}>{guardando ? 'Guardando...' : 'Guardar'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
  },
  contenido: {
    padding: 16,
  },
  ayuda: {
    color: '#666',
    fontSize: 13,
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  boton: {
    backgroundColor: '#007cab',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  botonDeshabilitado: {
    backgroundColor: '#aaa',
  },
  botonTexto: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  error: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 8,
  },
});
