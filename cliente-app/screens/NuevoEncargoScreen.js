import { useState, useEffect } from 'react';
import {
  View, Pressable, ScrollView, Switch, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { pedir } from '../services/consultas';
import { useCargaRapida } from '../hooks/useCargaRapida';
import SelectorDireccion from '../components/SelectorDireccion';
import { colores, fuente, radio } from '../constants/tema';
import { Aviso, Boton, Campo, Icono, Text, Titulo, estiloTarjeta } from '../components/ui';

const PASOS = ['Recogida', 'Entrega'];

function Pasos({ paso }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Pasos del encargo"
      aria-valuemin={1}
      aria-valuemax={PASOS.length}
      aria-valuenow={paso}
      aria-valuetext={`Paso ${paso} de ${PASOS.length}: ${PASOS[paso - 1]}`}
      style={styles.pasos}
    >
      {PASOS.map((nombre, i) => {
        const numero = i + 1;
        const activo = numero === paso;
        const hecho = numero < paso;
        return (
          <View key={nombre} style={styles.pasoGrupo}>
            {i > 0 ? <View style={[styles.pasoLinea, paso > i && styles.pasoLineaHecha]} /> : null}
            <View style={[styles.pasoCirculo, (activo || hecho) && styles.pasoCirculoActivo]}>
              {hecho ? (
                <Icono nombre="checkmark" tamano={18} color="#fff" />
              ) : (
                <Text style={[styles.pasoNumero, activo && styles.pasoNumeroActivo]}>{numero}</Text>
              )}
            </View>
            <Text style={[styles.pasoTexto, activo && styles.pasoTextoActivo]}>{nombre}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Dos datos opcionales (nombre y teléfono) de quien entrega o recibe; vacío = el propio cliente.
function GrupoContacto({ titulo, ayuda, icono, nombre, onNombre, telefono, onTelefono }) {
  return (
    <View style={styles.grupoContacto}>
      <View style={styles.grupoCabecera}>
        <View style={styles.grupoIcono}>
          <Icono nombre={icono} tamano={20} color={colores.primarioOscuro} />
        </View>
        <View style={styles.grupoTextos}>
          <Titulo estilo={styles.grupoTitulo}>{titulo}</Titulo>
          <Text style={styles.grupoAyuda}>{ayuda}</Text>
        </View>
      </View>
      <Campo
        etiqueta="Nombre (opcional)"
        value={nombre}
        onChangeText={onNombre}
        placeholder="Ej. Juan Pérez"
        autoCapitalize="words"
      />
      <Campo
        etiqueta="Teléfono (opcional)"
        value={telefono}
        onChangeText={onTelefono}
        placeholder="Ej. 0991234567"
        keyboardType="phone-pad"
        estilo={styles.ultimo}
      />
    </View>
  );
}

const SIN_DIRECCIONES = [];
const pedirDirecciones = pedir('/direcciones/');
const pedirPerfil = pedir('/perfil/');

export default function NuevoEncargoScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [paso, setPaso] = useState(1);
  const [descripcion, setDescripcion] = useState('');
  const [recogidaValor, setRecogidaValor] = useState(null); // { direccion, referencia, lat, lng }
  const [recogidaContactoNombre, setRecogidaContactoNombre] = useState('');
  const [recogidaContactoTelefono, setRecogidaContactoTelefono] = useState('');
  const [entregaValor, setEntregaValor] = useState(null);
  const [entregaContactoNombre, setEntregaContactoNombre] = useState('');
  const [entregaContactoTelefono, setEntregaContactoTelefono] = useState('');
  const [pagar, setPagar] = useState(false);
  const [monto, setMonto] = useState('');
  // Direcciones y perfil salen de la caché compartida; al volver de "Mis direcciones" o "Mis datos" ya vienen actualizados.
  const { datos: direccionesGuardadas, actualizar: actualizarDirecciones } = useCargaRapida('direcciones', pedirDirecciones, { maxEdad: 60000 });
  const direcciones = direccionesGuardadas ?? SIN_DIRECCIONES;
  const { datos: perfilGuardado } = useCargaRapida('perfil', pedirPerfil, { maxEdad: 60000 });
  const perfil = perfilGuardado ?? null;
  const [envio, setEnvio] = useState(null);
  const [errorEnvio, setErrorEnvio] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const agregarDireccionGuardada = (direccion) => actualizarDirecciones(prev => [...(prev ?? []), direccion]);

  // El envío lo calcula el servidor cuando ya hay punto de recogida y de entrega.
  useEffect(() => {
    setEnvio(null);
    setErrorEnvio(false);
    if (!recogidaValor || !entregaValor) return undefined;

    let vigente = true;
    api.post('/encargos/cotizar/', {
      recogida_lat: recogidaValor.lat,
      recogida_lng: recogidaValor.lng,
      destino_lat: entregaValor.lat,
      destino_lng: entregaValor.lng,
    })
      .then(r => vigente && setEnvio(r.data))
      .catch(() => vigente && setErrorEnvio(true));
    return () => { vigente = false; };
  }, [recogidaValor?.lat, recogidaValor?.lng, entregaValor?.lat, entregaValor?.lng]);

  const perfilIncompleto = perfil !== null && !(perfil.first_name && perfil.telefono);

  const puedePaso1 = Boolean(descripcion.trim() && recogidaValor?.direccion?.trim());
  const puedeEnviar = Boolean(
    entregaValor?.direccion?.trim() && envio && (!pagar || parseFloat(monto) > 0) &&
    !perfilIncompleto && !enviando
  );

  const enviar = async () => {
    setEnviando(true);
    setError('');
    try {
      await api.post('/encargos/', {
        descripcion: descripcion.trim(),
        recogida_direccion: recogidaValor.direccion.trim(),
        recogida_referencia: recogidaValor.referencia.trim(),
        recogida_lat: recogidaValor.lat,
        recogida_lng: recogidaValor.lng,
        recogida_contacto_nombre: recogidaContactoNombre.trim(),
        recogida_contacto_telefono: recogidaContactoTelefono.trim(),
        entrega_contacto_nombre: entregaContactoNombre.trim(),
        entrega_contacto_telefono: entregaContactoTelefono.trim(),
        pagar_en_recogida: pagar,
        ...(pagar ? { monto_estimado: parseFloat(monto).toFixed(2) } : {}),
        destino_direccion: entregaValor.direccion.trim(),
        destino_referencia: entregaValor.referencia.trim(),
        destino_lat: entregaValor.lat,
        destino_lng: entregaValor.lng,
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

  const textoEnvio = envio
    ? `$${parseFloat(envio.costo_envio).toFixed(2)}`
    : errorEnvio
      ? 'No disponible'
      : entregaValor ? 'Calculando…' : 'Elige la dirección de entrega';

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.contenido, { paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pasos paso={paso} />

        {paso === 1 ? (
          <>
            <Aviso estilo={styles.intro}>
              {'Recogemos lo que necesites en cualquier lugar y te lo llevamos. Solo pagas el envío (y lo que el motorizado deba pagar en el lugar, si aplica).'}
            </Aviso>

            <Titulo estilo={styles.seccion}>¿Qué debemos recoger?</Titulo>
            <Campo
              etiqueta="Descripción"
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="Ej. una caja mediana con documentos"
              maxLength={255}
              multiline
              estiloInput={styles.multilinea}
            />

            <Titulo estilo={styles.seccion}>Lugar de recogida</Titulo>
            <SelectorDireccion
              direcciones={direcciones}
              valor={recogidaValor}
              onCambiar={setRecogidaValor}
              onNuevaDireccion={agregarDireccionGuardada}
            />

            <GrupoContacto
              icono="person-outline"
              titulo="¿Quién entrega ahí?"
              ayuda="Déjalo vacío si tú mismo lo entregas."
              nombre={recogidaContactoNombre}
              onNombre={setRecogidaContactoNombre}
              telefono={recogidaContactoTelefono}
              onTelefono={setRecogidaContactoTelefono}
            />

            <Boton
              titulo="Continuar"
              icono="arrow-forward"
              onPress={() => setPaso(2)}
              deshabilitado={!puedePaso1}
              estilo={styles.continuar}
            />
          </>
        ) : (
          <>
            <Titulo estilo={styles.seccion}>Dirección de entrega</Titulo>
            <SelectorDireccion
              direcciones={direcciones}
              valor={entregaValor}
              onCambiar={setEntregaValor}
              onNuevaDireccion={agregarDireccionGuardada}
            />

            <GrupoContacto
              icono="person-outline"
              titulo="¿Quién recibe ahí?"
              ayuda="Déjalo vacío si tú mismo lo recibes."
              nombre={entregaContactoNombre}
              onNombre={setEntregaContactoNombre}
              telefono={entregaContactoTelefono}
              onTelefono={setEntregaContactoTelefono}
            />

            <View style={styles.filaSwitch}>
              <Text style={styles.switchTexto}>El motorizado debe pagar algo al recoger</Text>
              <Switch
                value={pagar}
                onValueChange={setPagar}
                trackColor={{ false: '#c4cbd0', true: colores.primario }}
                thumbColor="#fff"
                accessibilityLabel="El motorizado debe pagar algo al recoger"
              />
            </View>
            {pagar ? (
              <Campo
                etiqueta="Monto aproximado"
                value={monto}
                onChangeText={setMonto}
                placeholder="Ej. 12.50"
                keyboardType="decimal-pad"
                ayuda="Al recibir le pagas lo que gastó más el envío."
                izquierda={<Text style={styles.moneda}>$</Text>}
              />
            ) : null}

            <View style={styles.resumen} accessible accessibilityLabel={`Envío${envio ? `, ${parseFloat(envio.distancia_km).toFixed(1)} kilómetros` : ''}: ${textoEnvio}`} accessibilityLiveRegion="polite">
              <View style={styles.resumenIzquierda}>
                <Icono nombre="navigate-outline" tamano={22} color={colores.primarioOscuro} />
                <Text style={styles.resumenTexto}>
                  Envío{envio ? ` (${parseFloat(envio.distancia_km).toFixed(1)} km)` : ''}
                </Text>
              </View>
              <Text style={[styles.resumenPrecio, !envio && styles.resumenPrecioTenue]}>{textoEnvio}</Text>
            </View>

            {perfilIncompleto ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Para pedir necesitamos tu nombre y teléfono. Completar mis datos"
                style={styles.avisoPerfil}
                onPress={() => navigation.navigate('MisDatos')}
              >
                <Icono nombre="alert-circle" tamano={22} color={colores.naranja} />
                <View style={styles.avisoCuerpo}>
                  <Text style={styles.avisoPerfilTexto}>
                    Para pedir necesitamos tu nombre y teléfono, así el motorizado puede contactarte.
                  </Text>
                  <Text style={styles.avisoPerfilAccion}>Completar mis datos</Text>
                </View>
              </Pressable>
            ) : null}

            {error ? (
              <Aviso tipo="error" estilo={styles.errorCaja}>{error}</Aviso>
            ) : null}

            <View style={styles.filaBotones}>
              <Boton titulo="Atrás" icono="arrow-back" variante="secundario" onPress={() => setPaso(1)} estilo={styles.botonAtras} />
              <Boton
                titulo={enviando ? 'Enviando…' : 'Pedir encargo'}
                etiqueta="Pedir encargo"
                icono="paper-plane-outline"
                onPress={enviar}
                deshabilitado={!puedeEnviar && !enviando}
                cargando={enviando}
                estilo={styles.botonPedir}
              />
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 16 },

  pasos: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  pasoGrupo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pasoLinea: { width: 36, height: 3, backgroundColor: '#dfe5e9', marginHorizontal: 6, borderRadius: 2 },
  pasoLineaHecha: { backgroundColor: colores.primario },
  pasoCirculo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e8edf0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasoCirculoActivo: { backgroundColor: colores.primario },
  pasoNumero: { fontFamily: fuente.extra, fontSize: 16, color: colores.tenue },
  pasoNumeroActivo: { color: '#fff' },
  pasoTexto: { fontFamily: fuente.negrita, fontSize: 15, color: colores.suave },
  pasoTextoActivo: { color: colores.primarioOscuro },

  intro: { marginBottom: 6 },
  seccion: { fontSize: 20, marginTop: 18, marginBottom: 10 },
  multilinea: { minHeight: 76, textAlignVertical: 'top' },

  grupoContacto: { ...estiloTarjeta, marginTop: 16 },
  grupoCabecera: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  grupoIcono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colores.acentoSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grupoTextos: { flex: 1 },
  grupoTitulo: { fontSize: 17 },
  grupoAyuda: { fontFamily: fuente.media, fontSize: 13, color: colores.tenue, marginTop: 2 },
  ultimo: { marginBottom: 0 },

  filaSwitch: {
    ...estiloTarjeta,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 12,
    marginVertical: 16,
  },
  switchTexto: { flex: 1, fontFamily: fuente.negrita, fontSize: 15, color: colores.texto },
  moneda: { fontFamily: fuente.negrita, fontSize: 18, color: colores.tenue },

  resumen: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colores.acentoSuave,
    borderRadius: radio.grande,
    padding: 16,
    marginTop: 4,
  },
  resumenIzquierda: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  resumenTexto: { fontFamily: fuente.negrita, fontSize: 16, color: colores.texto },
  resumenPrecio: { fontFamily: fuente.extra, fontSize: 24, color: colores.primarioOscuro },
  resumenPrecioTenue: { fontFamily: fuente.media, fontSize: 14, color: colores.tenue, textAlign: 'right', flexShrink: 1 },

  avisoPerfil: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: '#fff4e0',
    borderWidth: 1,
    borderColor: '#f1cf9b',
    borderRadius: radio.medio,
    padding: 14,
    marginTop: 14,
  },
  avisoCuerpo: { flex: 1 },
  avisoPerfilTexto: { fontFamily: fuente.media, fontSize: 14, color: '#5c3300' },
  avisoPerfilAccion: { fontFamily: fuente.extra, fontSize: 14, color: colores.naranja, marginTop: 6 },

  errorCaja: { marginTop: 14 },

  continuar: { marginTop: 20 },
  filaBotones: { flexDirection: 'row', gap: 12, marginTop: 18 },
  botonAtras: { paddingHorizontal: 18 },
  botonPedir: { flex: 1 },
});
