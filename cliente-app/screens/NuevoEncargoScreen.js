import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Switch, StyleSheet, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import SelectorMapa from '../components/SelectorMapa';

const COLOR = '#007cab';

export default function NuevoEncargoScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [descripcion, setDescripcion] = useState('');
  const [recogida, setRecogida] = useState(null); // { lat, lng } elegido en el mapa
  const [recogidaDireccion, setRecogidaDireccion] = useState('');
  const [recogidaReferencia, setRecogidaReferencia] = useState('');
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const [recogidaContactoNombre, setRecogidaContactoNombre] = useState('');
  const [recogidaContactoTelefono, setRecogidaContactoTelefono] = useState('');
  const [entregaContactoNombre, setEntregaContactoNombre] = useState('');
  const [entregaContactoTelefono, setEntregaContactoTelefono] = useState('');
  const [pagar, setPagar] = useState(false);
  const [monto, setMonto] = useState('');
  const [direcciones, setDirecciones] = useState([]);
  const [direccionId, setDireccionId] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [envio, setEnvio] = useState(null);
  const [errorEnvio, setErrorEnvio] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  // Al volver de "Mis direcciones" (donde puede agregar una) se recargan las direcciones y el perfil.
  useFocusEffect(
    useCallback(() => {
      api.get('/direcciones/').then(r => setDirecciones(r.data)).catch(() => {});
      api.get('/perfil/').then(r => setPerfil(r.data)).catch(() => {});
    }, [])
  );

  const destino = direcciones.find(d => d.id === direccionId);

  // El envío lo calcula el servidor cuando ya hay punto de recogida y destino.
  useEffect(() => {
    setEnvio(null);
    setErrorEnvio(false);
    if (!recogida || !destino) return undefined;

    let vigente = true;
    api.post('/encargos/cotizar/', {
      recogida_lat: recogida.lat,
      recogida_lng: recogida.lng,
      destino_lat: destino.lat,
      destino_lng: destino.lng,
    })
      .then(r => vigente && setEnvio(r.data))
      .catch(() => vigente && setErrorEnvio(true));
    return () => { vigente = false; };
  }, [recogida, destino?.id]);

  const perfilIncompleto = perfil !== null && !(perfil.first_name && perfil.telefono);

  const puedeEnviar =
    descripcion.trim() && recogida && recogidaDireccion.trim() &&
    destino && envio && (!pagar || parseFloat(monto) > 0) &&
    !perfilIncompleto && !enviando;

  const enviar = async () => {
    setEnviando(true);
    setError('');
    try {
      await api.post('/encargos/', {
        descripcion: descripcion.trim(),
        recogida_direccion: recogidaDireccion.trim(),
        recogida_referencia: recogidaReferencia.trim(),
        recogida_lat: recogida.lat,
        recogida_lng: recogida.lng,
        recogida_contacto_nombre: recogidaContactoNombre.trim(),
        recogida_contacto_telefono: recogidaContactoTelefono.trim(),
        entrega_contacto_nombre: entregaContactoNombre.trim(),
        entrega_contacto_telefono: entregaContactoTelefono.trim(),
        pagar_en_recogida: pagar,
        ...(pagar ? { monto_estimado: parseFloat(monto).toFixed(2) } : {}),
        destino_direccion: destino.direccion,
        destino_referencia: destino.referencia,
        destino_lat: destino.lat,
        destino_lng: destino.lng,
      });
      navigation.navigate('Main', { screen: 'MisPedidos' });
    } catch (err) {
      const d = err.response?.data;
      setError(
        d?.detail ?? d?.recogida_contacto_telefono?.[0] ?? d?.entrega_contacto_telefono?.[0] ??
          d?.monto_estimado?.[0] ?? d?.descripcion?.[0] ?? 'No se pudo crear el encargo'
      );
      setEnviando(false);
    }
  };

  const seleccionarUbicacion = (lat, lng, direccionSugerida) => {
    setRecogida({ lat, lng });
    if (direccionSugerida && !recogidaDireccion) setRecogidaDireccion(direccionSugerida);
    setMostrarMapa(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.contenido, { paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.ayuda}>
          Recogemos lo que necesites en cualquier lugar y te lo llevamos. Solo pagas el envío
          {' '}(y lo que el motorizado deba pagar en el lugar, si aplica).
        </Text>

        <Text style={styles.seccion}>¿Qué debemos recoger?</Text>
        <TextInput
          style={[styles.input, styles.multilinea]}
          value={descripcion}
          onChangeText={setDescripcion}
          placeholder="Ej. una caja mediana con documentos"
          maxLength={255}
          multiline
        />

        <Text style={styles.seccion}>Lugar de recogida</Text>
        <TouchableOpacity style={styles.mapaBoton} onPress={() => setMostrarMapa(true)}>
          <Text style={styles.mapaBotonTexto}>
            {recogida
              ? `📍 Ubicación elegida (${recogida.lat.toFixed(4)}, ${recogida.lng.toFixed(4)})`
              : '📍 Elegir ubicación en el mapa'}
          </Text>
        </TouchableOpacity>
        <TextInput style={styles.input} value={recogidaDireccion} onChangeText={setRecogidaDireccion} placeholder="Dirección" />
        <TextInput
          style={styles.input}
          value={recogidaReferencia}
          onChangeText={setRecogidaReferencia}
          maxLength={255}
          placeholder="Referencia (ej. local azul, junto a la farmacia)"
        />

        <View style={styles.grupoContacto}>
          <Text style={styles.seccion}>¿Quién entrega ahí?</Text>
          <Text style={styles.nota}>Déjalo vacío si tú mismo lo entregas.</Text>
          <TextInput
            style={styles.input}
            value={recogidaContactoNombre}
            onChangeText={setRecogidaContactoNombre}
            placeholder="Nombre"
            autoCapitalize="words"
          />
          <TextInput
            style={styles.input}
            value={recogidaContactoTelefono}
            onChangeText={setRecogidaContactoTelefono}
            placeholder="Teléfono (ej. 0991234567)"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.filaSwitch}>
          <Text style={styles.switchTexto}>El motorizado debe pagar algo al recoger</Text>
          <Switch value={pagar} onValueChange={setPagar} trackColor={{ true: COLOR }} />
        </View>
        {pagar ? (
          <>
            <TextInput
              style={styles.input}
              value={monto}
              onChangeText={setMonto}
              placeholder="Monto aproximado (ej. 12.50)"
              keyboardType="decimal-pad"
            />
            <Text style={styles.nota}>Al recibir le pagas lo que gastó más el envío.</Text>
          </>
        ) : null}

        <Text style={styles.seccion}>Dirección de entrega</Text>
        {direcciones.map(item => (
          <TouchableOpacity
            key={item.id}
            style={[styles.direccionCard, item.id === direccionId && styles.direccionCardSeleccionada]}
            onPress={() => setDireccionId(item.id)}
          >
            <Text style={styles.direccionEtiqueta}>{item.etiqueta}</Text>
            <Text style={styles.direccionTexto}>{item.direccion}</Text>
            {item.referencia ? <Text style={styles.direccionReferencia}>{item.referencia}</Text> : null}
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={() => navigation.navigate('MisDirecciones')}>
          <Text style={styles.agregarTexto}>+ Agregar o cambiar mis direcciones</Text>
        </TouchableOpacity>

        <View style={styles.grupoContacto}>
          <Text style={styles.seccion}>¿Quién recibe ahí?</Text>
          <Text style={styles.nota}>Déjalo vacío si tú mismo lo recibes.</Text>
          <TextInput
            style={styles.input}
            value={entregaContactoNombre}
            onChangeText={setEntregaContactoNombre}
            placeholder="Nombre"
            autoCapitalize="words"
          />
          <TextInput
            style={styles.input}
            value={entregaContactoTelefono}
            onChangeText={setEntregaContactoTelefono}
            placeholder="Teléfono (ej. 0991234567)"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.resumen}>
          <Text style={styles.resumenTexto}>
            Envío{envio ? ` (${parseFloat(envio.distancia_km).toFixed(1)} km)` : ''}
          </Text>
          <Text style={styles.resumenPrecio}>
            {envio
              ? `$${parseFloat(envio.costo_envio).toFixed(2)}`
              : errorEnvio
                ? 'No disponible'
                : 'Elige recogida y entrega'}
          </Text>
        </View>

        {perfilIncompleto ? (
          <TouchableOpacity style={styles.avisoPerfil} onPress={() => navigation.navigate('MisDatos')}>
            <Text style={styles.avisoPerfilTexto}>
              Para pedir necesitamos tu nombre y teléfono, así el motorizado puede contactarte.
            </Text>
            <Text style={styles.avisoPerfilAccion}>Completar mis datos</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.boton, !puedeEnviar && styles.botonDeshabilitado]}
          disabled={!puedeEnviar}
          onPress={enviar}
        >
          <Text style={styles.botonTexto}>{enviando ? 'Enviando...' : 'Pedir encargo'}</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <Modal visible={mostrarMapa} animationType="slide" onRequestClose={() => setMostrarMapa(false)}>
        <SelectorMapa onConfirmar={seleccionarUbicacion} onCancelar={() => setMostrarMapa(false)} />
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f2' },
  contenido: { padding: 16 },
  ayuda: { color: '#666', fontSize: 13, marginBottom: 16 },
  seccion: { fontSize: 16, fontWeight: 'bold', marginTop: 8, marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  multilinea: { minHeight: 70, textAlignVertical: 'top' },
  nota: { fontSize: 12, color: '#666', marginBottom: 10 },
  mapaBoton: {
    backgroundColor: '#fff',
    borderColor: COLOR,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  mapaBotonTexto: { color: COLOR, fontWeight: 'bold', textAlign: 'center' },
  grupoContacto: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  filaSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginVertical: 10,
  },
  switchTexto: { flex: 1, fontSize: 14, paddingRight: 8 },
  direccionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  direccionCardSeleccionada: { borderColor: COLOR },
  direccionEtiqueta: { fontSize: 15, fontWeight: 'bold' },
  direccionTexto: { fontSize: 13, color: '#666' },
  direccionReferencia: { fontSize: 12, color: '#999', fontStyle: 'italic', marginTop: 2 },
  agregarTexto: { color: COLOR, fontWeight: 'bold', marginVertical: 10 },
  resumen: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  resumenTexto: { fontSize: 15, fontWeight: 'bold' },
  resumenPrecio: { fontSize: 15, fontWeight: 'bold' },
  avisoPerfil: {
    backgroundColor: '#fff4e0',
    borderColor: '#e08a1e',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  avisoPerfilTexto: { fontSize: 13, color: '#7a4b00' },
  avisoPerfilAccion: { fontSize: 13, fontWeight: 'bold', color: '#e08a1e', marginTop: 6 },
  boton: {
    backgroundColor: COLOR,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  botonDeshabilitado: { backgroundColor: '#aaa' },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  error: { color: 'red', marginTop: 10, textAlign: 'center' },
});
