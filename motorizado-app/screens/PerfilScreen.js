import { useCallback } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { pedir } from '../services/consultas';
import { useCargaRapida } from '../hooks/useCargaRapida';
import { useAuth } from '../context/AuthContext';
import { useTiempoReal } from '../context/RealtimeContext';
import { colores, fuente, radio, tipo, espacio } from '../constants/tema';
import { Aviso, AvisosCarga, Boton, Esqueleto, Icono, Presionable, Rayas, Text, Titulo, estiloTarjeta } from '../components/ui';

const nombreCompleto = (perfil) =>
  `${perfil.first_name} ${perfil.last_name}`.trim() || perfil.username;

const iniciales = (perfil) => {
  const letras = [perfil.first_name, perfil.last_name]
    .filter(Boolean)
    .map((p) => p[0])
    .join('');
  return (letras || perfil.username.slice(0, 2)).toUpperCase();
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const desdeCuando = (iso) => {
  const f = new Date(iso);
  return `${MESES[f.getMonth()]} de ${f.getFullYear()}`;
};

// Perfil mientras llegan los datos: mismos bloques (cabecera, estadísticas, tarjetas) para que nada salte.
function PerfilEsqueleto({ lento }) {
  return (
    <View style={styles.container}>
      <View style={styles.contenido}>
        <AvisosCarga lento={lento} hayDatos={false} />
        <View style={styles.esqueletoPerfil} accessible accessibilityRole="progressbar" accessibilityLabel="Cargando" aria-busy>
          <View style={styles.cabecera}>
            <Esqueleto ancho={72} alto={72} radio={36} />
            <View style={styles.cabeceraCuerpo}>
              <Esqueleto ancho="70%" alto={37} />
              <Esqueleto ancho={110} alto={28} radio={14} />
              <View>
                <Esqueleto ancho="90%" alto={19} />
                <Esqueleto ancho="60%" alto={19} estilo={styles.esqueletoDesde} />
              </View>
            </View>
          </View>
          <View style={styles.estadisticas}>
            <View style={styles.estadistica}><Esqueleto ancho={48} alto={44} /><Esqueleto ancho={80} alto={25} estilo={styles.esqueletoDesde} /></View>
            <View style={styles.estadisticaLinea} />
            <View style={styles.estadistica}><Esqueleto ancho={48} alto={44} /><Esqueleto ancho={80} alto={25} estilo={styles.esqueletoDesde} /></View>
          </View>
          <View style={styles.tarjeta}>
            <Esqueleto ancho="35%" alto={31} estilo={styles.esqueletoSeccion} />
            <Esqueleto ancho="60%" alto={25} estilo={styles.esqueletoFila} />
            <Esqueleto ancho="45%" alto={25} estilo={styles.esqueletoFila} />
          </View>
          <View style={styles.tarjeta}>
            <Esqueleto ancho="35%" alto={31} estilo={styles.esqueletoSeccion} />
            <Esqueleto ancho="50%" alto={49} />
          </View>
          <Esqueleto alto={52} radio={radio.medio} />
          <Esqueleto alto={52} radio={radio.medio} />
        </View>
      </View>
    </View>
  );
}

const pedirPerfil = pedir('/perfil/');

export default function PerfilScreen({ navigation }) {
  const { logout } = useAuth();
  const { suscribir } = useTiempoReal();
  // Lo último conocido sale al instante; las estadísticas se refrescan al entrar y cuando cambia algún pedido.
  // Misma clave que el saludo de Mis entregas y que "Editar perfil", que actualiza la caché al guardar.
  const { datos: perfil, cargando, error, lento, recargar } = useCargaRapida('perfil', pedirPerfil);

  useFocusEffect(useCallback(() => suscribir(() => recargar({ forzar: true })), [suscribir, recargar]));

  if (cargando) return <PerfilEsqueleto lento={lento} />;

  if (!perfil) {
    return (
      <View style={styles.centro}>
        <Text style={styles.tenue} accessibilityLiveRegion="polite">No pudimos cargar tu perfil. Revisa tu conexión.</Text>
        <Boton titulo="Reintentar" variante="secundario" icono="refresh" onPress={() => recargar({ forzar: true, manual: true })} estilo={styles.reintentar} />
      </View>
    );
  }

  const tieneVehiculo = Boolean(perfil.vehiculo_placa || perfil.vehiculo_modelo);
  const faltaContacto = !perfil.first_name || !perfil.telefono;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contenido}>
      <AvisosCarga lento={lento} error={error} hayDatos={Boolean(perfil)} />
      <View style={styles.cabecera}>
        <Rayas />
        <View style={styles.avatar} aria-hidden>
          <Text style={styles.avatarTexto}>{iniciales(perfil)}</Text>
        </View>
        <View style={styles.cabeceraCuerpo}>
          <Text accessibilityRole="header" style={styles.nombre} numberOfLines={2}>{nombreCompleto(perfil)}</Text>
          <View style={styles.chip}>
            <Icono nombre="bicycle" tamano={16} color={colores.blanco} />
            <Text style={styles.chipTexto}>Motorizado</Text>
          </View>
          <Text style={styles.desde}>Con Nelson Express desde {desdeCuando(perfil.date_joined)}</Text>
        </View>
      </View>

      <View style={styles.estadisticas}>
        <View style={styles.estadistica} accessible accessibilityLabel={`Entregas hoy: ${perfil.entregas_hoy}`}>
          <Text style={styles.estadisticaNumero}>{perfil.entregas_hoy}</Text>
          <Text style={styles.estadisticaTexto}>Entregas hoy</Text>
        </View>
        <View style={styles.estadisticaLinea} />
        <View style={styles.estadistica} accessible accessibilityLabel={`Entregas totales: ${perfil.entregas_completadas}`}>
          <Text style={styles.estadisticaNumero}>{perfil.entregas_completadas}</Text>
          <Text style={styles.estadisticaTexto}>Entregas totales</Text>
        </View>
      </View>

      {faltaContacto || !tieneVehiculo ? (
        <Presionable
          accessibilityRole="button"
          accessibilityLabel={`Completa tu perfil: ${faltaContacto ? 'nombre y teléfono' : 'datos de tu vehículo'}, para que el despachador y los clientes puedan identificarte`}
          onPress={() => navigation.navigate('EditarPerfil')}
          style={({ pressed }) => pressed && styles.presionado}
        >
          <Aviso tipo="alerta" icono="alert-circle">
            {`Completa tu perfil: ${faltaContacto ? 'nombre y teléfono' : 'datos de tu vehículo'}`}
          </Aviso>
        </Presionable>
      ) : null}

      <View style={styles.tarjeta}>
        <Titulo estilo={styles.seccion}>Contacto</Titulo>
        <View style={styles.fila}>
          <Icono nombre="call-outline" tamano={20} color={colores.primarioOscuro} />
          <Text style={styles.filaTexto}>{perfil.telefono || 'Sin teléfono registrado'}</Text>
        </View>
        <View style={styles.fila}>
          <Icono nombre="at-outline" tamano={20} color={colores.primarioOscuro} />
          <Text style={styles.filaTexto}>{perfil.username}</Text>
        </View>
      </View>

      <View style={styles.tarjeta}>
        <Titulo estilo={styles.seccion}>Vehículo</Titulo>
        {tieneVehiculo ? (
          <View style={styles.vehiculo}>
            <View style={styles.vehiculoDatos}>
              <Text style={styles.vehiculoModelo}>{perfil.vehiculo_modelo || 'Modelo sin registrar'}</Text>
              {perfil.vehiculo_color ? <Text style={styles.tenue}>{perfil.vehiculo_color}</Text> : null}
            </View>
            {perfil.vehiculo_placa ? (
              <View style={styles.placa} accessible accessibilityLabel={`Placa ${perfil.vehiculo_placa}`}>
                <Text style={styles.placaTexto}>{perfil.vehiculo_placa}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={styles.tenue}>Aún no registraste tu vehículo.</Text>
        )}
      </View>

      <Boton titulo="Editar perfil" icono="create-outline" onPress={() => navigation.navigate('EditarPerfil')} estilo={styles.espacio} />
      <Boton titulo="Cerrar sesión" variante="peligroSuave" icono="log-out-outline" onPress={logout} estilo={styles.espacio} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.l, paddingBottom: 32, gap: 14 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.fondo, padding: espacio.xl },
  reintentar: { marginTop: espacio.m },
  esqueletoPerfil: { gap: 14 },
  esqueletoSeccion: { marginBottom: 10 },
  esqueletoDesde: { marginTop: 2 },
  esqueletoFila: { marginVertical: 6 },
  tenue: { ...tipo.apoyo, color: colores.tenue },

  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.l,
    backgroundColor: colores.primario,
    borderRadius: radio.grande + 4,
    padding: 20,
    overflow: 'hidden',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colores.blanco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: { fontFamily: fuente.extra, fontSize: 26, color: colores.primarioOscuro },
  cabeceraCuerpo: { flex: 1, gap: 6, alignItems: 'flex-start' },
  nombre: { fontFamily: fuente.extra, fontSize: 26, lineHeight: 32, color: colores.blanco },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: radio.chico,
    paddingVertical: espacio.xs,
    paddingHorizontal: 10,
  },
  chipTexto: { ...tipo.apoyo, fontFamily: fuente.extra, color: colores.blanco },
  desde: { ...tipo.apoyo, color: colores.blanco },

  estadisticas: { ...estiloTarjeta, flexDirection: 'row', alignItems: 'center' },
  estadistica: { flex: 1, alignItems: 'center' },
  estadisticaLinea: { width: 1, alignSelf: 'stretch', backgroundColor: colores.borde },
  estadisticaNumero: { fontFamily: fuente.extra, fontSize: 28, lineHeight: 34, color: colores.texto },
  estadisticaTexto: { ...tipo.apoyo, fontFamily: fuente.negrita, color: colores.tenue },
  presionado: { opacity: 0.85 },

  tarjeta: { ...estiloTarjeta },
  seccion: { fontSize: tipo.seccion.fontSize, marginBottom: 10 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingVertical: 6 },
  filaTexto: { ...tipo.cuerpo, color: colores.texto },
  vehiculo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vehiculoDatos: { flex: 1, paddingRight: espacio.m },
  vehiculoModelo: { ...tipo.subtitulo, fontFamily: fuente.extra, color: colores.texto },
  placa: {
    borderWidth: 2,
    borderColor: colores.texto,
    borderRadius: radio.chico,
    backgroundColor: colores.blanco,
    paddingVertical: 3,
    paddingHorizontal: espacio.m,
  },
  placaTexto: { ...tipo.titulo, letterSpacing: 1, color: colores.texto },
  espacio: { marginTop: 2 },
});
