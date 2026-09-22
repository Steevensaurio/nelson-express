import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import Barra from '../components/Barra.jsx';
import { useAuth } from '../auth.jsx';
import { useTiempoReal } from '../useTiempoReal.js';

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

  const resumen = datos?.resumen;
  const porcentaje = datos ? (datos.comision_porcentaje ? `${datos.comision_porcentaje}%` : 'según cada pedido') : '';

  return (
    <div className="pagina">
      <Barra />

      <main className="contenido">
        <section className="filtros-ganancias">
          <div className="atajos">
            {ATAJOS.map((a) => (
              <button key={a.texto} className="secundario" onClick={() => aplicarAtajo(a.rango)}>{a.texto}</button>
            ))}
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

        {error ? <p className="error-banner">{error}</p> : null}

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
              <div className="resumen-tarjeta activa">
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
                <div className="tabla-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Motorizado</th>
                        <th className="derecha">Carreras</th>
                        <th className="derecha">Total generado</th>
                        <th className="derecha">Me debe entregar</th>
                        <th className="derecha">Se queda</th>
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
              </section>
            ) : null}

            <section className="tabla-caja">
              <div className="tabla-encabezado">
                <h2>Carreras</h2>
                {datos.carreras_truncadas ? <span className="tenue">Mostrando las 500 más recientes</span> : null}
              </div>
              <div className="tabla-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Entregado</th>
                      <th>Motorizado</th>
                      <th>Recogida</th>
                      <th>Destino</th>
                      <th className="derecha">Km</th>
                      <th className="derecha">Valor de la carrera</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.carreras.map((c) => (
                      <tr key={c.id}>
                        <td><strong>#{c.id}</strong></td>
                        <td>{hora(c.entregado_en)}</td>
                        <td>{c.motorizado.nombre}</td>
                        <td>{c.recogida}</td>
                        <td>{c.destino_direccion}</td>
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
            </section>
          </>
        ) : !error ? <p className="cargando">Cargando…</p> : null}
      </main>
    </div>
  );
}
