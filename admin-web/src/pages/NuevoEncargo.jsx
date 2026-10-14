import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Barra from '../components/Barra.jsx';
import SelectorMapa from '../components/SelectorMapa.jsx';
import { normalizarTelefono, MENSAJE_TELEFONO } from '../telefono.js';

const VACIO = {
  clienteNombre: '', clienteTelefono: '', descripcion: '',
  recogidaDireccion: '', recogidaReferencia: '', recogida: null,
  recogidaContactoNombre: '', recogidaContactoTelefono: '',
  entregaContactoNombre: '', entregaContactoTelefono: '',
  pagar: false, monto: '',
  destinoDireccion: '', destinoReferencia: '', destino: null,
};

const errorDe = (err) => {
  const d = err.response?.data;
  if (!d || typeof d !== 'object') return 'No se pudo crear el encargo.';
  if (d.detail) return d.detail;
  const [campo, mensajes] = Object.entries(d)[0] ?? [];
  return campo ? `${campo}: ${[].concat(mensajes)[0]}` : 'No se pudo crear el encargo.';
};

// Teléfono con el error junto al campo; el cliente es obligatorio y los de contacto, opcionales.
const TELEFONOS = ['clienteTelefono', 'recogidaContactoTelefono', 'entregaContactoTelefono'];
const CAMPO_SERVIDOR = {
  cliente_telefono: 'clienteTelefono', recogida_contacto_telefono: 'recogidaContactoTelefono',
  entrega_contacto_telefono: 'entregaContactoTelefono',
};

function CampoTelefono({ id, etiqueta, error, inputRef, ...props }) {
  return (
    <div className="campo-tel">
      <label htmlFor={id}>{etiqueta}</label>
      <input
        id={id} ref={inputRef} type="tel" inputMode="tel" autoComplete="tel" maxLength={16}
        placeholder="0991234567" aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined} {...props}
      />
      {error ? <p className="error" id={`${id}-error`} role="alert">{error}</p> : null}
    </div>
  );
}

