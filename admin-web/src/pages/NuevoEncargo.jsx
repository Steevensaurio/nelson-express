import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Barra from '../components/Barra.jsx';

// Saca latitud y longitud de un enlace de Google Maps (pin del lugar o centro del mapa) o de "lat, lng".
export function extraerCoordenadas(texto) {
  const t = texto.trim();
  const patrones = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // pin del lugar en un enlace de Google Maps
    /@(-?\d+\.\d+),(-?\d+\.\d+)/, // centro del mapa en un enlace
    /^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/, // "lat, lng" pegado tal cual (clic derecho en el mapa)
    /[?&](?:q|ll|query)=(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const patron of patrones) {
    const m = t.match(patron);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

function CampoUbicacion({ valor, onChange }) {
  const coords = valor.trim() ? extraerCoordenadas(valor) : null;
  return (
    <label className="campo-ancho">
      Ubicación (enlace de Google Maps o coordenadas)
      <input value={valor} onChange={(e) => onChange(e.target.value)} placeholder="Pega el enlace o «-0.2500, -79.1700»" />
      {valor.trim() ? (
        coords ? (
          <span className="ubicacion-ok">✔ {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
        ) : (
          <span className="ubicacion-mala">
            No se encontraron coordenadas. Copia el enlace completo de la barra del navegador (los enlaces cortos
            no sirven) o haz clic derecho en el mapa y copia las coordenadas.
          </span>
        )
      ) : null}
    </label>
  );
}

const VACIO = {
  clienteNombre: '', clienteTelefono: '', descripcion: '',
  recogidaDireccion: '', recogidaReferencia: '', recogidaUbicacion: '',
  contactoNombre: '', contactoTelefono: '',
  pagar: false, monto: '',
  destinoDireccion: '', destinoReferencia: '', destinoUbicacion: '',
};

const errorDe = (err) => {
  const d = err.response?.data;
  if (!d || typeof d !== 'object') return 'No se pudo crear el encargo.';
  if (d.detail) return d.detail;
  const [campo, mensajes] = Object.entries(d)[0] ?? [];
  return campo ? `${campo}: ${[].concat(mensajes)[0]}` : 'No se pudo crear el encargo.';
};

export default function NuevoEncargo() {
  const [f, setF] = useState(VACIO);
  const [envio, setEnvio] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [creado, setCreado] = useState(null);

  const cambiar = (campo) => (valor) => setF((prev) => ({ ...prev, [campo]: valor }));
  const texto = (campo) => ({ value: f[campo], onChange: (e) => cambiar(campo)(e.target.value) });

  const recogida = extraerCoordenadas(f.recogidaUbicacion);
  const destino = extraerCoordenadas(f.destinoUbicacion);

  // El envío lo calcula el servidor en cuanto hay recogida y entrega.
  useEffect(() => {
    setEnvio(null);
    if (!recogida || !destino) return undefined;
    let vigente = true;
    api.post('/encargos/cotizar/', {
      recogida_lat: recogida.lat.toFixed(6), recogida_lng: recogida.lng.toFixed(6),
      destino_lat: destino.lat.toFixed(6), destino_lng: destino.lng.toFixed(6),
    })
      .then(({ data }) => vigente && setEnvio(data))
      .catch(() => vigente && setEnvio(null));
    return () => { vigente = false; };
  }, [f.recogidaUbicacion, f.destinoUbicacion]);

  const completo =
    f.clienteNombre.trim() && f.clienteTelefono.trim() && f.descripcion.trim() && f.recogidaDireccion.trim() &&
    recogida && f.contactoNombre.trim() && f.contactoTelefono.trim() && f.destinoDireccion.trim() && destino &&
    (!f.pagar || Number(f.monto) > 0);

  const crear = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const { data } = await api.post('/despacho/encargos/', {
        cliente_nombre: f.clienteNombre.trim(),
        cliente_telefono: f.clienteTelefono.trim(),
        descripcion: f.descripcion.trim(),
        recogida_direccion: f.recogidaDireccion.trim(),
        recogida_referencia: f.recogidaReferencia.trim(),
        recogida_lat: recogida.lat.toFixed(6),
        recogida_lng: recogida.lng.toFixed(6),
        contacto_nombre: f.contactoNombre.trim(),
        contacto_telefono: f.contactoTelefono.trim(),
        pagar_en_recogida: f.pagar,
        ...(f.pagar ? { monto_estimado: Number(f.monto).toFixed(2) } : {}),
        destino_direccion: f.destinoDireccion.trim(),
        destino_referencia: f.destinoReferencia.trim(),
        destino_lat: destino.lat.toFixed(6),
        destino_lng: destino.lng.toFixed(6),
      });
      setCreado(data);
      setF(VACIO);
    } catch (err) {
      setError(errorDe(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="pagina">
      <Barra />
      <main className="contenido">
        <h2>Nuevo encargo</h2>
        <p className="tenue">
          Para clientes que piden por llamada o WhatsApp. Se crea a su nombre y queda Pendiente en el panel de despacho.
        </p>

        {creado ? (
          <p className="aviso-ok">
            Encargo #{creado.id} creado para {creado.cliente.nombre} (envío ${Number(creado.costo_envio).toFixed(2)}).{' '}
            <Link to="/">Ver en Despacho</Link>
          </p>
        ) : null}
        {error ? <p className="error-banner">{error}</p> : null}

        <form className="formulario-encargo" onSubmit={crear}>
          <fieldset>
            <legend>Cliente</legend>
            <label>Nombre<input {...texto('clienteNombre')} /></label>
            <label>Teléfono<input {...texto('clienteTelefono')} inputMode="tel" /></label>
            <p className="tenue campo-ancho">Si ya existe un cliente con ese teléfono se reutiliza; si no, se crea uno nuevo.</p>
          </fieldset>

          <fieldset>
            <legend>Qué recoger</legend>
            <label className="campo-ancho">
              Descripción
              <textarea rows={2} maxLength={255} {...texto('descripcion')} placeholder="Ej. una caja mediana con documentos" />
            </label>
          </fieldset>

          <fieldset>
            <legend>Recogida</legend>
            <label>Dirección<input {...texto('recogidaDireccion')} /></label>
            <label>Referencia<input {...texto('recogidaReferencia')} /></label>
            <CampoUbicacion valor={f.recogidaUbicacion} onChange={cambiar('recogidaUbicacion')} />
            <label>Persona que entrega<input {...texto('contactoNombre')} /></label>
            <label>Su teléfono<input {...texto('contactoTelefono')} inputMode="tel" /></label>
            <label className="campo-check campo-ancho">
              <input type="checkbox" checked={f.pagar} onChange={(e) => cambiar('pagar')(e.target.checked)} />
              El motorizado debe pagar algo al recoger
            </label>
            {f.pagar ? (
              <label>Monto aproximado ($)<input type="number" min="0" step="0.01" {...texto('monto')} /></label>
            ) : null}
          </fieldset>

          <fieldset>
            <legend>Entrega</legend>
            <label>Dirección<input {...texto('destinoDireccion')} /></label>
            <label>Referencia<input {...texto('destinoReferencia')} /></label>
            <CampoUbicacion valor={f.destinoUbicacion} onChange={cambiar('destinoUbicacion')} />
          </fieldset>

          <div className="encargo-pie">
            <span className="encargo-envio">
              {envio
                ? `Envío: $${Number(envio.costo_envio).toFixed(2)} (${Number(envio.distancia_km).toFixed(1)} km)`
                : 'El envío se calcula al indicar la recogida y la entrega'}
            </span>
            <button type="submit" className="primario" disabled={!completo || !envio || enviando}>
              {enviando ? 'Creando…' : 'Crear encargo'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
