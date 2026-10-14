import { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';
import { guardar as guardarEnCache } from '../services/cache';
import { pedir } from '../services/consultas';
import { useCargaRapida } from '../hooks/useCargaRapida';
import { MAX_EDAD_MS } from '../services/cargaRapida';
import { colores, espacio } from '../constants/tema';
import { normalizarTelefono, MENSAJE_TELEFONO } from '../services/telefono';
import { Aviso, Boton, Campo, estiloTarjeta } from '../components/ui';

const pedirPerfil = pedir('/perfil/');

export default function MisDatosScreen({ navigation }) {
  // Mismo perfil (y misma clave) que Negocios y Perfil: si ya está en caché el formulario sale lleno al instante.
  const { datos: perfil, cargando, error: errorCarga } = useCargaRapida('perfil', pedirPerfil, { maxEdad: MAX_EDAD_MS });
  const [nombre, setNombre] = useState(perfil?.first_name ?? '');
  const [apellido, setApellido] = useState(perfil?.last_name ?? '');
  const [telefono, setTelefono] = useState(perfil?.telefono ?? '');
  const rellenado = useRef(Boolean(perfil));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [errorTelefono, setErrorTelefono] = useState('');
  const telefonoRef = useRef(null);

  const validarTelefono = (texto) => setErrorTelefono(texto.trim() && !normalizarTelefono(texto) ? MENSAJE_TELEFONO : '');
  const cambiarTelefono = (texto) => {
    setTelefono(texto);
    if (errorTelefono) validarTelefono(texto); // ya mostró el error: se corrige en vivo
  };

  // Si el perfil llega después de abrir la pantalla, se rellena una sola vez (nunca pisa lo que se está escribiendo).
  useEffect(() => {
    if (!perfil || rellenado.current) return;
    rellenado.current = true;
    setNombre(perfil.first_name);
    setApellido(perfil.last_name);
    setTelefono(perfil.telefono);
  }, [perfil]);

  const guardar = async () => {
    const telefonoNormalizado = normalizarTelefono(telefono);
    if (!telefonoNormalizado) {
      setErrorTelefono(MENSAJE_TELEFONO);
      telefonoRef.current?.focus();
      return;
    }
    setGuardando(true);
    setError('');
    setErrorTelefono('');
    try {
      const response = await api.patch('/perfil/', {
        first_name: nombre.trim(),
        last_name: apellido.trim(),
        telefono: telefonoNormalizado,
      });
      guardarEnCache('perfil', response.data); // Perfil y Negocios muestran lo nuevo al volver, sin otra petición
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
            ref={telefonoRef}
            value={telefono}
            onChangeText={cambiarTelefono}
            onBlur={() => validarTelefono(telefono)}
            placeholder="0991234567"
            maxLength={16}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            error={errorTelefono}
            estilo={styles.ultimo}
          />
        </View>

        {error || (errorCarga && !perfil) ? (
          <Aviso tipo="error">{error || 'No pudimos cargar tus datos. Revisa tu conexión.'}</Aviso>
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
  contenido: { padding: espacio.l, gap: 14 },
  tarjeta: { ...estiloTarjeta },
  ultimo: { marginBottom: 0 },
});
