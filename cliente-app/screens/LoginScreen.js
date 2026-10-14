import { useRef, useState } from 'react';
import {
  StyleSheet, View, Image, Pressable, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import api from '../services/api';
import { colores, fuente, radio, sombraTarjeta } from '../constants/tema';
import { Aviso, Boton, Campo, Icono, Rayas, Text, Titulo } from '../components/ui';

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
      // Cualquier cuenta puede pedir comida, incluida la de un motorizado en su día libre o la del
      // despachador: esta app no filtra por rol, a diferencia de la del motorizado y el panel.
      const { access, refresh } = (await api.post('/token/', {
        username: username.trim(),
        password,
      })).data;
      onLoginSuccess(access, refresh);
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
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.cabecera, { paddingTop: 24 + insets.top }]}>
          <Rayas estilo={styles.rayas} />
          <View style={styles.logoMarco}>
            <Image
              source={require('../assets/logo-circular.png')}
              style={styles.logo}
              accessibilityLabel="Nelson Express"
            />
          </View>
          <Text accessibilityRole="header" style={styles.titular}>
            {'Tu comida\na tu puerta'}
          </Text>
        </View>

        <View style={styles.cuerpo}>
          <View style={styles.tarjeta}>
            <Titulo estilo={styles.tarjetaTitulo}>Inicia sesión</Titulo>

            <Campo
              etiqueta="Usuario"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => claveRef.current?.focus()}
              blurOnSubmit={false}
              izquierda={<Icono nombre="person-outline" tamano={20} color={colores.suave} />}
            />

            <Campo
              ref={claveRef}
              etiqueta="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!verClave}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={puedeEntrar ? handleLogin : undefined}
              izquierda={<Icono nombre="lock-closed-outline" tamano={20} color={colores.suave} />}
              derecha={
                <Pressable
                  onPress={() => setVerClave((v) => !v)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={styles.ojo}
                >
                  <Icono nombre={verClave ? 'eye-off-outline' : 'eye-outline'} tamano={22} color={colores.tenue} />
                </Pressable>
              }
            />

            {error ? <Aviso tipo="error" estilo={styles.aviso}>{error}</Aviso> : null}

            <Boton
              titulo={entrando ? 'Ingresando…' : 'Ingresar'}
              etiqueta="Ingresar"
              icono={entrando ? undefined : 'log-in-outline'}
              onPress={handleLogin}
              deshabilitado={!puedeEntrar && !entrando}
              cargando={entrando}
              estilo={styles.boton}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colores.fondo },
  cabecera: {
    backgroundColor: colores.primario,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 76,
    overflow: 'hidden',
  },
  rayas: { right: -4 },
  logoMarco: {
    alignSelf: 'flex-start',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  logo: { width: 86, height: 86, resizeMode: 'contain' },
  titular: {
    marginTop: 18,
    fontFamily: fuente.extra,
    fontSize: 34,
    lineHeight: 40,
    color: '#fff',
  },

  cuerpo: { marginTop: -52, paddingHorizontal: 20 },
  tarjeta: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: colores.tarjeta,
    borderRadius: radio.grande + 4,
    padding: 22,
    ...sombraTarjeta,
    shadowOpacity: 0.14,
    elevation: 6,
  },
  tarjetaTitulo: { fontSize: 22, marginBottom: 16 },
  ojo: { padding: 4 },
  aviso: { marginBottom: 14 },
  boton: { marginTop: 4 },
});
