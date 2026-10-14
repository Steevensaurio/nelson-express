import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, Image, Pressable, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../services/api';
import { colores, fuente, tipo, radio, espacio } from '../constants/tema';
import { Aviso, Boton, Campo, Entrada, Icono, Rayas, Text, Titulo } from '../components/ui';

// Segundos tras los que se avisa que el servidor (Render gratis) está despertando.
const ESPERA_LENTA_MS = 5000;
// Cubre el "hasta un minuto" del aviso: mayor que el timeout global de la instancia de axios.
const LOGIN_TIMEOUT_MS = 60000;

export default function LoginScreen({ onLoginSuccess }) {
  const insets = useSafeAreaInsets();
  const claveRef = useRef(null);
  // Un doble toque dispara dos veces antes de que el estado `entrando` se actualice: el ref lo impide.
  const enCurso = useRef(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [lento, setLento] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!entrando) return undefined;
    const id = setTimeout(() => setLento(true), ESPERA_LENTA_MS);
    return () => { clearTimeout(id); setLento(false); };
  }, [entrando]);

  const handleLogin = async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    setEntrando(true);
    setError('');
    try {
      // Cualquier cuenta puede pedir comida, incluida la de un motorizado en su día libre o la del
      // despachador: esta app no filtra por rol, a diferencia de la del motorizado y el panel.
      // Timeout de 60 s (no los 30 s globales): un arranque en frío de Render puede tardar casi un minuto.
      const { access, refresh } = (await api.post('/token/', {
        username: username.trim(),
        password,
      }, { timeout: LOGIN_TIMEOUT_MS })).data;
      onLoginSuccess(access, refresh);
    } catch (err) {
      setError(
        err.response
          ? 'Usuario o contraseña incorrectos'
          : 'No se pudo conectar con el servidor. Revisa tu conexión.'
      );
      setEntrando(false);
    } finally {
      enCurso.current = false;
    }
  };

  const puedeEntrar = Boolean(username.trim() && password && !entrando);

  return (
    // Degradado de la marca a pantalla completa; la hoja blanca con el formulario queda pegada abajo.
    <LinearGradient
      colors={colores.degradado}
      // El tono más claro solo ocupa la esquina de las franjas: el texto pequeño queda sobre azul
      // oscuro (blanco sobre #0a9bd0 es 3.2:1; sobre este degradado, 4.7:1 o más).
      locations={[0, 0.07, 1]}
      start={{ x: 0.85, y: 0 }}
      end={{ x: 0.2, y: 1 }}
      style={styles.flex}
    >
      <StatusBar style="light" />
      {/* El ScrollView permite desplazarse cuando el teclado tapa los campos; el KeyboardAvoidingView
          sube el contenido para que el campo que se escribe quede a la vista. */}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.cabecera, { paddingTop: 20 + insets.top }]}>
            <Rayas opacidad={0.12} estilo={styles.rayas} />
            <View style={styles.marca}>
              <View style={styles.logoMarco} aria-hidden>
                <Image source={require('../assets/logo-circular.png')} style={styles.logo} />
              </View>
              <View style={styles.marcaTextos}>
                <Text style={styles.marcaNombre}>Nelson Express</Text>
                <Text style={styles.marcaSubtitulo}>Delivery en Santo Domingo</Text>
              </View>
            </View>
            <Text accessibilityRole="header" style={styles.titular}>
              {'Pide fácil,\n'}
              <Text style={styles.acento}>llega rápido</Text>
            </Text>
            <Text style={styles.apoyo}>Tu comida y tus encargos, en minutos.</Text>
          </View>

          <Entrada estilo={styles.entrada}>
            <View style={[styles.hoja, { paddingBottom: espacio.xl + insets.bottom }]}>
              <View style={styles.formulario}>
                <Titulo estilo={styles.hojaTitulo}>Bienvenido de nuevo</Titulo>

                <Campo
                  relleno
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
                  relleno
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

                {error ? <Aviso tipo="error" animar={false} estilo={styles.aviso}>{error}</Aviso> : null}

                <Boton
                  titulo={entrando ? 'Ingresando…' : 'Ingresar'}
                  etiqueta="Ingresar"
                  icono={entrando ? undefined : 'log-in-outline'}
                  onPress={handleLogin}
                  deshabilitado={!puedeEntrar && !entrando}
                  cargando={entrando}
                  estilo={styles.boton}
                />

                {entrando && lento ? (
                  <Aviso tipo="info" animar={false} estilo={styles.avisoLento}>
                    El servidor está despertando, puede tardar hasta un minuto…
                  </Aviso>
                ) : null}

                <Text style={styles.pie}>Nelson Express · Santo Domingo</Text>
              </View>
            </View>
          </Entrada>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  cabecera: {
    paddingHorizontal: 22,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  // Franjas inclinadas arriba a la derecha, detrás del titular; no llegan a la línea de apoyo.
  rayas: { right: -14, top: 16, bottom: undefined, height: 120 },
  marca: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  logoMarco: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colores.blanco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 52, height: 52, resizeMode: 'contain' },
  marcaTextos: { flexShrink: 1 },
  marcaNombre: { ...tipo.subtitulo, fontFamily: fuente.extra, color: colores.blanco },
  marcaSubtitulo: { ...tipo.apoyo, color: colores.blanco, opacity: 0.95 },
  titular: {
    marginTop: 28,
    fontFamily: fuente.extra,
    fontSize: tipo.display.fontSize,
    lineHeight: 34,
    color: colores.blanco,
  },
  acento: { fontFamily: fuente.extra, color: colores.acentoClaro },
  apoyo: { ...tipo.apoyo, marginTop: espacio.s, color: colores.blanco },

  entrada: { marginTop: 'auto' },
  hoja: {
    backgroundColor: colores.blanco,
    borderTopLeftRadius: radio.hoja,
    borderTopRightRadius: radio.hoja,
    paddingTop: espacio.xl,
    paddingHorizontal: 22,
  },
  formulario: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  hojaTitulo: { fontSize: tipo.subtitulo.fontSize, marginBottom: 14 },
  ojo: { padding: espacio.xs },
  aviso: { marginBottom: 14 },
  boton: { marginTop: 6, minHeight: 54, borderRadius: radio.grande },
  avisoLento: { marginTop: 14 },
  pie: { ...tipo.apoyo, marginTop: 14, textAlign: 'center', color: colores.tenue },
});
