import { useState, useEffect } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';
import SelectorMapa from '../components/SelectorMapa';
import { colores, radio } from '../constants/tema';
import { Boton, Campo, Icono, estiloTarjeta } from '../components/ui';

export default function MisDireccionesScreen() {
  const [direcciones, setDirecciones] = useState([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [etiqueta, setEtiqueta] = useState('');
  const [direccion, setDireccion] = useState('');
  const [direccionBloqueada, setDireccionBloqueada] = useState(false);
  const [referencia, setReferencia] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/direcciones/').then(response => {
      setDirecciones(response.data);
    });
  }, []);

  const seleccionarUbicacion = (nuevaLat, nuevaLng, direccionSugerida) => {
    setLat(nuevaLat.toString());
    setLng(nuevaLng.toString());
    if (direccionSugerida) {
      setDireccion(direccionSugerida);
      setDireccionBloqueada(true);
    } else {
      if (direccionBloqueada) setDireccion('');
      setDireccionBloqueada(false);
    }
    setMostrarMapa(false);
  };

  const empezarEdicion = (item) => {
    setEditandoId(item.id);
    setEtiqueta(item.etiqueta);
    setDireccion(item.direccion);
    setDireccionBloqueada(Boolean(item.direccion));
    setReferencia(item.referencia ?? '');
    setLat(item.lat.toString());
    setLng(item.lng.toString());
    setError('');
    setMostrarFormulario(true);
  };

  const cancelar = () => {
    setMostrarFormulario(false);
    setEditandoId(null);
    setEtiqueta('');
    setDireccion('');
    setDireccionBloqueada(false);
    setReferencia('');
    setLat('');
    setLng('');
    setError('');
  };

  const guardar = async () => {
    try {
      if (editandoId) {
        const response = await api.patch(`/direcciones/${editandoId}/`, { etiqueta, direccion, referencia, lat, lng });
        setDirecciones(prev => prev.map(d => d.id === editandoId ? response.data : d));
      } else {
        const response = await api.post('/direcciones/', { etiqueta, direccion, referencia, lat, lng });
        setDirecciones(prev => [...prev, response.data]);
      }
      cancelar();
    } catch (err) {
      console.log('Error al guardar direccion:', JSON.stringify(err.response?.data));
      setError('No se pudo guardar la dirección');
    }
  };

  const eliminar = async () => {
    await api.delete(`/direcciones/${editandoId}/`);
    setDirecciones(prev => prev.filter(d => d.id !== editandoId));
    cancelar();
  };

  const formulario = mostrarFormulario ? (
    <View style={styles.formulario}>
      <Text accessibilityRole="header" style={styles.formularioTitulo}>
        {editandoId ? 'Editar dirección' : 'Nueva dirección'}
      </Text>

      <Campo etiqueta="Etiqueta" value={etiqueta} onChangeText={setEtiqueta} placeholder="Ej. Casa, Trabajo" />

      <Text style={styles.etiquetaMapa}>Ubicación</Text>
      <Boton
        titulo={lat && lng ? `Ubicación elegida (${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)})` : 'Elegir ubicación en el mapa'}
        variante="secundario"
        icono={lat && lng ? 'location' : 'map-outline'}
        onPress={() => setMostrarMapa(true)}
        estilo={styles.botonMapa}
      />

      <Campo
        etiqueta="Dirección"
        value={direccion}
        onChangeText={setDireccion}
        bloqueado={direccionBloqueada}
        placeholder="Se completa al elegir en el mapa"
        ayuda={direccionBloqueada ? 'Tomada del mapa. Vuelve a elegir el punto para cambiarla.' : undefined}
      />
      <Campo
        etiqueta="Referencia"
        value={referencia}
        onChangeText={setReferencia}
        maxLength={255}
        placeholder="Ej. casa de dos pisos, portón verde"
      />

      {error ? (
        <View style={styles.errorCaja} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Icono nombre="alert-circle" tamano={20} color={colores.peligro} />
          <Text style={styles.errorTexto}>{error}</Text>
        </View>
      ) : null}

      <Boton
        titulo={editandoId ? 'Guardar cambios' : 'Guardar dirección'}
        icono="checkmark"
        onPress={guardar}
        deshabilitado={!(lat && lng)}
      />
      {editandoId ? (
        <Boton titulo="Eliminar dirección" variante="peligroSuave" icono="trash-outline" onPress={eliminar} estilo={styles.espacio} />
      ) : null}
      <Boton titulo="Cancelar" variante="fantasma" onPress={cancelar} estilo={styles.espacio} />
    </View>
  ) : (
    <Boton
      titulo="Agregar nueva dirección"
      icono="add-circle-outline"
      variante="secundario"
      onPress={() => setMostrarFormulario(true)}
      estilo={styles.agregar}
    />
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <FlatList
        data={direcciones}
        keyExtractor={(item) => item.id.toString()}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.lista}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.etiqueta}. ${item.direccion}. Editar`}
            onPress={() => empezarEdicion(item)}
            android_ripple={{ color: 'rgba(0,124,171,0.12)' }}
            style={({ pressed }) => [styles.card, pressed && styles.cardPresionada, item.id === editandoId && styles.cardEditando]}
          >
            <View style={styles.cardIcono}>
              <Icono nombre="location-outline" tamano={22} color={colores.primarioOscuro} />
            </View>
            <View style={styles.cardCuerpo}>
              <Text style={styles.etiqueta}>{item.etiqueta}</Text>
              <Text style={styles.direccion}>{item.direccion}</Text>
              {item.referencia ? <Text style={styles.referencia}>{item.referencia}</Text> : null}
            </View>
            <Icono nombre="create-outline" tamano={20} color={colores.suave} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.vacio}>
            <Icono nombre="location-outline" tamano={44} color={colores.suave} />
            <Text style={styles.vacioTexto}>Todavía no tienes direcciones guardadas</Text>
          </View>
        }
        ListFooterComponent={formulario}
      />

      <Modal visible={mostrarMapa} animationType="slide" onRequestClose={() => setMostrarMapa(false)}>
        <SelectorMapa
          onConfirmar={seleccionarUbicacion}
          onCancelar={() => setMostrarMapa(false)}
          coordenadaInicial={lat && lng ? { latitude: parseFloat(lat), longitude: parseFloat(lng) } : null}
        />
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colores.fondo },
  lista: { padding: 16, paddingBottom: 32, gap: 12 },
  card: { ...estiloTarjeta, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  cardPresionada: { opacity: 0.9 },
  cardEditando: { borderWidth: 2, borderColor: colores.primario },
  cardIcono: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colores.acentoSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCuerpo: { flex: 1 },
  etiqueta: { fontSize: 16, fontWeight: '800', color: colores.texto },
  direccion: { fontSize: 14, color: colores.tenue, marginTop: 2 },
  referencia: { fontSize: 13, color: colores.tenue, fontStyle: 'italic', marginTop: 3 },
  vacio: { alignItems: 'center', gap: 12, marginTop: 32, marginBottom: 16 },
  vacioTexto: { textAlign: 'center', color: colores.tenue, fontSize: 15 },
  formulario: { ...estiloTarjeta, marginTop: 4 },
  formularioTitulo: { fontSize: 18, fontWeight: '800', color: colores.texto, marginBottom: 14 },
  etiquetaMapa: { fontSize: 14, fontWeight: '600', color: colores.texto, marginBottom: 6 },
  botonMapa: { marginBottom: 14 },
  espacio: { marginTop: 10 },
  agregar: { marginTop: 4 },
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
});
