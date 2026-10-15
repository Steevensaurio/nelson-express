import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { useTiempoReal } from '../useTiempoReal.js';
import Barra from '../components/Barra.jsx';
import Modal from '../components/Modal.jsx';
import { TarjetaMotorizado, ordenarMotorizados } from '../components/TarjetaMotorizado.jsx';
import { MOSTRAR_PRECIOS } from '../config.js';
import { BP, anchoMinimo, useMedia } from '../useMedia.js';

const INTERVALO_MS = 5000;
const INTERVALO_RESPALDO_MS = 30000;

const ETIQUETA_ESTADO = {
  PENDIENTE: 'Pendiente',
  ACEPTADO: 'Aceptado',
  RECOGIDO: 'Recogido',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

const ICONO_ESTADO = { ENTREGADO: '✓', EN_CAMINO: '➜', CANCELADO: '✕' };

const ESTADOS_FINALES = ['ENTREGADO', 'CANCELADO'];
const esFinal = (pedido) => ESTADOS_FINALES.includes(pedido.estado);
// Debe coincidir con ESTADOS_CANCELABLES del backend: con la comida ya recogida no se cancela.
const esCancelable = (pedido) => ['PENDIENTE', 'ACEPTADO'].includes(pedido.estado);

const FILTROS = [
  { id: 'todos', texto: 'Todos', coincide: () => true },
  { id: 'sin-asignar', texto: 'Sin asignar', coincide: (p) => !esFinal(p) && !p.motorizado },
  { id: 'en-curso', texto: 'En curso', coincide: (p) => !esFinal(p) && p.motorizado },
  { id: 'finalizados', texto: 'Finalizados', coincide: esFinal },
];

const dosDigitos = (n) => String(n).padStart(2, '0');

const formatearFecha = (iso) => {
  const f = new Date(iso);
  return `${dosDigitos(f.getDate())}/${dosDigitos(f.getMonth() + 1)} ${dosDigitos(f.getHours())}:${dosDigitos(f.getMinutes())}`;
};

const haceTiempo = (iso) => {
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutos < 1) return 'hace un momento';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} d`;
};

const mensajeDeError = (err) => {
  const datos = err.response?.data;
  return datos?.detail ?? datos?.motorizado?.[0] ?? 'No se pudo asignar el pedido.';
};

// La tabla de 8 columnas necesita ~1150 px para leerse sin apretar el selector; por debajo, tarjetas.
const CONSULTA_TABLA = anchoMinimo(BP.tablaDespacho);
// Celular chico: el selector de motorizado se abre como hoja inferior (mismo límite que .modal en styles.css).
const CONSULTA_HOJA = '(max-width: 479px)';

const dinero = (n) => `$${Number(n).toFixed(2)}`;

const Telefono = ({ numero, className = '' }) =>
  numero ? <a className={`telefono ${className}`} href={`tel:${numero}`}>{numero}</a> : null;

const Contacto = ({ prefijo, contacto }) => (
  <div className="tenue">
    {prefijo}: {contacto.nombre}
    {contacto.telefono ? <> · <Telefono numero={contacto.telefono} /></> : null}
  </div>
);

function Importe({ p }) {
  if (MOSTRAR_PRECIOS) {
    return (
      <>
        {dinero(p.total)}
        {p.costo_envio != null ? <div className="tenue">envío {dinero(p.costo_envio)}</div> : null}
      </>
    );
  }
  return p.costo_envio != null ? dinero(p.costo_envio) : '—';
}

const Insignia = ({ estado }) => (
  <span className={`insignia ${estado}`}>
    <span aria-hidden="true" className="insignia-icono">{ICONO_ESTADO[estado] ?? '•'}</span>
    {ETIQUETA_ESTADO[estado]}
  </span>
);

const IconoCaja = () => (
  <svg className="recogida-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4zM3.5 7.5 12 11.5l8.5-4M12 11.5v9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

const Chevron = ({ abajo = false }) => (
  <svg className="chevron" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d={abajo ? 'M5.5 8l4.5 4.5L14.5 8' : 'M8 5.5l4.5 4.5L8 14.5'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Lo único de la recogida que va en la fila: "Encargo" o el nombre del negocio. Abre el detalle completo.
function BotonRecogida({ p, onAbrir }) {
  const encargo = p.tipo === 'ENCARGO';
  return (
    <div className="recogida">
      <button type="button" className="recogida-boton" aria-haspopup="dialog" onClick={() => onAbrir(p)}>
        {encargo ? <IconoCaja /> : null}
        <span className="recogida-nombre">{encargo ? 'Encargo' : (p.negocio?.nombre ?? p.recogida.nombre)}</span>
        <span className="solo-lectores">, ver detalle del pedido {p.id}</span>
        <Chevron />
      </button>
      {p.pagar_en_recogida ? <span className="etiqueta-paga">Paga en el local</span> : null}
    </div>
  );
}

// Selector de motorizado: botón con la tarjeta del asignado que abre una lista (listbox) de tarjetas.
// En celular chico la lista va en una hoja inferior (Modal); si no, en un popover fijo que se voltea hacia
// arriba si no cabe abajo y se cierra al hacer clic fuera, al desplazar o al redimensionar.
function SelectorMotorizado({ p, motorizados, asignando, onAsignar }) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [pos, setPos] = useState(null);
  const caja = useRef(null);
  const boton = useRef(null);
  const lista = useRef(null);
  const hoja = useMedia(CONSULTA_HOJA);

  // El asignado puede no estar en la lista (p. ej. dado de baja): se sigue mostrando, sin estado.
  const asignado = p.motorizado ? (motorizados.find((m) => m.id === p.motorizado.id) ?? p.motorizado) : null;
  const notaDe = (m) => (m && m.entregas_activas == null ? 'Asignado' : undefined);
  const valorActual = p.motorizado ? String(p.motorizado.id) : '';
  const opciones = [
    { valor: '', m: null },
    ...(asignado && asignado.entregas_activas == null ? [{ valor: valorActual, m: asignado }] : []),
    ...ordenarMotorizados(motorizados).map((m) => ({ valor: String(m.id), m })),
  ];

  const idLista = `lista-moto-${p.id}`;
  const idOpcion = (i) => `${idLista}-${i}`;

  const cerrar = (devolverFoco) => {
    setAbierto(false);
    setPos(null);
    if (devolverFoco && !hoja) boton.current?.focus();
  };

  useLayoutEffect(() => {
    if (!abierto || hoja) return;
    const r = boton.current.getBoundingClientRect();
    const anchoVista = document.documentElement.clientWidth;
    const altoVista = window.innerHeight;
    const ancho = Math.min(Math.max(r.width, 300), anchoVista - 16);
    const left = Math.min(Math.max(8, r.left), anchoVista - ancho - 8);
    const abajo = altoVista - r.bottom - 14;
    const arriba = r.top - 14;
    const alto = Math.min(lista.current.scrollHeight, 380);
    const haciaArriba = alto > abajo && arriba > abajo;
    setPos({
      left,
      width: ancho,
      maxHeight: Math.min(alto, haciaArriba ? arriba : abajo),
      ...(haciaArriba
        ? { bottom: altoVista - r.top + 6, transformOrigin: 'bottom' }
        : { top: r.bottom + 6, transformOrigin: 'top' }),
    });
  }, [abierto, hoja]);

  // El foco entra a la lista cuando ya es visible (en el popover, tras medir su posición).
  const visible = abierto && (hoja || pos != null);
  useEffect(() => {
    if (visible) lista.current?.focus({ preventScroll: true });
  }, [visible]);

  useEffect(() => {
    if (!abierto || hoja) return undefined;
    const alPulsarFuera = (e) => { if (!caja.current.contains(e.target)) cerrar(false); };
    const alDesplazar = (e) => { if (e.target !== lista.current) cerrar(false); };
    const alRedimensionar = () => cerrar(false);
    document.addEventListener('pointerdown', alPulsarFuera);
    window.addEventListener('scroll', alDesplazar, true);
    window.addEventListener('resize', alRedimensionar);
    return () => {
      document.removeEventListener('pointerdown', alPulsarFuera);
      window.removeEventListener('scroll', alDesplazar, true);
      window.removeEventListener('resize', alRedimensionar);
    };
  }, [abierto, hoja]);

  // Mantiene la opción activa a la vista dentro de la lista (sin scrollIntoView, que movería la página).
  useEffect(() => {
    const l = lista.current;
    const el = abierto && l ? document.getElementById(idOpcion(activo)) : null;
    if (!el) return;
    if (el.offsetTop < l.scrollTop) l.scrollTop = el.offsetTop;
    else if (el.offsetTop + el.offsetHeight > l.scrollTop + l.clientHeight) l.scrollTop = el.offsetTop + el.offsetHeight - l.clientHeight;
  }, [abierto, activo, pos]);

  if (esFinal(p)) {
    return asignado ? (
      <div className="selector-moto fijo">
        <TarjetaMotorizado m={asignado} nota={p.estado === 'ENTREGADO' ? 'Entregó' : 'Asignado'} />
      </div>
    ) : <span className="tenue">—</span>;
  }

  const ocupado = asignando?.id === p.id;
  const mostrado = ocupado ? (opciones.find((o) => o.valor === asignando.valor)?.m ?? null) : asignado;

  const abrir = () => {
    if (ocupado) return;
    setActivo(Math.max(0, opciones.findIndex((o) => o.valor === valorActual)));
    setAbierto(true);
  };

  const elegir = (valor) => {
    cerrar(true);
    if (valor !== valorActual) onAsignar(p, valor);
  };

  const alTeclearLista = (e) => {
    const ultimo = opciones.length - 1;
    const destino = { ArrowDown: Math.min(activo + 1, ultimo), ArrowUp: Math.max(activo - 1, 0), Home: 0, End: ultimo }[e.key];
    if (destino != null) {
      e.preventDefault();
      setActivo(destino);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      elegir(opciones[activo].valor);
    } else if (e.key === 'Escape') {
      // Que no llegue a los Modal abiertos (escuchan Esc en document): solo se cierra la lista.
      e.stopPropagation();
      cerrar(true);
    } else if (e.key === 'Tab' && !hoja) {
      cerrar(false);
    }
  };

  const listbox = (
    <ul
      ref={lista}
      id={idLista}
      role="listbox"
      tabIndex={0}
      className={`lista-moto ${hoja ? '' : 'flotante'}`}
      aria-label={`Motorizado del pedido ${p.id}`}
      aria-activedescendant={idOpcion(activo)}
      onKeyDown={alTeclearLista}
      style={hoja ? undefined : (pos ?? { visibility: 'hidden', top: 0, left: 0 })}
    >
      {opciones.map((o, i) => (
        <li
          key={o.valor || 'ninguno'}
          id={idOpcion(i)}
          role="option"
          aria-selected={o.valor === valorActual}
          className={i === activo ? 'activa' : ''}
          onClick={() => elegir(o.valor)}
          onPointerMove={() => i !== activo && setActivo(i)}
        >
          <TarjetaMotorizado m={o.m} seleccionable titulo="Sin asignar" apoyo="Queda pendiente" nota={notaDe(o.m)} />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="selector-caja" ref={caja}>
      <button
        ref={boton}
        type="button"
        className={`selector-moto ${mostrado ? '' : 'sin-moto'}`}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? idLista : undefined}
        aria-disabled={ocupado || undefined}
        aria-busy={ocupado || undefined}
        onClick={() => (abierto ? cerrar(false) : abrir())}
        onKeyDown={(e) => {
          if (!abierto && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            abrir();
          } else if (abierto && e.key === 'Escape') {
            e.stopPropagation();
            cerrar(true);
          }
        }}
      >
        <span className="solo-lectores">Motorizado del pedido {p.id}: </span>
        <TarjetaMotorizado m={mostrado} titulo="Sin asignar" apoyo="Asignar" nota={ocupado ? 'Asignando…' : notaDe(mostrado)} />
        <Chevron abajo />
      </button>
      {abierto ? (
        hoja ? (
          <Modal titulo={`Motorizado del pedido #${p.id}`} idTitulo={`titulo-${idLista}`} className="modal-hoja-moto" onCerrar={() => cerrar(false)}>
            {listbox}
          </Modal>
        ) : listbox
      ) : null}
    </div>
  );
}

