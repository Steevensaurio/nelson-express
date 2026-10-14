import { useState } from 'react';
import { View, FlatList, Pressable, StyleSheet, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';
import { pedir } from '../services/consultas';
import { useCargaRapida } from '../hooks/useCargaRapida';
import SelectorMapa from '../components/SelectorMapa';
import { colores, fuente } from '../constants/tema';
import { Aviso, Boton, Campo, Esqueleto, Icono, Text, estiloTarjeta } from '../components/ui';

// Tarjeta de dirección mientras llega la lista.
function TarjetaEsqueleto() {
  return (
    <View style={styles.card}>
      <Esqueleto ancho={42} alto={42} radio={21} />
      <View style={styles.cardCuerpo}>
        <Esqueleto ancho="40%" alto={18} />
        <Esqueleto ancho="75%" alto={16} estilo={styles.esqueletoLinea} />
      </View>
    </View>
  );
}

const SIN_DIRECCIONES = [];
const pedirDirecciones = pedir('/direcciones/');

export default function MisDireccionesScreen() {
  // La lista vive también en la caché ('direcciones'): al crear, editar o borrar se actualiza ahí para que
  // Confirmar pedido y Nuevo encargo la vean sin otra petición.
  const { datos, cargando, error: errorCarga, recargar, actualizar: actualizarDirecciones } = useCargaRapida('direcciones', pedirDirecciones, { maxEdad: 60000 });
  const direcciones = datos ?? SIN_DIRECCIONES;
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
        actualizarDirecciones(prev => (prev ?? []).map(d => d.id === editandoId ? response.data : d));
      } else {
        const response = await api.post('/direcciones/', { etiqueta, direccion, referencia, lat, lng });
        actualizarDirecciones(prev => [...(prev ?? []), response.data]);
      }
      cancelar();
    } catch (err) {
      console.log('Error al guardar direccion:', JSON.stringify(err.response?.data));
      setError('No se pudo guardar la dirección');
    }
  };

  const eliminar = async () => {
    await api.delete(`/direcciones/${editandoId}/`);
    actualizarDirecciones(prev => (prev ?? []).filter(d => d.id !== editandoId));
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
        <Aviso tipo="error" estilo={styles.errorCaja}>{error}</Aviso>
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
          cargando ? (
            <View style={styles.esqueletos} accessibilityRole="progressbar" accessibilityLabel="Cargando" aria-busy>
              <TarjetaEsqueleto />
              <TarjetaEsqueleto />
            </View>
          ) : errorCarga && datos === undefined ? (
            <View style={styles.esqueletos}>
              <Aviso tipo="error">No pudimos cargar tus direcciones. Revisa tu conexión.</Aviso>
              <Boton titulo="Reintentar" variante="secundario" icono="refresh" onPress={recargar} />
            </View>
          ) : (
            <View style={styles.vacio}>
              <Icono nombre="location-outline" tamano={44} color={colores.suave} />
              <Text style={styles.vacioTexto}>Todavía no tienes direcciones guardadas</Text>
            </View>
          )
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
  etiqueta: { fontFamily: fuente.extra, fontSize: 16, color: colores.texto },
  direccion: { fontFamily: fuente.media, fontSize: 14, color: colores.tenue, marginTop: 2 },
  referencia: { fontFamily: fuente.media, fontSize: 13, color: colores.tenue, marginTop: 3 },
  esqueletos: { gap: 12 },
  esqueletoLinea: { marginTop: 6 },
  vacio: { alignItems: 'center', gap: 12, marginTop: 32, marginBottom: 16 },
  vacioTexto: { textAlign: 'center', fontFamily: fuente.media, color: colores.tenue, fontSize: 15 },
  formulario: { ...estiloTarjeta, marginTop: 4 },
  formularioTitulo: { fontFamily: fuente.extra, fontSize: 20, color: colores.texto, marginBottom: 14 },
  etiquetaMapa: { fontFamily: fuente.negrita, fontSize: 14, color: colores.texto, marginBottom: 6 },
  botonMapa: { marginBottom: 14 },
  espacio: { marginTop: 10 },
  agregar: { marginTop: 4 },
  errorCaja: { marginBottom: 14 },
});
