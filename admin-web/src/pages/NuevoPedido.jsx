import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Barra from '../components/Barra.jsx';
import SelectorMapa from '../components/SelectorMapa.jsx';
import { TarjetaMotorizado, TarjetaSkeleton, EstadoMotorizado, ordenarMotorizados } from '../components/TarjetaMotorizado.jsx';
import { normalizarTelefono, MENSAJE_TELEFONO } from '../telefono.js';
import { BP, anchoMinimo, useMedia } from '../useMedia.js';

// Todo se guarda con el endpoint de encargos del despachador (POST /despacho/encargos/), sin campos nuevos:
// la comida es un encargo cuya recogida es la sucursal y cuyo texto empieza con "Comida de …".
// Límites del servidor (models.py): descripcion y direcciones 255, nombres de contacto 100, cliente_nombre 150.
const MAX_TEXTO = 255;

let ultimoId = 0;
const filaVacia = () => ({ id: ++ultimoId, cantidad: '1', detalle: '', precio: '' });

const vacio = (tipo) => ({
  tipo,
  clienteTelefono: '', clienteNombre: '',
  negocioId: '', sucursalId: '', localReferencia: '',
  recogida: null, recogidaDireccion: '', recogidaReferencia: '',
  recogidaContactoNombre: '', recogidaContactoTelefono: '',
  destino: null, destinoDireccion: '', destinoReferencia: '',
  entregaContactoNombre: '', entregaContactoTelefono: '',
  items: [filaVacia()],
  motorizadoId: '', // opcional: se asigna con el endpoint de Despacho justo después de crear
  pagar: null, // null = automático: en comida se marca si hay precios (el motorizado paga la comida en el local)
});

const TELEFONOS = ['clienteTelefono', 'recogidaContactoTelefono', 'entregaContactoTelefono'];

// Error del servidor -> campo del formulario donde se muestra.
const CAMPO_SERVIDOR = {
  cliente_telefono: 'clienteTelefono', cliente_nombre: 'clienteNombre',
  recogida_contacto_telefono: 'recogidaContactoTelefono', recogida_contacto_nombre: 'recogidaContactoNombre',
  entrega_contacto_telefono: 'entregaContactoTelefono', entrega_contacto_nombre: 'entregaContactoNombre',
  recogida_direccion: 'recogidaDireccion', recogida_lat: 'recogidaDireccion', recogida_lng: 'recogidaDireccion',
  recogida_referencia: 'recogidaReferencia',
  destino_direccion: 'destinoDireccion', destino_lat: 'destinoDireccion', destino_lng: 'destinoDireccion',
  destino_referencia: 'destinoReferencia',
  descripcion: 'items', monto_estimado: 'items',
};

const centavos = (n) => Math.round(n * 100);
const dinero = (c) => `$${(c / 100).toFixed(2)}`;

// '' -> null (sin precio); válido -> número; cualquier otra cosa -> NaN. Acepta coma decimal.
function leerPrecio(texto) {
  const t = texto.trim().replace(',', '.');
  if (!t) return null;
  return /^\d{1,6}(\.\d{1,2})?$/.test(t) ? Number(t) : NaN;
}

// Filas totalmente vacías (sin detalle ni precio) no cuentan: Enter agrega filas y una sobrante no debe estorbar.
function analizarItems(items) {
  return items.map((it, i) => {
    const detalle = it.detalle.trim();
    const precio = leerPrecio(it.precio);
    const cantidad = /^\d{1,2}$/.test(it.cantidad.trim()) ? Number(it.cantidad) : NaN;
    const vacia = !detalle && precio === null;
    const errores = vacia ? {} : {
      cantidad: cantidad >= 1 && cantidad <= 99 ? '' : 'Cantidad: un número entero de 1 a 99.',
      detalle: detalle ? '' : 'Escribe qué es.',
      precio: Number.isNaN(precio) ? 'Precio: un número con hasta 2 decimales, por ejemplo 3.50.' : '',
    };
    return { ...it, n: i + 1, detalle, precio, cantidad, vacia, errores };
  });
}

const lineaDeItem = (f) => `${f.cantidad} x ${f.detalle}${f.precio !== null ? ` (${dinero(centavos(f.precio))})` : ''}`;

// Realce breve de algo que acaba de cambiar (fila nueva, línea del ticket). Nada si se pide menos movimiento.
function realzar(el) {
  if (!el?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.animate([{ backgroundColor: '#cdeefb' }, { backgroundColor: 'rgba(205, 238, 251, 0)' }], {
    duration: 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
  });
}

function useRealce(valor) {
  const ref = useRef(null);
  const previo = useRef(valor);
  useEffect(() => {
    if (previo.current !== valor) realzar(ref.current);
    previo.current = valor;
  }, [valor]);
  return ref;
}

function Linea({ etiqueta, valor, extra = null, className = '' }) {
  const ref = useRealce(valor);
  return (
    <div className={`ticket-linea ${className}`} ref={ref}>
      <dt>{etiqueta}</dt>
      <dd>{valor}{extra}</dd>
    </div>
  );
}

function PasoChecklist({ nombre, faltan }) {
  const ref = useRealce(faltan.length === 0);
  return (
    <li ref={ref} className={faltan.length ? 'falta' : 'listo'}>
      <span className="ticket-marca" aria-hidden="true">{faltan.length ? '●' : '✓'}</span>
      <span>
        <strong>{nombre}</strong>
        {faltan.length ? `: falta ${faltan.join(', ')}` : <span className="solo-lectores">: completo</span>}
      </span>
    </li>
  );
}

function Campo({ id, etiqueta, opcional, error, className = '', ...props }) {
  return (
    <div className={`campo ${className}`}>
      <label htmlFor={id}>
        {etiqueta}
        {opcional ? <span className="opcional"> (opcional)</span> : null}
      </label>
      <input
        id={id} aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined} {...props}
      />
      {error ? <p className="error" id={`${id}-error`} role="alert">{error}</p> : null}
    </div>
  );
}

