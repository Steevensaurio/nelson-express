import { useRef, useState } from 'react';
import {
  StyleSheet, View, Image, TextInput, TouchableOpacity, Text, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';

const COLOR_PRIMARIO = '#007cab';

export default function LoginScreen({ onLoginSuccess }) {
  const insets = useSafeAreaInsets();
  const claveRef = useRef(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setEntrando(true);
    setError('');
    try {
      const response = await api.post('/token/', {
        username: username.trim(),
        password,
      });
      onLoginSuccess(response.data.access);
    } catch (err) {
      setError(
        err.response
          ? 'Usuario o contraseña incorrectos'
          : 'No se pudo conectar con el servidor. Revisa tu conexión.'
      );
      setEntrando(false);
    }
  };

  const puedeEntrar = Boolean(username.trim() && password && !entrando);

  return (
    // El ScrollView permite desplazarse cuando el teclado tapa los campos; el KeyboardAvoidingView
    // sube el contenido para que el campo que se escribe quede a la vista.
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.contenido,
          { paddingTop: 24 + insets.top, paddingBottom: 24 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={styles.encabezado}>
          <Image source={require('../assets/logo-circular.png')} style={styles.logo} />
          <Text style={styles.subtitulo}>Tu comida favorita, en la puerta de tu casa</Text>
        </View>

        <View style={styles.tarjeta}>
          <Text style={styles.tarjetaTitulo}>Inicia sesión</Text>

          <View style={styles.campo}>
            <Ionicons name="person-outline" size={20} color="#999" />
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Usuario"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => claveRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          <View style={styles.campo}>
            <Ionicons name="lock-closed-outline" size={20} color="#999" />
            <TextInput
              ref={claveRef}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Contraseña"
              secureTextEntry={!verClave}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={puedeEntrar ? handleLogin : undefined}
            />
            <TouchableOpacity
              onPress={() => setVerClave((v) => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              <Ionicons name={verClave ? 'eye-off-outline' : 'eye-outline'} size={20} color="#999" />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorCaja}>
              <Ionicons name="alert-circle-outline" size={18} color="#c0392b" />
              <Text style={styles.errorTexto}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.boton, !puedeEntrar && styles.botonDeshabilitado]}
            disabled={!puedeEntrar}
            onPress={handleLogin}
          >
            <Text style={styles.botonTexto}>{entrando ? 'Ingresando...' : 'Ingresar'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#f2f2f2',
  },
  contenido: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  encabezado: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 170,
    height: 170,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  subtitulo: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  tarjeta: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  tarjetaTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1b1b1b',
  },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f7f7f7',
    borderColor: '#e3e3e3',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  errorCaja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  errorTexto: {
    flex: 1,
    color: '#c0392b',
    fontSize: 13,
  },
  boton: {
    backgroundColor: COLOR_PRIMARIO,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  botonDeshabilitado: {
    backgroundColor: '#aaa',
  },
  botonTexto: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