export default function NuevoEncargo() {
  const [f, setF] = useState(VACIO);
  const [envio, setEnvio] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [creado, setCreado] = useState(null);
  const [erroresTel, setErroresTel] = useState({});
  const refsTel = useRef({});

  // Obligatorio solo el del cliente; los de contacto, vacíos valen. Tras mostrar el error se corrige en vivo.
  const errorTel = (campo, valor) => {
    if (!valor.trim()) return campo === 'clienteTelefono' ? MENSAJE_TELEFONO : '';
    return normalizarTelefono(valor) ? '' : MENSAJE_TELEFONO;
  };
  const telefono = (campo, etiqueta) => (
    <CampoTelefono
      id={`tel-${campo}`} etiqueta={etiqueta} error={erroresTel[campo]}
      inputRef={(el) => { refsTel.current[campo] = el; }}
      value={f[campo]}
      onChange={(e) => {
        cambiar(campo)(e.target.value);
        if (erroresTel[campo]) setErroresTel((prev) => ({ ...prev, [campo]: errorTel(campo, e.target.value) }));
      }}
      onBlur={() => setErroresTel((prev) => ({ ...prev, [campo]: f[campo].trim() ? errorTel(campo, f[campo]) : '' }))}
    />
  );

  const cambiar = (campo) => (valor) => setF((prev) => ({ ...prev, [campo]: valor }));
  const texto = (campo) => ({ value: f[campo], onChange: (e) => cambiar(campo)(e.target.value) });

  // El pin en el mapa fija la ubicación; la dirección autocompletada se puede seguir editando a mano.
  const elegirEnMapa = (campoUbicacion, campoDireccion) => ({ lat, lng, direccion }) =>
    setF((prev) => ({
      ...prev,
      [campoUbicacion]: { lat, lng },
      [campoDireccion]: direccion ?? prev[campoDireccion],
    }));

  const { recogida, destino } = f;

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
  }, [recogida?.lat, recogida?.lng, destino?.lat, destino?.lng]);

  // Lo que falta para poder crear el encargo: se muestra junto al botón en vez de dejarlo apagado sin explicación.
  const faltan = [
    !f.clienteNombre.trim() && 'nombre del cliente',
    !f.clienteTelefono.trim() && 'teléfono del cliente',
    !f.descripcion.trim() && 'qué recoger',
    !recogida && 'punto de recogida en el mapa',
    !f.recogidaDireccion.trim() && 'dirección de recogida',
    f.pagar && !(Number(f.monto) > 0) && 'monto que debe pagar el motorizado',
    !destino && 'punto de entrega en el mapa',
    !f.destinoDireccion.trim() && 'dirección de entrega',
  ].filter(Boolean);
  const completo = faltan.length === 0;

  const crear = async (evento) => {
    evento.preventDefault();
    const nuevos = Object.fromEntries(TELEFONOS.map((c) => [c, errorTel(c, f[c])]));
    setErroresTel(nuevos);
    const primero = TELEFONOS.find((c) => nuevos[c]);
    if (primero) {
      refsTel.current[primero]?.focus();
      return;
    }
    setEnviando(true);
    setError('');
    try {
      const { data } = await api.post('/despacho/encargos/', {
        cliente_nombre: f.clienteNombre.trim(),
        cliente_telefono: normalizarTelefono(f.clienteTelefono),
        descripcion: f.descripcion.trim(),
        recogida_direccion: f.recogidaDireccion.trim(),
        recogida_referencia: f.recogidaReferencia.trim(),
        recogida_lat: recogida.lat.toFixed(6),
        recogida_lng: recogida.lng.toFixed(6),
        recogida_contacto_nombre: f.recogidaContactoNombre.trim(),
        recogida_contacto_telefono: normalizarTelefono(f.recogidaContactoTelefono) ?? '',
        entrega_contacto_nombre: f.entregaContactoNombre.trim(),
        entrega_contacto_telefono: normalizarTelefono(f.entregaContactoTelefono) ?? '',
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
      const d = err.response?.data;
      const deServidor = Object.fromEntries(
        Object.entries(CAMPO_SERVIDOR).filter(([k]) => d?.[k]).map(([k, c]) => [c, [].concat(d[k])[0]])
      );
      if (Object.keys(deServidor).length) setErroresTel(deServidor);
      else setError(errorDe(err));
    } finally {
      setEnviando(false);
    }
  };

  // Si el campo enfocado queda en parte debajo del pie fijo (o de la barra), se trae a la vista: el navegador
  // solo desplaza cuando el campo está fuera de pantalla. scrollIntoView respeta scroll-margin (--alto-pie).
  const alEnfocar = (e) => {
    const pie = e.currentTarget.querySelector('.encargo-pie');
    if (!pie || pie.contains(e.target)) return;
    const r = e.target.getBoundingClientRect();
    const barra = document.querySelector('.barra')?.getBoundingClientRect().bottom ?? 0;
    if (r.bottom > pie.getBoundingClientRect().top || r.top < barra) e.target.scrollIntoView({ block: 'nearest' });
  };

  return (
    <div className="pagina">
      <Barra />
      <main className="contenido" id="contenido" tabIndex={-1}>
        <h1>Nuevo encargo</h1>
        <p className="tenue">
          Para clientes que piden por llamada o WhatsApp. Se crea a su nombre y queda Pendiente en el panel de despacho.
        </p>

        {creado ? (
          <p className="aviso-ok" role="status">
            Encargo #{creado.id} creado para {creado.cliente.nombre} (envío ${Number(creado.costo_envio).toFixed(2)}).{' '}
            <Link to="/">Ver en Despacho</Link>
          </p>
        ) : null}
        {error ? <p className="error-banner" role="alert">{error}</p> : null}

        <form className="formulario-encargo" onSubmit={crear} onFocus={alEnfocar}>
          <fieldset>
            <legend>Cliente</legend>
            <label>Nombre<input {...texto('clienteNombre')} /></label>
            {telefono('clienteTelefono', 'Teléfono')}
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
            <SelectorMapa etiqueta="Mapa de recogida" value={f.recogida} onChange={elegirEnMapa('recogida', 'recogidaDireccion')} />
            <label>Dirección<input {...texto('recogidaDireccion')} /></label>
            <label>Referencia<input {...texto('recogidaReferencia')} /></label>
            <div className="grupo-contacto campo-ancho">
              <p className="tenue">¿Quién entrega ahí? Vacío si es el propio cliente.</p>
              <label>Nombre<input {...texto('recogidaContactoNombre')} /></label>
              {telefono('recogidaContactoTelefono', 'Teléfono')}
            </div>
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
            <SelectorMapa etiqueta="Mapa de entrega" value={f.destino} onChange={elegirEnMapa('destino', 'destinoDireccion')} />
            <label>Dirección<input {...texto('destinoDireccion')} /></label>
            <label>Referencia<input {...texto('destinoReferencia')} /></label>
            <div className="grupo-contacto campo-ancho">
              <p className="tenue">¿Quién recibe ahí? Vacío si es el propio cliente.</p>
              <label>Nombre<input {...texto('entregaContactoNombre')} /></label>
              {telefono('entregaContactoTelefono', 'Teléfono')}
            </div>
          </fieldset>

          <div className="encargo-pie">
            <div className="encargo-pie-texto">
              <span className={`encargo-envio ${envio ? '' : 'pendiente'}`} role="status">
                {envio ? (
                  `Envío: $${Number(envio.costo_envio).toFixed(2)} (${Number(envio.distancia_km).toFixed(1)} km)`
                ) : (
                  <>
                    <span className="pie-largo">El envío se calcula al indicar la recogida y la entrega</span>
                    <span className="pie-corto">Envío: por calcular</span>
                  </>
                )}
              </span>
              {/* Texto completo: visible en pantalla ancha; en celular solo para lectores (y para aria-describedby). */}
              <p className="encargo-faltan" id="faltan" role="status">
                {completo ? '' : `Falta: ${faltan.join(', ')}.`}
              </p>
              {/* Celular: el pie fijo muestra solo cuántos datos faltan; la lista se despliega a pedido. */}
              {completo ? null : (
                <details className="encargo-faltan-detalle">
                  <summary>Faltan {faltan.length} {faltan.length === 1 ? 'dato' : 'datos'}</summary>
                  <p>{faltan.join(', ')}.</p>
                </details>
              )}
            </div>
            <button type="submit" className="primario" disabled={!completo || !envio || enviando} aria-describedby="faltan">
              {enviando ? 'Creando…' : 'Crear encargo'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
