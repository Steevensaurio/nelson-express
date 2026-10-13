import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import LoginScreen from './screens/LoginScreen';
import NegociosScreen from './screens/NegociosScreen';
import MenuScreen from './screens/MenuScreen';
import ConfirmarPedidoScreen from './screens/ConfirmarPedidoScreen';
import MisPedidosScreen from './screens/MisPedidosScreen';
import PerfilScreen from './screens/PerfilScreen';
import MisDireccionesScreen from './screens/MisDireccionesScreen';
import PedidoDetalleScreen from './screens/PedidoDetalleScreen';
import MisDatosScreen from './screens/MisDatosScreen';
import NuevoEncargoScreen from './screens/NuevoEncargoScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useFonts, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed';
import * as SplashScreen from 'expo-splash-screen';
import { colores, fuente, opcionesCabecera } from './constants/tema';

// El splash se queda hasta que la tipografía de marca esté lista, para no mostrar un cambio de letra.
SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Negocios') {
            iconName = focused ? 'storefront' : 'storefront-outline';
          } else if (route.name === 'MisPedidos') {
            iconName = focused ? 'receipt' : 'receipt-outline';
          } else if (route.name === 'Perfil') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        ...opcionesCabecera,
        tabBarActiveTintColor: colores.primarioOscuro,
        tabBarInactiveTintColor: colores.suave,
        tabBarLabelStyle: { fontFamily: fuente.displayMedio, fontSize: 14, letterSpacing: 0.5, textTransform: 'uppercase' },
        tabBarStyle: { backgroundColor: colores.tarjeta, borderTopColor: colores.borde },
      })}
    >
      <Tab.Screen name="Negocios" component={NegociosScreen} />
      <Tab.Screen name="MisPedidos" component={MisPedidosScreen} options={{ title: 'Mis Pedidos' }} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
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
            <Stack.Screen name="Menu" component={MenuScreen} options={({ route }) => ({ title: route.params.negocioNombre })} />
            <Stack.Screen name="ConfirmarPedido" component={ConfirmarPedidoScreen} options={{ title: 'Confirmar pedido' }} />
            <Stack.Screen name="PedidoDetalle" component={PedidoDetalleScreen} options={{ title: 'Detalle del pedido' }} />
            <Stack.Screen name="NuevoEncargo" component={NuevoEncargoScreen} options={{ title: 'Nuevo encargo' }} />
            <Stack.Screen name="MisDatos" component={MisDatosScreen} options={{ title: 'Mis datos' }} />
            <Stack.Screen name="MisDirecciones" component={MisDireccionesScreen} options={{ title: 'Mis direcciones' }} />
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
