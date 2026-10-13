import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import LoginScreen from './screens/LoginScreen';
import MisEntregasScreen from './screens/MisEntregasScreen';
import EntregaDetalleScreen from './screens/EntregaDetalleScreen';
import CuentasScreen from './screens/CuentasScreen';
import PerfilScreen from './screens/PerfilScreen';
import EditarPerfilScreen from './screens/EditarPerfilScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useFonts, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed';
import * as SplashScreen from 'expo-splash-screen';
import { colores, fuente, opcionesCabecera } from './constants/tema';

// El splash se queda hasta que la tipografía de marca esté lista, para no mostrar un cambio de letra.
SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const ICONOS = {
  Entregas: ['bicycle', 'bicycle-outline'],
  Cuentas: ['wallet', 'wallet-outline'],
  Perfil: ['person', 'person-outline'],
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={ICONOS[route.name][focused ? 0 : 1]} size={size} color={color} />
        ),
        ...opcionesCabecera,
        tabBarActiveTintColor: colores.primarioOscuro,
        tabBarInactiveTintColor: colores.suave,
        tabBarLabelStyle: { fontFamily: fuente.displayMedio, fontSize: 14, letterSpacing: 0.5, textTransform: 'uppercase' },
        tabBarStyle: { backgroundColor: colores.tarjeta, borderTopColor: colores.borde },
      })}
    >
      <Tab.Screen name="Entregas" component={MisEntregasScreen} options={{ title: 'Mis entregas' }} />
      <Tab.Screen name="Cuentas" component={CuentasScreen} options={{ title: 'Mis cuentas' }} />
      <Tab.Screen name="Perfil" component={PerfilScreen} options={{ title: 'Mi perfil' }} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { token, login } = useAuth();

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={opcionesCabecera}>
        {token ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="EntregaDetalle" component={EntregaDetalleScreen} options={{ title: 'Detalle de entrega' }} />
            <Stack.Screen name="EditarPerfil" component={EditarPerfilScreen} options={{ title: 'Editar perfil' }} />
          </>
        ) : (
          <Stack.Screen name="Login" options={{ headerShown: false }}>
            {(props) => <LoginScreen {...props} onLoginSuccess={login} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [fuentesListas, errorFuentes] = useFonts({ BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold });
  const lista = fuentesListas || Boolean(errorFuentes);

  useEffect(() => {
    if (lista) SplashScreen.hideAsync().catch(() => {});
  }, [lista]);

  if (!lista) return null;

  return (
    <AuthProvider>
      <RealtimeProvider>
        <AppNavigator />
      </RealtimeProvider>
    </AuthProvider>
  );
}