export default function NuevoPedido() {
  const [f, setF] = useState(() => vacio('COMIDA'));
  const [negocios, setNegocios] = useState(null); // null cargando | 'error' | lista
  const [envio, setEnvio] = useState(null); // null | 'cargando' | 'error' | {costo_envio, distancia_km}
  const [errores, setErrores] = useState({});
  const [tocados, setTocados] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState('');
  const [creado, setCreado] = useState(null); // respuesta del POST
  const [motorizados, setMotorizados] = useState(null); // null cargando | 'error' | lista
  const [asignacion, setAsignacion] = useState(null); // null | {estado: 'asignando'|'ok'|'error', motorizado, motivo}
  const enfocarLuego = useRef(null);
  const tituloCreado = useRef(null);
  const ancho = useMedia(anchoMinimo(BP.pedido));
  const comida = f.tipo === 'COMIDA';

  const cargarNegocios = () => {
    setNegocios(null);
    api.get('/negocios/').then(({ data }) => setNegocios(data)).catch(() => setNegocios('error'));
  };
  useEffect(cargarNegocios, []);

  const cargarMotorizados = () => {
    setMotorizados(null);
    api.get('/despacho/motorizados/').then(({ data }) => setMotorizados(data)).catch(() => setMotorizados('error'));
  };
  useEffect(cargarMotorizados, []);
  const listaMotos = Array.isArray(motorizados) ? motorizados : [];
  const motoElegida = listaMotos.find((m) => String(m.id) === f.motorizadoId);
  const ordenadas = ordenarMotorizados(listaMotos);

  // Selector plegable: con una opción confirmada (clic, Enter o Espacio, o al salir del grupo con valor) solo se ve
  // la elegida + "Cambiar". Las flechas solo mueven la selección: no pliegan.
  const [motoPlegada, setMotoPlegada] = useState(false);
  const [motoDecidida, setMotoDecidida] = useState(false);
  const focoMoto = useRef(null); // 'cambiar' | 'radio' | null: a dónde llevar el foco tras el cambio
  const botonCambiarMoto = useRef(null);
  const grupoMoto = useRef(null);
  const plegarMoto = (foco) => {
    focoMoto.current = foco;
    setMotoDecidida(true);
    setMotoPlegada(true);
  };
  useEffect(() => {
    if (focoMoto.current === 'cambiar' && motoPlegada) botonCambiarMoto.current?.focus();
    if (focoMoto.current === 'radio' && !motoPlegada) grupoMoto.current?.querySelector('input:checked')?.focus();
    focoMoto.current = null;
  }, [motoPlegada]);
  const plegada = motoPlegada && motorizados !== null;
  const teclaMoto = (e, valor) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); // Enter no envía el formulario; Espacio no repite el clic al soltar
      cambiar('motorizadoId', valor);
      plegarMoto('cambiar');
    } else if (e.key === 'Escape' && (motoDecidida || f.motorizadoId !== '')) {
      e.preventDefault();
      plegarMoto('cambiar');
    }
  };

  // Mismo endpoint y mismo mensaje de error que Despacho. Si falla, el pedido ya existe: solo se reintenta esto.
  const asignar = async (pedido, moto) => {
    setAsignacion({ estado: 'asignando', motorizado: moto });
    try {
      await api.patch(`/despacho/pedidos/${pedido.id}/asignar/`, { motorizado: moto.id });
      setAsignacion({ estado: 'ok', motorizado: moto });
      return true;
    } catch (err) {
      const d = err.response?.data;
      const motivo = d?.detail ?? d?.motorizado?.[0] ?? 'error de conexión, inténtalo de nuevo';
      setAsignacion({ estado: 'error', motorizado: moto, motivo });
      return false;
    }
  };

  // Tras agregar o quitar una fila, el foco va a la fila que corresponde; la nueva se realza.
  useEffect(() => {
    const pendiente = enfocarLuego.current;
    if (!pendiente) return;
    enfocarLuego.current = null;
    document.getElementById(pendiente.id)?.focus();
    if (pendiente.realzar) realzar(document.getElementById(pendiente.realzar));
  });

  useEffect(() => {
    if (creado) tituloCreado.current?.focus();
  }, [creado]);

  const cambiar = (campo, valor) => {
    setF((prev) => ({ ...prev, [campo]: valor }));
    // Un error del servidor se va al corregir; el de teléfono se recalcula en vivo una vez mostrado.
    if (errores[campo]) setErrores((prev) => ({ ...prev, [campo]: TELEFONOS.includes(campo) ? errorTel(campo, valor) : '' }));
  };
  const texto = (campo) => ({ value: f[campo], onChange: (e) => cambiar(campo, e.target.value) });

  // Obligatorio solo el del cliente; los de contacto, vacíos valen.
  const errorTel = (campo, valor) => {
    if (!valor.trim()) return campo === 'clienteTelefono' ? 'Escribe el teléfono del cliente.' : '';
    return normalizarTelefono(valor) ? '' : MENSAJE_TELEFONO;
  };
  const telefono = (campo, etiqueta, extra = {}) => (
    <Campo
      id={`campo-${campo}`} etiqueta={etiqueta} error={errores[campo]}
      type="tel" inputMode="tel" autoComplete="off" maxLength={16} placeholder="0991234567"
      {...texto(campo)}
      onBlur={() => setErrores((prev) => ({ ...prev, [campo]: f[campo].trim() ? errorTel(campo, f[campo]) : '' }))}
      {...extra}
    />
  );

  // El pin fija la ubicación; la dirección autocompletada se puede seguir editando a mano.
  const elegirEnMapa = (campoUbicacion, campoDireccion) => ({ lat, lng, direccion }) => {
    setF((prev) => ({
      ...prev,
      [campoUbicacion]: { lat, lng },
      [campoDireccion]: direccion != null ? direccion.slice(0, MAX_TEXTO) : prev[campoDireccion],
    }));
    setErrores((prev) => ({ ...prev, [campoDireccion]: '' }));
  };

  // ---------- Local (comida) ----------
  const lista = Array.isArray(negocios) ? negocios : [];
  const negocio = lista.find((n) => String(n.id) === f.negocioId);
  const sucursal = negocio?.sucursales.find((s) => String(s.id) === f.sucursalId);
  const elegirNegocio = (id) => {
    const n = lista.find((x) => String(x.id) === id);
    const s = n?.sucursales.find((x) => x.abierta) ?? n?.sucursales[0];
    setF((prev) => ({ ...prev, negocioId: id, sucursalId: s ? String(s.id) : '' }));
  };
  const nombreLocal = negocio && sucursal ? `${negocio.nombre} (${sucursal.nombre})` : '';

  const puntoRecogida = comida ? (sucursal ? { lat: Number(sucursal.lat), lng: Number(sucursal.lng) } : null) : f.recogida;
  const { destino } = f;

  // El envío lo cotiza el servidor en cuanto hay recogida y entrega.
  useEffect(() => {
    if (!puntoRecogida || !destino) {
      setEnvio(null);
      return undefined;
    }
    setEnvio('cargando');
    let vigente = true;
    api.post('/encargos/cotizar/', {
      recogida_lat: puntoRecogida.lat.toFixed(6), recogida_lng: puntoRecogida.lng.toFixed(6),
      destino_lat: destino.lat.toFixed(6), destino_lng: destino.lng.toFixed(6),
    })
      .then(({ data }) => vigente && setEnvio(data))
      .catch(() => vigente && setEnvio('error'));
    return () => { vigente = false; };
  }, [puntoRecogida?.lat, puntoRecogida?.lng, destino?.lat, destino?.lng]);

  // ---------- Ítems ----------
  const filas = analizarItems(f.items);
  const validas = filas.filter((x) => !x.vacia);
  const conPrecio = validas.filter((x) => x.precio !== null && !Number.isNaN(x.precio));
  const suma = conPrecio.reduce((t, x) => t + (Number.isNaN(x.cantidad) ? 0 : x.cantidad) * centavos(x.precio), 0);
  const sinPrecio = validas.length - conPrecio.length;
  const pagar = f.pagar ?? (comida && suma > 0);
  const prefijo = comida && nombreLocal ? `Comida de ${nombreLocal}:` : '';
  const textoPedido = [prefijo, ...validas.map(lineaDeItem)].filter(Boolean).join('\n');

  const cambiarItem = (id, campo, valor) => {
    setF((prev) => ({ ...prev, items: prev.items.map((it) => (it.id === id ? { ...it, [campo]: valor } : it)) }));
    if (errores.items) setErrores((prev) => ({ ...prev, items: '' }));
  };
  const agregarItem = () => {
    const nueva = filaVacia();
    enfocarLuego.current = { id: `item-${nueva.id}-detalle`, realzar: `fila-${nueva.id}` };
    setF((prev) => ({ ...prev, items: [...prev.items, nueva] }));
  };
  const quitarItem = (indice) => {
    const resto = f.items.filter((_, i) => i !== indice);
    const siguiente = resto[Math.min(indice, resto.length - 1)];
    enfocarLuego.current = { id: `item-${siguiente.id}-detalle` };
    setF((prev) => ({ ...prev, items: resto }));
  };
  // Enter en la última fila agrega otra; en las demás baja al detalle de la siguiente. Nunca envía el formulario.
  const alTeclearItem = (indice) => (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (indice === f.items.length - 1) agregarItem();
    else document.getElementById(`item-${f.items[indice + 1].id}-detalle`)?.focus();
  };
  const tocar = (clave) => () => setTocados((prev) => (prev[clave] ? prev : { ...prev, [clave]: true }));

  // ---------- Lo que falta ----------
  const telValido = (campo) => !f[campo].trim() || normalizarTelefono(f[campo]);
  const pasos = [
    {
      nombre: 'Cliente',
      faltan: [!normalizarTelefono(f.clienteTelefono) && (f.clienteTelefono.trim() ? 'un teléfono válido' : 'el teléfono')],
    },
    {
      nombre: 'Recogida',
      faltan: comida
        ? [negocios === 'error' && 'cargar los restaurantes', !negocio && 'el restaurante', negocio && !sucursal && 'la sucursal']
        : [
          !f.recogida && 'el punto en el mapa', !f.recogidaDireccion.trim() && 'la dirección',
          !telValido('recogidaContactoTelefono') && 'un teléfono válido de quien entrega',
        ],
    },
    {
      nombre: 'Ítems',
      faltan: [
        validas.length === 0 && 'al menos un ítem con detalle',
        ...filas.filter((x) => Object.values(x.errores).some(Boolean)).map((x) => `corregir el ítem ${x.n}`),
        textoPedido.length > MAX_TEXTO && `acortar el texto (${textoPedido.length}/${MAX_TEXTO} caracteres)`,
        pagar && suma === 0 && 'el precio de algún ítem (el motorizado paga en el lugar)',
      ],
    },
    {
      nombre: 'Entrega',
      faltan: [
        !destino && 'el punto en el mapa', !f.destinoDireccion.trim() && 'la dirección',
        !telValido('entregaContactoTelefono') && 'un teléfono válido de quien recibe',
      ],
    },
  ].map((p) => ({ ...p, faltan: p.faltan.filter(Boolean) }));
  const faltantes = pasos.flatMap((p) => p.faltan.map((x) => `${p.nombre}: ${x}`));
  const completo = faltantes.length === 0;
  const envioListo = envio && typeof envio === 'object';
  const puedeCrear = completo && envioListo && !enviando;
  const textoFaltan = completo
    ? (envioListo ? '' : envio === 'error' ? 'No se pudo calcular el envío.' : 'Calculando el envío…')
    : `Falta: ${faltantes.join('; ')}.`;

  const textoEnvio = envioListo
    ? `${dinero(centavos(Number(envio.costo_envio)))} (${Number(envio.distancia_km).toFixed(1)} km)`
    : envio === 'cargando' ? 'Calculando…' : envio === 'error' ? 'No se pudo calcular' : 'Por calcular';
  const cobrar = envioListo ? suma + centavos(Number(envio.costo_envio)) : null;

  // ---------- Enviar ----------
  const crear = async (evento) => {
    evento.preventDefault();
    const nuevos = Object.fromEntries(TELEFONOS.map((c) => [c, errorTel(c, f[c])]));
    setErrores((prev) => ({ ...prev, ...nuevos }));
    const primero = TELEFONOS.find((c) => nuevos[c]);
    if (primero) {
      document.getElementById(`campo-${primero}`)?.focus();
      return;
    }
    if (!puedeCrear) return;
    setEnviando(true);
    setErrorGeneral('');
    const recogida = comida
      ? {
        recogida_direccion: sucursal.direccion.slice(0, MAX_TEXTO),
        recogida_referencia: f.localReferencia.trim(),
        // Quien entrega en el local es el local, no el cliente (vacío significaría "el propio cliente").
        recogida_contacto_nombre: nombreLocal.slice(0, 100),
        recogida_contacto_telefono: '',
      }
      : {
        recogida_direccion: f.recogidaDireccion.trim(),
        recogida_referencia: f.recogidaReferencia.trim(),
        recogida_contacto_nombre: f.recogidaContactoNombre.trim(),
        recogida_contacto_telefono: normalizarTelefono(f.recogidaContactoTelefono) ?? '',
      };
    try {
      const { data } = await api.post('/despacho/encargos/', {
        cliente_telefono: normalizarTelefono(f.clienteTelefono),
        cliente_nombre: f.clienteNombre.trim(),
        descripcion: textoPedido,
        ...recogida,
        recogida_lat: puntoRecogida.lat.toFixed(6),
        recogida_lng: puntoRecogida.lng.toFixed(6),
        entrega_contacto_nombre: f.entregaContactoNombre.trim(),
        entrega_contacto_telefono: normalizarTelefono(f.entregaContactoTelefono) ?? '',
        pagar_en_recogida: pagar,
        ...(pagar ? { monto_estimado: (suma / 100).toFixed(2) } : {}),
        destino_direccion: f.destinoDireccion.trim(),
        destino_referencia: f.destinoReferencia.trim(),
        destino_lat: destino.lat.toFixed(6),
        destino_lng: destino.lng.toFixed(6),
      });
      setCreado(data);
      if (motoElegida) asignar(data, motoElegida);
    } catch (err) {
      const d = err.response?.data;
      if (!d || typeof d !== 'object') {
        setErrorGeneral('No se pudo crear el pedido. Revisa la conexión e inténtalo de nuevo.');
        return;
      }
      const deCampos = {};
      const otros = [];
      for (const [clave, mensajes] of Object.entries(d)) {
        let campo = CAMPO_SERVIDOR[clave];
        if (comida && (campo === 'recogidaDireccion' || campo === 'recogidaReferencia')) campo = 'localReferencia';
        const mensaje = [].concat(mensajes)[0];
        if (campo && !deCampos[campo]) deCampos[campo] = mensaje;
        else if (!campo) otros.push(clave === 'detail' ? mensaje : `${clave}: ${mensaje}`);
      }
      setErrores((prev) => ({ ...prev, ...deCampos }));
      if (otros.length) setErrorGeneral(otros.join(' '));
      const primerCampo = Object.keys(deCampos)[0];
      if (primerCampo) {
        document.getElementById(primerCampo === 'items' ? `item-${f.items[0].id}-detalle` : `campo-${primerCampo}`)?.focus();
      }
    } finally {
      setEnviando(false);
    }
  };

  const crearOtro = () => {
    setF(vacio(f.tipo));
    setMotoPlegada(false);
    setMotoDecidida(false);
    setErrores({});
    setTocados({});
    setErrorGeneral('');
    setCreado(null);
    setAsignacion(null);
    cargarMotorizados(); // las entregas en curso cambiaron
    enfocarLuego.current = { id: 'campo-clienteTelefono' };
  };

  // Si el campo enfocado queda debajo del pie fijo (o de la barra), se trae a la vista.
  const alEnfocar = (e) => {
    const pie = e.currentTarget.querySelector('.pedido-pie');
    if (!pie || pie.contains(e.target)) return;
    const r = e.target.getBoundingClientRect();
    const barra = document.querySelector('.barra')?.getBoundingClientRect().bottom ?? 0;
    if (r.bottom > pie.getBoundingClientRect().top || r.top < barra) e.target.scrollIntoView({ block: 'nearest' });
  };

  const boton = (
    <button type="submit" className="primario" disabled={!puedeCrear} aria-describedby="pedido-faltan">
      {enviando ? 'Creando…' : 'Crear pedido'}
    </button>
  );

  return (
    <div className="pagina">
      <Barra />
      <main className="contenido" id="contenido" tabIndex={-1}>
        <h1>Nuevo pedido</h1>
        <p className="tenue">Para clientes que piden por llamada o WhatsApp. Queda Pendiente en el panel de despacho.</p>

        {creado ? (
          <section className="pedido-creado" aria-labelledby="pedido-creado-titulo">
            <h2 id="pedido-creado-titulo" ref={tituloCreado} tabIndex={-1}>Pedido #{creado.id} creado</h2>
            <p>
              Cliente {creado.cliente.telefono}{f.clienteNombre.trim() ? ` (${f.clienteNombre.trim()})` : ''} · envío{' '}
              {dinero(centavos(Number(creado.costo_envio)))}.{' '}
              {asignacion?.estado === 'ok' ? `Asignado a ${asignacion.motorizado.nombre}.` : asignacion ? '' : 'Ya aparece en Despacho como Pendiente.'}
            </p>
            {asignacion?.estado === 'asignando' ? <p role="status">Asignando a {asignacion.motorizado.nombre}…</p> : null}
            {asignacion?.estado === 'error' ? (
              <div className="pedido-asignacion-error">
                <p className="error" role="alert">
                  Pedido #{creado.id} creado, pero no se pudo asignar a {asignacion.motorizado.nombre}: {asignacion.motivo}
                </p>
                <button type="button" className="secundario" onClick={async () => {
                    // Al quedar asignado el botón desaparece: el foco vuelve al título del pedido.
                    if (await asignar(creado, asignacion.motorizado)) tituloCreado.current?.focus();
                  }}>
                  Reintentar asignación
                </button>
              </div>
            ) : null}
            <div className="pedido-creado-acciones">
              <button type="button" className="primario" onClick={crearOtro}>Crear otro</button>
              <Link className="secundario" to="/">Ver en Despacho</Link>
            </div>
          </section>
        ) : (
          <form className="formulario-pedido" onSubmit={crear} onFocus={alEnfocar} noValidate>
            <div className="pedido-campos">
              <div className="segmentado" role="group" aria-label="Tipo de pedido">
                {[['COMIDA', 'Comida'], ['ENCARGO', 'Encargo']].map(([valor, etiqueta]) => (
                  <button
                    key={valor} type="button" aria-pressed={f.tipo === valor}
                    onClick={() => setF((prev) => ({ ...prev, tipo: valor, pagar: null }))}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>

              <fieldset>
                <legend>Cliente</legend>
                {telefono('clienteTelefono', 'Teléfono', { 'aria-required': 'true' })}
                <Campo
                  id="campo-clienteNombre" etiqueta="Nombre" opcional error={errores.clienteNombre}
                  maxLength={150} autoComplete="off" placeholder="Si no lo sabes, déjalo vacío" {...texto('clienteNombre')}
                />
                <p className="tenue campo-ancho">Si ya existe un cliente con ese teléfono se reutiliza; si no, se crea uno nuevo.</p>
              </fieldset>

              {comida ? (
                <fieldset>
                  <legend>¿De qué local?</legend>
                  {negocios === null ? <p className="tenue campo-ancho" role="status">Cargando restaurantes…</p> : null}
                  {negocios === 'error' ? (
                    <p className="error campo-ancho" role="alert">
                      No se pudieron cargar los restaurantes.{' '}
                      <button type="button" className="enlace" onClick={cargarNegocios}>Reintentar</button>
                    </p>
                  ) : null}
                  <div className="campo">
                    <label htmlFor="campo-negocio">Restaurante</label>
                    <select
                      id="campo-negocio" value={f.negocioId} aria-required="true"
                      disabled={!lista.length} onChange={(e) => elegirNegocio(e.target.value)}
                    >
                      <option value="">Elige el restaurante</option>
                      {lista.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
                    </select>
                  </div>
                  <div className="campo">
                    <label htmlFor="campo-sucursal">Sucursal</label>
                    <select
                      id="campo-sucursal" value={f.sucursalId} aria-required="true"
                      disabled={!negocio} onChange={(e) => cambiar('sucursalId', e.target.value)}
                    >
                      {negocio ? null : <option value="">Primero el restaurante</option>}
                      {negocio?.sucursales.map((s) => (
                        <option key={s.id} value={s.id}>{s.nombre}{s.abierta ? '' : ' (cerrada)'}</option>
                      ))}
                    </select>
                  </div>
                  {sucursal ? (
                    <p className="direccion-local campo-ancho">
                      <span className="tenue">Se recoge en</span> {sucursal.direccion}
                      {sucursal.abierta ? null : <strong className="aviso-cerrada"> · Esta sucursal figura cerrada</strong>}
                    </p>
                  ) : null}
                  <Campo
                    id="campo-localReferencia" className="campo-ancho" etiqueta="Referencia de dónde retirar" opcional
                    error={errores.localReferencia} maxLength={MAX_TEXTO} placeholder="Ej. retirar por la ventanilla de autoservicio"
                    {...texto('localReferencia')}
                  />
                </fieldset>
              ) : (
                <fieldset>
                  <legend>¿De dónde se recoge?</legend>
                  <Campo
                    id="campo-recogidaDireccion" className="campo-ancho" etiqueta="Dirección" aria-required="true"
                    error={errores.recogidaDireccion} maxLength={MAX_TEXTO} {...texto('recogidaDireccion')}
                  />
                  <SelectorMapa etiqueta="Mapa de recogida" value={f.recogida} onChange={elegirEnMapa('recogida', 'recogidaDireccion')} />
                  <Campo
                    id="campo-recogidaReferencia" className="campo-ancho" etiqueta="Referencia de dónde retirar" opcional
                    error={errores.recogidaReferencia} maxLength={MAX_TEXTO} {...texto('recogidaReferencia')}
                  />
                  <div className="grupo-contacto campo-ancho">
                    <p>¿Quién entrega ahí? Vacío si es el propio cliente.</p>
                    <Campo
                      id="campo-recogidaContactoNombre" etiqueta="Nombre" opcional error={errores.recogidaContactoNombre}
                      maxLength={100} autoComplete="off" {...texto('recogidaContactoNombre')}
                    />
                    {telefono('recogidaContactoTelefono', 'Su teléfono', { opcional: true })}
                  </div>
                </fieldset>
              )}

              <fieldset>
                <legend>{comida ? '¿Qué pidió?' : '¿Qué hay que llevar?'}</legend>
                <div className="campo-ancho">
                  <table className="tabla-items">
                    <caption className="solo-lectores">Ítems del pedido</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="col-cant">Cant.</th>
                        <th scope="col">Detalle</th>
                        <th scope="col" className="col-precio">Precio c/u <span className="opcional">(opcional)</span></th>
                        <th scope="col" className="col-quitar"><span className="solo-lectores">Quitar</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((it, i) => {
                        const ver = (campo) => (tocados[`${it.id}-${campo}`] ? it.errores[campo] : '');
                        const mensajes = ['cantidad', 'detalle', 'precio'].map(ver).filter(Boolean);
                        const idError = `item-${it.id}-error`;
                        const props = (campo) => ({
                          id: `item-${it.id}-${campo}`,
                          value: f.items[i][campo],
                          onChange: (e) => cambiarItem(it.id, campo, e.target.value),
                          onBlur: tocar(`${it.id}-${campo}`),
                          onKeyDown: alTeclearItem(i),
                          autoComplete: 'off',
                          'aria-invalid': ver(campo) ? 'true' : undefined,
                          'aria-describedby': ver(campo) ? idError : undefined,
                        });
                        return [
                          <tr key={it.id} id={`fila-${it.id}`} className="fila-item">
                            <td className="col-cant">
                              <label className="etiqueta-celda" htmlFor={`item-${it.id}-cantidad`}>
                                Cant.<span className="solo-lectores"> del ítem {it.n}</span>
                              </label>
                              <input {...props('cantidad')} inputMode="numeric" maxLength={2} />
                            </td>
                            <td className="col-detalle">
                              <label className="etiqueta-celda" htmlFor={`item-${it.id}-detalle`}>
                                Detalle<span className="solo-lectores"> del ítem {it.n}</span>
                              </label>
                              <input
                                {...props('detalle')} maxLength={MAX_TEXTO}
                                placeholder={i === 0 ? (comida ? 'Ej. 1/4 de pollo con papas' : 'Ej. Paracetamol 500 mg (caja)') : undefined}
                              />
                            </td>
                            <td className="col-precio">
                              <label className="etiqueta-celda" htmlFor={`item-${it.id}-precio`}>
                                Precio c/u<span className="solo-lectores"> del ítem {it.n}</span> <span className="opcional">(opcional)</span>
                              </label>
                              <div className="campo-precio">
                                <span aria-hidden="true">$</span>
                                <input {...props('precio')} inputMode="decimal" maxLength={9} placeholder="0.00" />
                              </div>
                            </td>
                            <td className="col-quitar">
                              <button
                                type="button" className="quitar-item" aria-label={`Quitar ítem ${it.n}`}
                                disabled={f.items.length === 1} onClick={() => quitarItem(i)}
                              >
                                <span aria-hidden="true">✕</span>
                              </button>
                            </td>
                          </tr>,
                          mensajes.length ? (
                            <tr key={`${it.id}-error`} className="fila-item-error">
                              <td colSpan={4}><p className="error" id={idError}>Ítem {it.n}: {mensajes.join(' ')}</p></td>
                            </tr>
                          ) : null,
                        ];
                      })}
                    </tbody>
                  </table>
                  <button type="button" className="agregar-item" onClick={agregarItem}>+ Agregar ítem</button>
                  <p className="tenue">Enter en la última fila agrega otra. Sin precio, ese ítem se guarda sin precio.</p>
                  {textoPedido.length > MAX_TEXTO * 0.8 ? (
                    <p className={textoPedido.length > MAX_TEXTO ? 'error' : 'tenue'} role="status">
                      Texto del pedido: {textoPedido.length}/{MAX_TEXTO} caracteres
                      {textoPedido.length > MAX_TEXTO ? '. Acorta los detalles o junta ítems.' : '.'}
                    </p>
                  ) : null}
                  {errores.items ? <p className="error" role="alert">{errores.items}</p> : null}
                </div>
                <label className="campo-check campo-ancho">
                  <input
                    type="checkbox" checked={pagar}
                    onChange={(e) => setF((prev) => ({ ...prev, pagar: e.target.checked }))}
                  />
                  El motorizado paga en el lugar{suma > 0 ? ` (aprox. ${dinero(suma)})` : ''}
                </label>
              </fieldset>

              <fieldset>
                <legend>¿A dónde se lleva?</legend>
                <Campo
                  id="campo-destinoDireccion" className="campo-ancho" etiqueta="Dirección" aria-required="true"
                  error={errores.destinoDireccion} maxLength={MAX_TEXTO} {...texto('destinoDireccion')}
                />
                <SelectorMapa etiqueta="Mapa de entrega" value={f.destino} onChange={elegirEnMapa('destino', 'destinoDireccion')} />
                <Campo
                  id="campo-destinoReferencia" className="campo-ancho" etiqueta="Referencia" opcional
                  error={errores.destinoReferencia} maxLength={MAX_TEXTO} {...texto('destinoReferencia')}
                />
                <div className="grupo-contacto campo-ancho">
                  <p>¿Quién recibe ahí? Vacío si es el propio cliente.</p>
                  <Campo
                    id="campo-entregaContactoNombre" etiqueta="Nombre" opcional error={errores.entregaContactoNombre}
                    maxLength={100} autoComplete="off" {...texto('entregaContactoNombre')}
                  />
                  {telefono('entregaContactoTelefono', 'Su teléfono', { opcional: true })}
                </div>
              </fieldset>

              <fieldset>
                <legend>Motorizado <span className="opcional">(opcional)</span></legend>
                {plegada ? (
                  <div className="campo-ancho moto-resumen">
                    <TarjetaMotorizado m={motoElegida ?? null} seleccionable titulo="Sin asignar" apoyo="Asignar después" />
                    <button
                      type="button" className="secundario" ref={botonCambiarMoto} aria-expanded="false" aria-controls="lista-motorizados"
                      onClick={() => { focoMoto.current = 'radio'; setMotoPlegada(false); }}
                    >
                      Cambiar motorizado
                    </button>
                  </div>
                ) : null}
                <div className={`campo-ancho moto-colapsable ${plegada ? 'plegada' : ''}`} inert={plegada}>
                  <div
                    id="lista-motorizados" ref={grupoMoto} className="moto-grupo" role="radiogroup" aria-label="Asignar a" aria-busy={motorizados === null}
                    onBlur={(e) => {
                      // Solo se pliega si el foco pasó a OTRO control (Tab fuera del grupo). Al presionar una tarjeta con el
                      // ratón el foco cae un instante en <main> (enfocable por el enlace "saltar al contenido"): plegar ahí
                      // movería la lista antes del clic y la selección no cambiaría.
                      const destino = e.relatedTarget;
                      const otroControl = destino?.matches?.('input, select, textarea, button, a[href]');
                      if (otroControl && !e.currentTarget.contains(destino) && (motoDecidida || f.motorizadoId !== '')) plegarMoto(null);
                    }}
                  >
                    {motorizados === null ? [0, 1, 2].map((i) => <TarjetaSkeleton key={i} />) : (
                      <>
                        <label className="moto-opcion">
                          <input
                            type="radio" name="motorizado" value="" checked={f.motorizadoId === ''}
                            onChange={() => cambiar('motorizadoId', '')} onKeyDown={(e) => teclaMoto(e, '')}
                            onClick={(e) => { if (e.detail > 0) plegarMoto('cambiar'); }}
                          />
                          <TarjetaMotorizado seleccionable titulo="Sin asignar" apoyo="Asignar después" />
                        </label>
                        {ordenadas.map((m) => (
                          <label className="moto-opcion" key={m.id}>
                            <input
                              type="radio" name="motorizado" value={m.id} checked={f.motorizadoId === String(m.id)}
                              onChange={() => cambiar('motorizadoId', String(m.id))} onKeyDown={(e) => teclaMoto(e, String(m.id))}
                              onClick={(e) => { if (e.detail > 0) plegarMoto('cambiar'); }}
                            />
                            <TarjetaMotorizado m={m} seleccionable />
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                </div>
                {motorizados === null ? <p className="solo-lectores" role="status">Cargando motorizados…</p> : null}
                {Array.isArray(motorizados) && !motorizados.length ? <p className="tenue campo-ancho">No hay motorizados registrados.</p> : null}
                {motorizados === 'error' ? (
                  <p className="error campo-ancho" role="alert">
                    No se pudieron cargar los motorizados; puedes crear el pedido y asignarlo en Despacho.{' '}
                    <button type="button" className="enlace" onClick={cargarMotorizados}>Reintentar</button>
                  </p>
                ) : null}
              </fieldset>
            </div>

            {ancho ? (
              <aside className="ticket" aria-labelledby="ticket-titulo">
                <h2 id="ticket-titulo">Ticket del pedido</h2>
                <dl>
                  <Linea etiqueta="Tipo" valor={comida ? 'Comida' : 'Encargo'} />
                  <Linea
                    etiqueta="Cliente"
                    valor={normalizarTelefono(f.clienteTelefono)
                      ? `${normalizarTelefono(f.clienteTelefono)}${f.clienteNombre.trim() ? ` · ${f.clienteNombre.trim()}` : ''}`
                      : '—'}
                  />
                  <Linea etiqueta="Recogida" valor={(comida ? nombreLocal : f.recogidaDireccion.trim()) || '—'} />
                  <Linea etiqueta="Entrega" valor={f.destinoDireccion.trim() || '—'} />
                  <Linea etiqueta="Motorizado" valor={motoElegida ? motoElegida.nombre : 'Sin asignar'} extra={motoElegida ? <EstadoMotorizado m={motoElegida} /> : null} />
                </dl>
                {validas.length ? (
                  <ul className="ticket-items" aria-label="Ítems">
                    {validas.map((x) => (
                      <li key={x.id}>
                        <span>{Number.isNaN(x.cantidad) ? '?' : x.cantidad} × {x.detalle}</span>
                        <span>
                          {x.precio !== null && !Number.isNaN(x.precio) && !Number.isNaN(x.cantidad)
                            ? dinero(x.cantidad * centavos(x.precio)) : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <dl className="ticket-totales">
                  <Linea
                    etiqueta={sinPrecio && conPrecio.length ? `Productos (${sinPrecio} sin precio)` : 'Productos'}
                    valor={conPrecio.length ? `${dinero(suma)} aprox.` : 'Sin precios'}
                  />
                  <Linea etiqueta="Envío" valor={textoEnvio} />
                  <Linea
                    className="ticket-total" etiqueta="Cobrar al cliente"
                    valor={cobrar === null ? '—' : `${dinero(cobrar)}${sinPrecio ? ' + ítems sin precio' : ''} aprox.`}
                  />
                </dl>
                <ul className="ticket-checklist" aria-label="Qué falta">
                  {pasos.map((p) => <PasoChecklist key={p.nombre} {...p} />)}
                </ul>
                <p className="solo-lectores" id="pedido-faltan">{textoFaltan}</p>
                {errorGeneral ? <p className="error" role="alert">{errorGeneral}</p> : null}
                {boton}
              </aside>
            ) : (
              <div className="pedido-pie">
                {errorGeneral ? <p className="error" role="alert">{errorGeneral}</p> : null}
                <div className="pedido-pie-texto">
                  <span className={`pedido-envio ${envioListo ? '' : 'pendiente'}`} role="status">
                    Envío: {textoEnvio}
                    {cobrar !== null && conPrecio.length ? <span className="pie-cobrar"> · cobrar ≈ {dinero(cobrar)}{sinPrecio ? ' + ítems sin precio' : ''}</span> : null}
                  </span>
                  {/* Texto completo: visible desde 768 px; en celular solo para lectores (y para aria-describedby). */}
                  <p className="pedido-faltan" id="pedido-faltan" role="status">{textoFaltan}</p>
                  {completo ? null : (
                    <details className="pedido-faltan-detalle">
                      <summary>Faltan {faltantes.length} {faltantes.length === 1 ? 'dato' : 'datos'}</summary>
                      <ul>{faltantes.map((x) => <li key={x}>{x}</li>)}</ul>
                    </details>
                  )}
                </div>
                {boton}
              </div>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
