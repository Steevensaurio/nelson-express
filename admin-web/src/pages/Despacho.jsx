import { useCallback, useEffect, useRef, useState } from 'react';
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

const productos = (p) => p.detalles.map((d) => `${d.cantidad} x ${d.producto_nombre}`).join(', ');

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
        ${Number(p.total).toFixed(2)}
        {p.costo_envio != null ? <div className="tenue">envío ${Number(p.costo_envio).toFixed(2)}</div> : null}
      </>
    );
  }
  return p.costo_envio != null ? `$${Number(p.costo_envio).toFixed(2)}` : '—';
}

const Insignia = ({ estado }) => (
  <span className={`insignia ${estado}`}>
    <span aria-hidden="true" className="insignia-icono">{ICONO_ESTADO[estado] ?? '•'}</span>
    {ETIQUETA_ESTADO[estado]}
  </span>
);

function SelectorMotorizado({ p, motorizados, asignando, onAsignar, ...props }) {
  const asignadoFueraDeLista = p.motorizado && !motorizados.some((m) => m.id === p.motorizado.id);
  return (
    <select
      value={p.motorizado?.id ?? ''}
      disabled={esFinal(p) || asignando === p.id}
      onChange={(e) => onAsignar(p, e.target.value)}
      {...props}
    >
      <option value="">— Sin asignar —</option>
      {asignadoFueraDeLista ? <option value={p.motorizado.id}>{p.motorizado.nombre}</option> : null}
      {motorizados.map((m) => (
        <option key={m.id} value={m.id}>
          {m.nombre} · {m.entregas_activas === 0 ? 'libre' : `${m.entregas_activas} en curso`}
        </option>
      ))}
    </select>
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
    setAsignando(pedido.id);
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

  const visibles = pedidos.filter(FILTROS.find((f) => f.id === filtro).coincide);
  const enTabla = useMedia(CONSULTA_TABLA);
  const selector = (p, props) => (
    <SelectorMotorizado p={p} motorizados={motorizados} asignando={asignando} onAsignar={asignar} {...props} />
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
          <ul>
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
                        {p.estado === 'CANCELADO' && p.motivo_cancelacion ? (
                          <p className="tenue cursiva">Motivo: {p.motivo_cancelacion}</p>
                        ) : null}

                        <dl className="tarjeta-datos">
                          <div>
                            <dt>Recogida</dt>
                            <dd>
                              <strong>{p.recogida.nombre}</strong>
                              {encargo ? (
                                <>
                                  <div className="texto-pedido">{p.descripcion}</div>
                                  <div className="tenue">{p.recogida.direccion}</div>
                                  <Contacto prefijo="Entrega" contacto={p.recogida_contacto} />
                                  {p.pagar_en_recogida ? (
                                    <div className="hace">Motorizado paga aprox. ${Number(p.monto_estimado).toFixed(2)}</div>
                                  ) : null}
                                </>
                              ) : (
                                <div className="tenue">{productos(p)}</div>
                              )}
                            </dd>
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
                          <label htmlFor={`motorizado-${p.id}`}>Motorizado</label>
                          {selector(p, { id: `motorizado-${p.id}` })}
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
                      <tr key={p.id} className={`${p.tipo === 'ENCARGO' ? 'fila-encargo' : 'fila-comida'} ${necesitaAtencion ? 'fila-atencion' : ''}`}>
                        <td>
                          <strong>Pedido #{p.id}</strong>
                          <div className="tenue">{formatearFecha(p.creado_en)}</div>
                          {necesitaAtencion ? <div className="hace">{haceTiempo(p.creado_en)}</div> : null}
                        </td>
                        <td>
                          {p.recogida.nombre}
                          {p.tipo === 'ENCARGO' ? (
                            <>
                              <div className="tenue clamp texto-pedido" title={p.descripcion}>{p.descripcion}</div>
                              <Contacto prefijo="Entrega" contacto={p.recogida_contacto} />
                              <div className="tenue clamp" title={p.recogida.direccion}>{p.recogida.direccion}</div>
                              {p.pagar_en_recogida ? (
                                <div className="hace">Motorizado paga aprox. ${Number(p.monto_estimado).toFixed(2)}</div>
                              ) : null}
                            </>
                          ) : (
                            <div className="tenue clamp" title={productos(p)}>{productos(p)}</div>
                          )}
                        </td>
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
                        <td>
                          <Insignia estado={p.estado} />
                          {p.estado === 'CANCELADO' && p.motivo_cancelacion ? (
                            <div className="tenue cursiva motivo">{p.motivo_cancelacion}</div>
                          ) : null}
                        </td>
                        <td>{selector(p, { 'aria-label': `Motorizado del pedido ${p.id}` })}</td>
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
