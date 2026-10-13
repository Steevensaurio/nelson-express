import { useRef, useState } from 'react';
import {
  StyleSheet, View, Image, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import api from '../services/api';
import { colores, radio, sombraTarjeta } from '../constants/tema';
import { Boton, Campo, Icono, Titulo } from '../components/ui';

const VENTAJAS = [
  { icono: 'bicycle', texto: 'Tus entregas' },
  { icono: 'wallet-outline', texto: 'Tus cuentas' },
  { icono: 'navigate-outline', texto: 'Rutas' },
];

export default function LoginScreen({ onLoginSuccess }) {
  const insets = useSafeAreaInsets();
  const claveRef = useRef(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);

  const handleLogin = async () => {
    setEntrando(true);
    setError('');
    try {
      const { access } = (await api.post('/token/', { username: username.trim(), password })).data;
      // El usuario y la contraseña son válidos, pero hace falta la capacidad de motorizado activada
      // (un cliente sin activar, o un despachador sin activar, no deben poder entrar aquí).
      const { es_motorizado } = (await api.get('/perfil/', { headers: { Authorization: `Bearer ${access}` } })).data;
      if (!es_motorizado) {
        setError('Esta cuenta no tiene acceso a la app de motorizados.');
        setEntrando(false);
        return;
      }
      onLoginSuccess(access);
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
        <View style={[styles.cabecera, { paddingTop: 28 + insets.top }]}>
          <View style={styles.circuloGrande} pointerEvents="none" aria-hidden />
          <View style={styles.circuloChico} pointerEvents="none" aria-hidden />

          <View style={styles.logoMarco}>
            <Image
              source={require('../assets/logo-circular.png')}
              style={styles.logo}
              accessibilityLabel="Nelson Express"
            />
          </View>
          <Text accessibilityRole="header" style={styles.bienvenida}>¡Hola, motorizado!</Text>
          <View style={styles.etiquetaRol}>
            <Icono nombre="bicycle" tamano={16} color="#fff" />
            <Text style={styles.etiquetaRolTexto}>Acceso para motorizados</Text>
          </View>
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

            {error ? (
              <View style={styles.errorCaja} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Icono nombre="alert-circle" tamano={20} color={colores.peligro} />
                <Text style={styles.errorTexto}>{error}</Text>
              </View>
            ) : null}

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

          <View style={styles.ventajas}>
            {VENTAJAS.map((v) => (
              <View key={v.texto} style={styles.ventaja}>
                <View style={styles.ventajaIcono}>
                  <Icono nombre={v.icono} tamano={20} color={colores.primarioOscuro} />
                </View>
                <Text style={styles.ventajaTexto}>{v.texto}</Text>
              </View>
            ))}
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
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 72,
    overflow: 'hidden',
  },
  circuloGrande: {
    position: 'absolute',
    top: -90,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colores.primarioOscuro,
    opacity: 0.55,
  },
  circuloChico: {
    position: 'absolute',
    bottom: -40,
    left: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colores.primarioOscuro,
    opacity: 0.4,
  },
  logoMarco: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  logo: { width: 118, height: 118, resizeMode: 'contain' },
  bienvenida: { marginTop: 18, fontSize: 28, fontWeight: '800', color: '#fff' },
  etiquetaRol: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: radio.pastilla,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  etiquetaRolTexto: { fontSize: 14, fontWeight: '700', color: '#fff' },

  cuerpo: { marginTop: -48, paddingHorizontal: 20 },
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
  tarjetaTitulo: { fontSize: 22, marginBottom: 18 },
  ojo: { padding: 4 },
  errorCaja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colores.peligroSuave,
    borderRadius: radio.chico,
    padding: 12,
    marginBottom: 14,
  },
  errorTexto: { flex: 1, color: colores.peligro, fontSize: 14, fontWeight: '600' },
  boton: { marginTop: 4 },

  ventajas: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 26,
  },
  ventaja: { alignItems: 'center', gap: 6, flex: 1 },
  ventajaIcono: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colores.acentoSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ventajaTexto: { fontSize: 13, fontWeight: '700', color: colores.tenue },
});