// Ficha completa del pedido: todo lo que no va en la fila. Sale del pedido ya cargado (sin otra petición).
function DetallePedido({ p, selector, onCancelar, onCerrar }) {
  const encargo = p.tipo === 'ENCARGO';
  const contacto = (prefijo, c) =>
    c ? <p>{prefijo}: {c.nombre}{c.telefono ? <> · <Telefono numero={c.telefono} /></> : null}</p> : null;
  return (
    <Modal titulo={`Pedido #${p.id}`} idTitulo="titulo-detalle" className="modal-detalle" enfocarDialogo onCerrar={onCerrar}>
      <div className="detalle-estado">
        <Insignia estado={p.estado} />
        <span className="tenue">{formatearFecha(p.creado_en)} · {haceTiempo(p.creado_en)}</span>
      </div>
      {p.estado === 'CANCELADO' && p.motivo_cancelacion ? (
        <p className="detalle-motivo">Motivo de cancelación: {p.motivo_cancelacion}</p>
      ) : null}

      <section className="detalle-seccion" aria-labelledby="detalle-recogida">
        <h3 id="detalle-recogida">Recogida</h3>
        {encargo ? (
          <>
            <p className="detalle-fuerte"><IconoCaja /> Encargo</p>
            {p.descripcion ? <p className="texto-pedido">{p.descripcion}</p> : null}
            <p>{p.recogida.direccion}</p>
            {p.recogida.referencia ? <p className="tenue cursiva">{p.recogida.referencia}</p> : null}
            {contacto('Entrega', p.recogida_contacto)}
          </>
        ) : (
          <>
            <p className="detalle-fuerte">
              {p.negocio?.nombre ?? p.recogida.nombre}
              {p.sucursal ? <span className="tenue"> · {p.sucursal.nombre}</span> : null}
            </p>
            <p>{p.sucursal?.direccion ?? p.recogida.direccion}</p>
            <ul className="detalle-productos">
              {p.detalles.map((d, i) => (
                <li key={i}>
                  <span>{d.cantidad} x {d.producto_nombre}</span>
                  {MOSTRAR_PRECIOS ? <span>{dinero(d.precio_unitario * d.cantidad)}</span> : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="detalle-seccion" aria-labelledby="detalle-entrega">
        <h3 id="detalle-entrega">Entrega</h3>
        <p>{p.destino_direccion}</p>
        {p.destino_referencia ? <p className="tenue cursiva">{p.destino_referencia}</p> : null}
        {contacto('Recibe', p.entrega_contacto)}
      </section>

      <section className="detalle-seccion" aria-labelledby="detalle-cliente">
        <h3 id="detalle-cliente">Cliente</h3>
        <p>{p.cliente.nombre}</p>
        <p>
          {p.cliente.telefono
            ? <Telefono numero={p.cliente.telefono} className="telefono-grande" />
            : <span className="tenue">Sin teléfono</span>}
        </p>
      </section>

      <section className="detalle-seccion" aria-labelledby="detalle-pago">
        <h3 id="detalle-pago">Pago</h3>
        <p>Envío: {p.costo_envio != null ? dinero(p.costo_envio) : '—'}</p>
        {MOSTRAR_PRECIOS ? <p>Total: {dinero(p.total)}</p> : null}
        {p.pagar_en_recogida ? <p className="detalle-paga">Motorizado paga aprox. {dinero(p.monto_estimado)} en el local</p> : null}
      </section>

      <section className="detalle-seccion" aria-labelledby="detalle-motorizado">
        <h3 id="detalle-motorizado">Motorizado</h3>
        {selector}
      </section>

      <div className="modal-acciones">
        {esCancelable(p) ? <button type="button" className="peligro" onClick={() => onCancelar(p)}>Cancelar pedido</button> : null}
        <button type="button" className="secundario" onClick={onCerrar}>Cerrar</button>
      </div>
    </Modal>
  );
}

export default function Despacho() {
  const { token } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [motorizados, setMotorizados] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [asignando, setAsignando] = useState(null);
  const [error, setError] = useState('');
  const [sinConexion, setSinConexion] = useState(false);
  const [actualizado, setActualizado] = useState(null);
  const [aCancelar, setACancelar] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [detalleId, setDetalleId] = useState(null);
  const ocupado = useRef(false);

  const cargar = useCallback(async () => {
    if (ocupado.current) return;
    try {
      const [resPedidos, resMotorizados] = await Promise.all([
        api.get('/despacho/pedidos/'),
        api.get('/despacho/motorizados/'),
      ]);
      setPedidos(resPedidos.data);
      setMotorizados(resMotorizados.data);
      setSinConexion(false);
      setActualizado(new Date());
    } catch (err) {
      setSinConexion(true);
    }
  }, []);

  const enVivo = useTiempoReal(token, cargar);

  // Con el socket conectado el sondeo es solo un respaldo; sin él vuelve al ritmo rápido.
  const intervalo = enVivo ? INTERVALO_RESPALDO_MS : INTERVALO_MS;

  useEffect(() => {
    cargar();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') cargar();
    }, intervalo);
    return () => clearInterval(id);
  }, [cargar, intervalo]);

  const asignar = async (pedido, valor) => {
    const motorizadoId = valor === '' ? null : Number(valor);
    setError('');
    setAsignando({ id: pedido.id, valor });
    ocupado.current = true;
    try {
      const { data } = await api.patch(`/despacho/pedidos/${pedido.id}/asignar/`, { motorizado: motorizadoId });
      setPedidos((prev) => prev.map((p) => (p.id === data.id ? data : p)));
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      ocupado.current = false;
      setAsignando(null);
    }
    cargar();
  };

  const abrirCancelacion = (pedido) => {
    setMotivo('');
    setACancelar(pedido);
  };

  const confirmarCancelacion = async () => {
    setError('');
    setCancelando(true);
    ocupado.current = true;
    try {
      const { data } = await api.post(`/despacho/pedidos/${aCancelar.id}/cancelar/`, { motivo });
      setPedidos((prev) => prev.map((p) => (p.id === data.id ? data : p)));
    } catch (err) {
      setError(err.response?.data?.detail ?? err.response?.data?.motivo?.[0] ?? 'No se pudo cancelar el pedido.');
    } finally {
      ocupado.current = false;
      setCancelando(false);
      setACancelar(null);
    }
    cargar();
  };

  // Cancelar desde el detalle: primero se cierra (el foco vuelve a la fila) y luego se abre la cancelación,
  // que así devuelve el foco a la fila al terminar y no a un botón que ya no existe.
  const cancelarDesdeDetalle = (pedido) => {
    setDetalleId(null);
    setTimeout(() => abrirCancelacion(pedido), 0);
  };

  const enDetalle = pedidos.find((p) => p.id === detalleId);
  const verDetalle = (p) => setDetalleId(p.id);

  const visibles = pedidos.filter(FILTROS.find((f) => f.id === filtro).coincide);
  const enTabla = useMedia(CONSULTA_TABLA);
  const selector = (p) => (
    <SelectorMotorizado p={p} motorizados={motorizados} asignando={asignando} onAsignar={asignar} />
  );
  const botonCancelar = (p) =>
    esCancelable(p) ? (
      <button className="peligro" aria-label={`Cancelar pedido ${p.id}`} onClick={() => abrirCancelacion(p)}>Cancelar</button>
    ) : null;

  // Antes de la primera respuesta no se sabe si hay pedidos: no se muestra "no hay" hasta tenerla.
  const sinPedidos = actualizado
    ? 'No hay pedidos en esta vista.'
    : sinConexion
      ? 'No se pudieron cargar los pedidos. Se reintenta solo.'
      : 'Cargando pedidos…';

  return (
    <div className="pagina">
      <Barra />

      <main className="contenido" id="contenido" tabIndex={-1}>
        <h1 className="solo-lectores">Despacho</h1>
        <div className="avisos" role="status">
          {sinConexion ? <p className="aviso">Sin conexión con el servidor. Reintentando…</p> : null}
        </div>
        {error ? (
          <p className="error-banner" role="alert">
            {error} <button className="enlace" onClick={() => setError('')}>Cerrar</button>
          </p>
        ) : null}

        <section className="resumen" aria-label="Filtrar pedidos">
          {FILTROS.map((f) => {
            const cantidad = pedidos.filter(f.coincide).length;
            return (
              <button
                key={f.id}
                className={`resumen-tarjeta tarjeta-${f.id} ${filtro === f.id ? 'activa' : ''} ${f.id === 'sin-asignar' && cantidad > 0 ? 'urgente' : ''}`}
                aria-pressed={filtro === f.id}
                onClick={() => setFiltro(f.id)}
              >
                <span className="resumen-numero">{cantidad}</span>
                <span className="resumen-texto">{f.texto}</span>
              </button>
            );
          })}
        </section>

        <section className="motorizados">
          <h2>Motorizados</h2>
          {motorizados.length === 0 ? <p className="tenue">No hay motorizados registrados.</p> : null}
          {/* En celular la lista se desliza de lado: enfocable para poder desplazarla con el teclado. */}
          <ul tabIndex={0} aria-label="Motorizados y su estado">
            {ordenarMotorizados(motorizados).map((m) => (
              <li key={m.id}><TarjetaMotorizado m={m} /></li>
            ))}
          </ul>
        </section>

        <section className="tabla-caja" aria-labelledby="titulo-pedidos">
          <div className="tabla-encabezado">
            <h2 id="titulo-pedidos">Pedidos</h2>
            <span className="tenue">
              <span className={`punto-vivo ${enVivo ? 'activo' : ''}`} aria-hidden="true" />
              <span>{enVivo ? 'En vivo' : `Sin tiempo real · cada ${INTERVALO_MS / 1000} s`}</span>
              {actualizado ? ` · Actualizado ${actualizado.toLocaleTimeString()}` : ' · Cargando…'}
            </span>
          </div>

          {!enTabla ? (
            visibles.length === 0 ? (
              <p className="vacio">{sinPedidos}</p>
            ) : (
              <ul className="tarjetas-pedidos" aria-label="Pedidos, del más reciente al más antiguo">
                {visibles.map((p) => {
                  const necesitaAtencion = !esFinal(p) && !p.motorizado;
                  const encargo = p.tipo === 'ENCARGO';
                  return (
                    <li key={p.id}>
                      <article className={`tarjeta-pedido ${necesitaAtencion ? 'atencion' : ''}`} aria-labelledby={`pedido-${p.id}`}>
                        <div className="tarjeta-cabeza">
                          <div>
                            <h3 id={`pedido-${p.id}`}>Pedido #{p.id}</h3>
                            <span className="tenue">{formatearFecha(p.creado_en)}</span>
                          </div>
                          <Insignia estado={p.estado} />
                        </div>
                        {necesitaAtencion ? (
                          <p className="tarjeta-aviso">Sin motorizado · {haceTiempo(p.creado_en)}</p>
                        ) : null}

                        <dl className="tarjeta-datos">
                          <div>
                            <dt>Recogida</dt>
                            <dd><BotonRecogida p={p} onAbrir={verDetalle} /></dd>
                          </div>
                          <div>
                            <dt>Cliente</dt>
                            <dd>
                              <strong>{p.cliente.nombre}</strong>
                              <div>
                                {p.cliente.telefono
                                  ? <Telefono numero={p.cliente.telefono} className="telefono-grande" />
                                  : <span className="tenue">Sin teléfono</span>}
                              </div>
                            </dd>
                          </div>
                          <div>
                            <dt>Entrega</dt>
                            <dd>
                              <div>{p.destino_direccion}</div>
                              {p.destino_referencia ? <div className="tenue cursiva">{p.destino_referencia}</div> : null}
                              {encargo ? <Contacto prefijo="Recibe" contacto={p.entrega_contacto} /> : null}
                            </dd>
                          </div>
                          <div>
                            <dt>{MOSTRAR_PRECIOS ? 'Total' : 'Envío'}</dt>
                            <dd><strong><Importe p={p} /></strong></dd>
                          </div>
                        </dl>

                        <div className="tarjeta-acciones">
                          <span className="tarjeta-acciones-titulo" aria-hidden="true">Motorizado</span>
                          {selector(p)}
                          {botonCancelar(p)}
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            <div className="tabla-scroll" tabIndex={0} role="region" aria-label="Tabla de pedidos">
              <table className="tabla-despacho">
                <caption className="solo-lectores">Pedidos, del más reciente al más antiguo</caption>
                <thead>
                  <tr>
                    <th scope="col">Pedido</th>
                    <th scope="col">Recogida</th>
                    <th scope="col">Cliente</th>
                    <th scope="col">Entrega</th>
                    <th scope="col" className="derecha">{MOSTRAR_PRECIOS ? 'Total' : 'Envío'}</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Motorizado</th>
                    <th scope="col"><span className="solo-lectores">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((p) => {
                    const necesitaAtencion = !esFinal(p) && !p.motorizado;
                    return (
                      <tr key={p.id} className={necesitaAtencion ? 'fila-atencion' : ''}>
                        <td>
                          <strong>Pedido #{p.id}</strong>
                          <div className="tenue">{formatearFecha(p.creado_en)}</div>
                          {necesitaAtencion ? <div className="hace">{haceTiempo(p.creado_en)}</div> : null}
                        </td>
                        <td><BotonRecogida p={p} onAbrir={verDetalle} /></td>
                        <td>
                          <div className="clamp" title={p.cliente.nombre}>{p.cliente.nombre}</div>
                          <div className="tenue">
                            {p.cliente.telefono ? <Telefono numero={p.cliente.telefono} /> : 'Sin teléfono'}
                          </div>
                        </td>
                        <td>
                          <div className="clamp" title={p.destino_direccion}>{p.destino_direccion}</div>
                          {p.destino_referencia ? <div className="tenue cursiva clamp" title={p.destino_referencia}>{p.destino_referencia}</div> : null}
                          {p.tipo === 'ENCARGO' ? <Contacto prefijo="Recibe" contacto={p.entrega_contacto} /> : null}
                        </td>
                        <td className="derecha"><Importe p={p} /></td>
                        <td><Insignia estado={p.estado} /></td>
                        <td>{selector(p)}</td>
                        <td>{botonCancelar(p)}</td>
                      </tr>
                    );
                  })}
                  {visibles.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="vacio">{sinPedidos}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {enDetalle ? (
        <DetallePedido
          p={enDetalle}
          selector={selector(enDetalle)}
          onCancelar={cancelarDesdeDetalle}
          onCerrar={() => setDetalleId(null)}
        />
      ) : null}

      {aCancelar ? (
        <Modal
          titulo={`Cancelar pedido #${aCancelar.id}`}
          idTitulo="titulo-cancelar"
          onCerrar={() => !cancelando && setACancelar(null)}
        >
          <p className="tenue">
            {aCancelar.recogida.nombre} · {aCancelar.cliente.nombre}. El cliente y el motorizado verán el cambio al instante.
          </p>
          <label htmlFor="motivo">Motivo (opcional)</label>
          <textarea
            id="motivo"
            value={motivo}
            maxLength={255}
            rows={3}
            autoFocus
            placeholder="Ej.: el cliente llamó para anular"
            onChange={(e) => setMotivo(e.target.value)}
          />
          <div className="modal-acciones">
            <button className="secundario" disabled={cancelando} onClick={() => setACancelar(null)}>Volver</button>
            <button className="peligro solido" disabled={cancelando} onClick={confirmarCancelacion}>
              {cancelando ? 'Cancelando…' : 'Cancelar pedido'}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
