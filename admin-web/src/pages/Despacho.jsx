import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { useTiempoReal } from '../useTiempoReal.js';
import Barra from '../components/Barra.jsx';
import { MOSTRAR_PRECIOS } from '../config.js';

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

  return (
    <div className="pagina">
      <Barra />

      <main className="contenido">
        {sinConexion ? <p className="aviso">Sin conexión con el servidor. Reintentando…</p> : null}
        {error ? (
          <p className="error-banner">
            {error} <button className="enlace" onClick={() => setError('')}>Cerrar</button>
          </p>
        ) : null}

        <section className="resumen">
          {FILTROS.map((f) => {
            const cantidad = pedidos.filter(f.coincide).length;
            return (
              <button
                key={f.id}
                className={`resumen-tarjeta ${filtro === f.id ? 'activa' : ''} ${f.id === 'sin-asignar' && cantidad > 0 ? 'urgente' : ''}`}
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
            {motorizados.map((m) => (
              <li key={m.id} className={m.entregas_activas === 0 ? 'libre' : 'ocupado'}>
                <strong>{m.nombre}</strong>
                <span>{m.entregas_activas === 0 ? 'Libre' : `${m.entregas_activas} en curso`}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="tabla-caja">
          <div className="tabla-encabezado">
            <h2>Pedidos</h2>
            <span className="tenue">
              <span className={`punto-vivo ${enVivo ? 'activo' : ''}`} />
              {enVivo ? 'En vivo' : `Sin tiempo real · cada ${INTERVALO_MS / 1000} s`}
              {actualizado ? ` · ${actualizado.toLocaleTimeString()}` : ' · Cargando…'}
            </span>
          </div>

          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Recogida</th>
                  <th>Cliente</th>
                  <th>Entrega</th>
                  <th className="derecha">{MOSTRAR_PRECIOS ? 'Total' : 'Envío'}</th>
                  <th>Estado</th>
                  <th>Motorizado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((p) => {
                  const necesitaAtencion = !esFinal(p) && !p.motorizado;
                  const asignadoFueraDeLista = p.motorizado && !motorizados.some((m) => m.id === p.motorizado.id);
                  return (
                    <tr key={p.id} className={necesitaAtencion ? 'fila-atencion' : ''}>
                      <td>
                        <strong>#{p.id}</strong>
                        <div className="tenue">{formatearFecha(p.creado_en)}</div>
                        {necesitaAtencion ? <div className="hace">{haceTiempo(p.creado_en)}</div> : null}
                      </td>
                      <td>
                        {p.recogida.nombre}
                        {p.tipo === 'ENCARGO' ? (
                          <>
                            <div className="tenue productos">{p.descripcion}</div>
                            <div className="tenue">
                              Entrega: {p.contacto.nombre} · {p.contacto.telefono}
                            </div>
                            <div className="tenue">{p.recogida.direccion}</div>
                            {p.pagar_en_recogida ? (
                              <div className="hace">Motorizado paga aprox. ${Number(p.monto_estimado).toFixed(2)}</div>
                            ) : null}
                          </>
                        ) : (
                          <div className="tenue productos">
                            {p.detalles.map((d) => `${d.cantidad} x ${d.producto_nombre}`).join(', ')}
                          </div>
                        )}
                      </td>
                      <td>
                        {p.cliente.nombre}
                        <div className="tenue">{p.cliente.telefono || 'Sin teléfono'}</div>
                      </td>
                      <td>
                        {p.destino_direccion}
                        {p.destino_referencia ? <div className="tenue cursiva">{p.destino_referencia}</div> : null}
                      </td>
                      <td className="derecha">
                        {MOSTRAR_PRECIOS ? (
                          <>
                            ${Number(p.total).toFixed(2)}
                            {p.costo_envio != null ? (
                              <div className="tenue">envío ${Number(p.costo_envio).toFixed(2)}</div>
                            ) : null}
                          </>
                        ) : (
                          p.costo_envio != null ? `$${Number(p.costo_envio).toFixed(2)}` : '—'
                        )}
                      </td>
                      <td>
                        <span className={`insignia ${p.estado}`}>{ETIQUETA_ESTADO[p.estado]}</span>
                        {p.estado === 'CANCELADO' && p.motivo_cancelacion ? (
                          <div className="tenue cursiva">{p.motivo_cancelacion}</div>
                        ) : null}
                      </td>
                      <td>
                        <select
                          value={p.motorizado?.id ?? ''}
                          disabled={esFinal(p) || asignando === p.id}
                          onChange={(e) => asignar(p, e.target.value)}
                        >
                          <option value="">— Sin asignar —</option>
                          {asignadoFueraDeLista ? <option value={p.motorizado.id}>{p.motorizado.nombre}</option> : null}
                          {motorizados.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nombre} · {m.entregas_activas === 0 ? 'libre' : `${m.entregas_activas} en curso`}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {esCancelable(p) ? (
                          <button className="peligro" onClick={() => abrirCancelacion(p)}>Cancelar</button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {visibles.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="vacio">No hay pedidos en esta vista.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {aCancelar ? (
        <div className="fondo-modal" onClick={() => !cancelando && setACancelar(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>Cancelar pedido #{aCancelar.id}</h2>
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
