import { useState, useEffect } from 'react';
import { Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { colores } from '../constants/tema';

export default function EditarPerfilScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [datos, setDatos] = useState({
    first_name: '',
    last_name: '',
    telefono: '',
    vehiculo_modelo: '',
    vehiculo_color: '',
    vehiculo_placa: '',
  });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cambiar = (campo) => (texto) => setDatos((prev) => ({ ...prev, [campo]: texto }));

  useEffect(() => {
    api.get('/perfil/')
      .then(({ data }) =>
        setDatos({
          first_name: data.first_name,
          last_name: data.last_name,
          telefono: data.telefono,
          vehiculo_modelo: data.vehiculo_modelo,
          vehiculo_color: data.vehiculo_color,
          vehiculo_placa: data.vehiculo_placa,
        })
      )
      .catch(() => setError('No se pudieron cargar tus datos'))
      .finally(() => setCargando(false));
  }, []);

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      await api.patch('/perfil/', {
        first_name: datos.first_name.trim(),
        last_name: datos.last_name.trim(),
        telefono: datos.telefono.trim(),
        vehiculo_modelo: datos.vehiculo_modelo.trim(),
        vehiculo_color: datos.vehiculo_color.trim(),
        vehiculo_placa: datos.vehiculo_placa.trim(),
      });
      navigation.goBack();
    } catch (err) {
      const data = err.response?.data;
      setError(
        data?.telefono?.[0] ??
          data?.vehiculo_placa?.[0] ??
          data?.first_name?.[0] ??
          'No se pudieron guardar tus datos'
      );
      setGuardando(false);
    }
  };

  const puedeGuardar = datos.first_name.trim() && datos.telefono.trim() && !guardando && !cargando;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.contenido, { paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.seccion}>Datos personales</Text>
        <TextInput style={styles.input} value={datos.first_name} onChangeText={cambiar('first_name')} placeholder="Nombre" autoCapitalize="words" />
        <TextInput style={styles.input} value={datos.last_name} onChangeText={cambiar('last_name')} placeholder="Apellido" autoCapitalize="words" />
        <TextInput style={styles.input} value={datos.telefono} onChangeText={cambiar('telefono')} placeholder="Teléfono (ej. 0991234567)" keyboardType="phone-pad" />

        <Text style={styles.seccion}>Vehículo</Text>
        <TextInput style={styles.input} value={datos.vehiculo_modelo} onChangeText={cambiar('vehiculo_modelo')} placeholder="Marca y modelo (ej. Honda XR 150)" autoCapitalize="words" />
        <TextInput style={styles.input} value={datos.vehiculo_color} onChangeText={cambiar('vehiculo_color')} placeholder="Color" autoCapitalize="words" />
        <TextInput style={styles.input} value={datos.vehiculo_placa} onChangeText={cambiar('vehiculo_placa')} placeholder="Placa (ej. ABC-1234)" autoCapitalize="characters" autoCorrect={false} maxLength={10} />

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
    backgroundColor: colores.fondo,
  },
  contenido: {
    padding: 16,
  },
  seccion: {
    fontSize: 12,
    color: colores.suave,
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 8,
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
    backgroundColor: colores.primario,
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
