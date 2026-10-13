import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';
import { colores } from '../constants/tema';
import { Aviso, Boton, Campo, estiloTarjeta } from '../components/ui';

export default function MisDatosScreen({ navigation }) {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [errorTelefono, setErrorTelefono] = useState('');

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
    setErrorTelefono('');
    try {
      await api.patch('/perfil/', {
        first_name: nombre.trim(),
        last_name: apellido.trim(),
        telefono: telefono.trim(),
      });
      navigation.goBack();
    } catch (err) {
      const data = err.response?.data;
      // El error del teléfono va junto a su campo; el resto, arriba del botón.
      if (data?.telefono?.[0]) setErrorTelefono(data.telefono[0]);
      else setError(data?.first_name?.[0] ?? 'No se pudieron guardar tus datos');
      setGuardando(false);
    }
  };

  const puedeGuardar = Boolean(nombre.trim() && telefono.trim() && !guardando && !cargando);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <Aviso>El motorizado verá tu nombre y teléfono para poder contactarte al entregar tu pedido.</Aviso>

        <View style={styles.tarjeta}>
          <Campo
            etiqueta="Nombre"
            value={nombre}
            onChangeText={setNombre}
            placeholder="Ej. María"
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
          />
          <Campo
            etiqueta="Apellido"
            value={apellido}
            onChangeText={setApellido}
            placeholder="Ej. Pérez"
            autoCapitalize="words"
            autoComplete="family-name"
            textContentType="familyName"
          />
          <Campo
            etiqueta="Teléfono"
            value={telefono}
            onChangeText={setTelefono}
            placeholder="Ej. 0991234567"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            error={errorTelefono}
            estilo={styles.ultimo}
          />
        </View>

        {error ? (
          <Aviso tipo="error">{error}</Aviso>
        ) : null}

        <Boton
          titulo={guardando ? 'Guardando…' : 'Guardar'}
          etiqueta="Guardar mis datos"
          icono="checkmark"
          onPress={guardar}
          deshabilitado={!puedeGuardar && !guardando}
          cargando={guardando}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 16, gap: 14 },
  tarjeta: { ...estiloTarjeta },
  ultimo: { marginBottom: 0 },
});
