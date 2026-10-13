import { useState, useEffect } from 'react';
import { Text, View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { colores, radio } from '../constants/tema';
import { Boton, Campo, Icono, Titulo, estiloTarjeta } from '../components/ui';

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
  const [errores, setErrores] = useState({});

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
    setErrores({});
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
      // Cada error va junto a su campo; solo lo inesperado sale arriba del botón.
      const porCampo = {
        telefono: data?.telefono?.[0],
        vehiculo_placa: data?.vehiculo_placa?.[0],
        first_name: data?.first_name?.[0],
      };
      if (Object.values(porCampo).some(Boolean)) setErrores(porCampo);
      else setError('No se pudieron guardar tus datos');
      setGuardando(false);
    }
  };

  const puedeGuardar = Boolean(datos.first_name.trim() && datos.telefono.trim() && !guardando && !cargando);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.contenido, { paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.tarjeta}>
          <Titulo estilo={styles.seccion}>Datos personales</Titulo>
          <Campo
            etiqueta="Nombre"
            value={datos.first_name}
            onChangeText={cambiar('first_name')}
            placeholder="Ej. Carlos"
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
            error={errores.first_name}
          />
          <Campo
            etiqueta="Apellido"
            value={datos.last_name}
            onChangeText={cambiar('last_name')}
            placeholder="Ej. Mendoza"
            autoCapitalize="words"
            autoComplete="family-name"
            textContentType="familyName"
          />
          <Campo
            etiqueta="Teléfono"
            value={datos.telefono}
            onChangeText={cambiar('telefono')}
            placeholder="Ej. 0991234567"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            error={errores.telefono}
            estilo={styles.ultimo}
          />
        </View>

        <View style={styles.tarjeta}>
          <Titulo estilo={styles.seccion}>Vehículo</Titulo>
          <Campo
            etiqueta="Marca y modelo"
            value={datos.vehiculo_modelo}
            onChangeText={cambiar('vehiculo_modelo')}
            placeholder="Ej. Honda XR 150"
            autoCapitalize="words"
          />
          <Campo
            etiqueta="Color"
            value={datos.vehiculo_color}
            onChangeText={cambiar('vehiculo_color')}
            placeholder="Ej. Rojo"
            autoCapitalize="words"
          />
          <Campo
            etiqueta="Placa"
            value={datos.vehiculo_placa}
            onChangeText={cambiar('vehiculo_placa')}
            placeholder="Ej. ABC-1234"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={10}
            error={errores.vehiculo_placa}
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
          etiqueta="Guardar mi perfil"
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
  seccion: { fontSize: 14, color: colores.suave, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 },
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
