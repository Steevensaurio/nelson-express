import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import Barra from '../components/Barra.jsx';
import { useAuth } from '../auth.jsx';
import { useTiempoReal } from '../useTiempoReal.js';
import { useMedia } from '../useMedia.js';

const dinero = (valor) => `$${Number(valor).toFixed(2)}`;

// AAAA-MM-DD en la hora local del navegador (toISOString usaría UTC y correría el día).
const fechaLocal = (fecha) => fecha.toLocaleDateString('en-CA');

const sumarDias = (fecha, dias) => {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
};

const hora = (iso) =>
  new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const ATAJOS = [
  { texto: 'Hoy', rango: () => [new Date(), new Date()] },
  { texto: 'Ayer', rango: () => [sumarDias(new Date(), -1), sumarDias(new Date(), -1)] },
  { texto: 'Últimos 7 días', rango: () => [sumarDias(new Date(), -6), new Date()] },
  { texto: 'Este mes', rango: () => [new Date(new Date().getFullYear(), new Date().getMonth(), 1), new Date()] },
];

export default function Ganancias() {
  const { token } = useAuth();
  const [desde, setDesde] = useState(fechaLocal(new Date()));
  const [hasta, setHasta] = useState(fechaLocal(new Date()));
  const [motorizado, setMotorizado] = useState('');
  const [motorizados, setMotorizados] = useState([]);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/despacho/motorizados/').then(({ data }) => setMotorizados(data)).catch(() => {});
  }, []);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/despacho/ganancias/', { params: { desde, hasta, motorizado } });
      setDatos(data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail ?? 'No se pudieron cargar las ganancias.');
    }
  }, [desde, hasta, motorizado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Si se entrega un pedido mientras se mira el día de hoy, las cifras se actualizan solas.
  useTiempoReal(token, cargar);

  const aplicarAtajo = (rango) => {
    const [d, h] = rango();
    setDesde(fechaLocal(d));
    setHasta(fechaLocal(h));
  };

  const enTabla = useMedia('(min-width: 768px)');
  const resumen = datos?.resumen;
  const porcentaje = datos ? (datos.comision_porcentaje ? `${datos.comision_porcentaje}%` : 'según cada pedido') : '';

  return (
    <div className="pagina">
      <Barra />

      <main className="contenido" id="contenido" tabIndex={-1}>
        <h1 className="solo-lectores">Ganancias</h1>
        <section className="filtros-ganancias" aria-label="Filtros">
          <div className="atajos">
            {ATAJOS.map((a) => {
              const [d, h] = a.rango();
              return (
                <button
                  key={a.texto}
                  className="secundario"
                  aria-pressed={fechaLocal(d) === desde && fechaLocal(h) === hasta}
                  onClick={() => aplicarAtajo(a.rango)}
                >
                  {a.texto}
                </button>
              );
            })}
          </div>
          <label>
            Desde
            <input type="date" value={desde} max={hasta} onChange={(e) => e.target.value && setDesde(e.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={hasta} min={desde} onChange={(e) => e.target.value && setHasta(e.target.value)} />
          </label>
          <label>
            Motorizado
            <select value={motorizado} onChange={(e) => setMotorizado(e.target.value)}>
              <option value="">Todos</option>
              {motorizados.map((m) => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </label>
        </section>

        {error ? <p className="error-banner" role="alert">{error}</p> : null}

        {resumen ? (
          <>
            <section className="resumen">
              <div className="resumen-tarjeta">
                <span className="resumen-numero">{resumen.carreras}</span>
                <span className="resumen-texto">Carreras entregadas</span>
              </div>
              <div className="resumen-tarjeta">
                <span className="resumen-numero">{dinero(resumen.total)}</span>
                <span className="resumen-texto">Total generado</span>
              </div>
              <div className="resumen-tarjeta destacada">
                <span className="resumen-numero">{dinero(resumen.comision)}</span>
                <span className="resumen-texto">Me deben entregar ({porcentaje})</span>
              </div>
              <div className="resumen-tarjeta">
                <span className="resumen-numero">{dinero(resumen.neto)}</span>
                <span className="resumen-texto">Se quedan los motorizados</span>
              </div>
            </section>

            {resumen.sin_valor > 0 ? (
              <p className="aviso">
                {resumen.sin_valor} {resumen.sin_valor === 1 ? 'carrera no tiene' : 'carreras no tienen'} valor de envío
                (pedidos anteriores a las tarifas) y cuentan como $0.00.
              </p>
            ) : null}

            {!motorizado ? (
              <section className="tabla-caja">
                <div className="tabla-encabezado"><h2>Por motorizado</h2></div>
                {!enTabla ? (
                  datos.por_motorizado.length === 0 ? (
                    <p className="vacio">No hay carreras en este rango.</p>
                  ) : (
                    <ul className="lista-datos">
                      {datos.por_motorizado.map((f) => (
                        <li key={f.motorizado.id}>
                          <strong className="lista-datos-titulo">{f.motorizado.nombre}</strong>
                          <dl>
                            <div><dt>Carreras</dt><dd>{f.carreras}</dd></div>
                            <div><dt>Total generado</dt><dd>{dinero(f.total)}</dd></div>
                            <div><dt>Me debe entregar</dt><dd><strong>{dinero(f.comision)}</strong></dd></div>
                            <div><dt>Se queda</dt><dd>{dinero(f.neto)}</dd></div>
                          </dl>
                        </li>
                      ))}
                    </ul>
                  )
                ) : (
                <div className="tabla-scroll" tabIndex={0} role="region" aria-label="Ganancias por motorizado">
                  <table>
                    <caption className="solo-lectores">Ganancias por motorizado</caption>
                    <thead>
                      <tr>
                        <th scope="col">Motorizado</th>
                        <th scope="col" className="derecha">Carreras</th>
                        <th scope="col" className="derecha">Total generado</th>
                        <th scope="col" className="derecha">Me debe entregar</th>
                        <th scope="col" className="derecha">Se queda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.por_motorizado.map((f) => (
                        <tr key={f.motorizado.id}>
                          <td><strong>{f.motorizado.nombre}</strong></td>
                          <td className="derecha">{f.carreras}</td>
                          <td className="derecha">{dinero(f.total)}</td>
                          <td className="derecha"><strong>{dinero(f.comision)}</strong></td>
                          <td className="derecha">{dinero(f.neto)}</td>
                        </tr>
                      ))}
                      {datos.por_motorizado.length === 0 ? (
                        <tr><td colSpan="5" className="vacio">No hay carreras en este rango.</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                )}
              </section>
            ) : null}

            <section className="tabla-caja">
              <div className="tabla-encabezado">
                <h2>Carreras</h2>
                {datos.carreras_truncadas ? <span className="tenue">Mostrando las 500 más recientes</span> : null}
              </div>
              {!enTabla ? (
                datos.carreras.length === 0 ? (
                  <p className="vacio">No hay carreras en este rango.</p>
                ) : (
                  <ul className="lista-datos">
                    {datos.carreras.map((c) => (
                      <li key={c.id}>
                        <div className="lista-datos-cabeza">
                          <strong className="lista-datos-titulo">Pedido #{c.id}</strong>
                          <strong>{c.costo_envio != null ? dinero(c.costo_envio) : '—'}</strong>
                        </div>
                        <dl>
                          <div><dt>Entregado</dt><dd>{hora(c.entregado_en)}</dd></div>
                          <div><dt>Motorizado</dt><dd>{c.motorizado.nombre}</dd></div>
                          <div><dt>Recogida</dt><dd>{c.recogida}</dd></div>
                          <div><dt>Destino</dt><dd>{c.destino_direccion}</dd></div>
                          <div><dt>Km</dt><dd>{c.distancia_km ? Number(c.distancia_km).toFixed(1) : '—'}</dd></div>
                        </dl>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
              <div className="tabla-scroll" tabIndex={0} role="region" aria-label="Carreras entregadas">
                <table>
                  <caption className="solo-lectores">Carreras entregadas en el rango elegido</caption>
                  <thead>
                    <tr>
                      <th scope="col">Pedido</th>
                      <th scope="col">Entregado</th>
                      <th scope="col">Motorizado</th>
                      <th scope="col">Recogida</th>
                      <th scope="col">Destino</th>
                      <th scope="col" className="derecha">Km</th>
                      <th scope="col" className="derecha">Valor de la carrera</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.carreras.map((c) => (
                      <tr key={c.id}>
                        <td><strong>#{c.id}</strong></td>
                        <td>{hora(c.entregado_en)}</td>
                        <td>{c.motorizado.nombre}</td>
                        <td>{c.recogida}</td>
                        <td><div className="clamp ancho" title={c.destino_direccion}>{c.destino_direccion}</div></td>
                        <td className="derecha">{c.distancia_km ? Number(c.distancia_km).toFixed(1) : '—'}</td>
                        <td className="derecha"><strong>{c.costo_envio != null ? dinero(c.costo_envio) : '—'}</strong></td>
                      </tr>
                    ))}
                    {datos.carreras.length === 0 ? (
                      <tr><td colSpan="7" className="vacio">No hay carreras en este rango.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              )}
            </section>
          </>
        ) : !error ? <p className="cargando" role="status">Cargando…</p> : null}
      </main>
    </div>
  );
}
