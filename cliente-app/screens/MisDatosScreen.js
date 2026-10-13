import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';
import { colores, radio } from '../constants/tema';
import { Boton, Campo, Icono } from '../components/ui';

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
        <View style={styles.nota}>
          <Icono nombre="information-circle-outline" tamano={20} color={colores.primarioOscuro} />
          <Text style={styles.notaTexto}>
            El motorizado verá tu nombre y teléfono para poder contactarte al entregar tu pedido.
          </Text>
        </View>

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
          <View style={styles.errorCaja} accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Icono nombre="alert-circle" tamano={20} color={colores.peligro} />
            <Text style={styles.errorTexto}>{error}</Text>
          </View>
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
  nota: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colores.acentoSuave,
    borderRadius: radio.medio,
    padding: 14,
  },
  notaTexto: { flex: 1, fontSize: 14, color: colores.texto, lineHeight: 20 },
  tarjeta: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.grande,
    padding: 16,
    elevation: 2,
    shadowColor: '#0b2530',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  ultimo: { marginBottom: 0 },
  errorCaja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colores.peligroSuave,
    borderRadius: radio.chico,
    padding: 12,
  },
  errorTexto: { flex: 1, color: colores.peligro, fontSize: 14, fontWeight: '600' },
});
