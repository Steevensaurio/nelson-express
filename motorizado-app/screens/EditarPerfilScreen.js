import { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { guardar as guardarEnCache } from '../services/cache';
import { pedir } from '../services/consultas';
import { useCargaRapida } from '../hooks/useCargaRapida';
import { MAX_EDAD_MS } from '../services/cargaRapida';
import { colores, tipo, espacio } from '../constants/tema';
import { normalizarTelefono, MENSAJE_TELEFONO } from '../services/telefono';
import { Aviso, Boton, Campo, Titulo, estiloTarjeta } from '../components/ui';

const pedirPerfil = pedir('/perfil/');

const CAMPOS = ['first_name', 'last_name', 'telefono', 'vehiculo_modelo', 'vehiculo_color', 'vehiculo_placa'];
const desdePerfil = (perfil) => Object.fromEntries(CAMPOS.map((c) => [c, perfil?.[c] ?? '']));

export default function EditarPerfilScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  // Mismo perfil (y misma clave) que la pestaña Perfil: si ya está en caché el formulario sale lleno al instante.
  const { datos: perfil, cargando, error: errorCarga } = useCargaRapida('perfil', pedirPerfil, { maxEdad: MAX_EDAD_MS });
  const [datos, setDatos] = useState(() => desdePerfil(perfil));
  const rellenado = useRef(Boolean(perfil));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [errores, setErrores] = useState({});

  const telefonoRef = useRef(null);

  const validarTelefono = (texto) => setErrores((prev) => ({
    ...prev, telefono: texto.trim() && !normalizarTelefono(texto) ? MENSAJE_TELEFONO : undefined,
  }));
  const cambiar = (campo) => (texto) => {
    setDatos((prev) => ({ ...prev, [campo]: texto }));
    if (campo === 'telefono' && errores.telefono) validarTelefono(texto); // ya mostró el error: se corrige en vivo
  };

  // Si el perfil llega después de abrir la pantalla, se rellena una sola vez (nunca pisa lo que se está escribiendo).
  useEffect(() => {
    if (!perfil || rellenado.current) return;
    rellenado.current = true;
    setDatos(desdePerfil(perfil));
  }, [perfil]);

  const guardar = async () => {
    const telefonoNormalizado = normalizarTelefono(datos.telefono);
    if (!telefonoNormalizado) {
      setErrores({ telefono: MENSAJE_TELEFONO });
      telefonoRef.current?.focus();
      return;
    }
    setGuardando(true);
    setError('');
    setErrores({});
    try {
      const response = await api.patch('/perfil/', {
        first_name: datos.first_name.trim(),
        last_name: datos.last_name.trim(),
        telefono: telefonoNormalizado,
        vehiculo_modelo: datos.vehiculo_modelo.trim(),
        vehiculo_color: datos.vehiculo_color.trim(),
        vehiculo_placa: datos.vehiculo_placa.trim(),
      });
      guardarEnCache('perfil', response.data); // Perfil y Mis entregas muestran lo nuevo al volver
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
        contentContainerStyle={[styles.contenido, { paddingBottom: espacio.xl + insets.bottom }]}
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
            ref={telefonoRef}
            value={datos.telefono}
            onChangeText={cambiar('telefono')}
            onBlur={() => validarTelefono(datos.telefono)}
            placeholder="0991234567"
            maxLength={16}
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

        {error || (errorCarga && !perfil) ? <Aviso tipo="error">{error || 'No pudimos cargar tus datos. Revisa tu conexión.'}</Aviso> : null}

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
  contenido: { padding: espacio.l, gap: 14 },
  tarjeta: { ...estiloTarjeta },
  seccion: { fontSize: tipo.seccion.fontSize, marginBottom: espacio.m },
  ultimo: { marginBottom: 0 },
});
