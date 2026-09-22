import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function PerfilScreen({ navigation }) {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.opcion} onPress={() => navigation.navigate('MisDatos')}>
        <Text style={styles.opcionTexto}>Mis datos</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.opcion} onPress={() => navigation.navigate('MisDirecciones')}>
        <Text style={styles.opcionTexto}>Mis direcciones</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBoton} onPress={logout}>
        <Text style={styles.logoutTexto}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    padding: 16,
  },
  opcion: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  opcionTexto: {
    fontSize: 16,
  },
  logoutBoton: {
    backgroundColor: '#c0392b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutTexto: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
