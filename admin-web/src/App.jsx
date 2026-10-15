import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Despacho from './pages/Despacho.jsx';
import Ganancias from './pages/Ganancias.jsx';
import NuevoPedido from './pages/NuevoPedido.jsx';

const TITULOS = {
  '/': 'Despacho',
  '/login': 'Ingresar',
  '/ganancias': 'Ganancias',
  '/pedido': 'Nuevo pedido',
};

// Tras 5 s de espera se avisa que el servidor (Render gratis) está despertando, igual que en el login.
function Cargando() {
  const [lento, setLento] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setLento(true), 5000);
    return () => clearTimeout(id);
  }, []);
  return (
    <p className="cargando" role="status">
      {lento ? 'El servidor está despertando, puede tardar hasta un minuto…' : 'Cargando…'}
    </p>
  );
}

function RutaProtegida({ children }) {
  const { usuario, cargando, sinConexion, reintentar } = useAuth();
  if (cargando && sinConexion) {
    return (
      <div className="cargando" role="status">
        <p>No se pudo conectar con el servidor. Tu sesión sigue guardada.</p>
        <button className="secundario" onClick={reintentar}>Reintentar</button>
      </div>
    );
  }
  if (cargando) return <Cargando />;
  return usuario ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { usuario } = useAuth();
  const { pathname } = useLocation();

  // Cada página tiene su propio título: es lo primero que un lector de pantalla anuncia al navegar.
  useEffect(() => {
    document.title = `${TITULOS[pathname] ?? 'Despacho'} · Nelson Express`;
  }, [pathname]);

  return (
    <>
      <a className="saltar" href="#contenido">Saltar al contenido</a>
      <Routes>
        <Route path="/login" element={usuario ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={<RutaProtegida><Despacho /></RutaProtegida>} />
        <Route path="/ganancias" element={<RutaProtegida><Ganancias /></RutaProtegida>} />
        <Route path="/pedido" element={<RutaProtegida><NuevoPedido /></RutaProtegida>} />
        {/* Dirección anterior (enlaces guardados): la página de encargos ahora es la de pedidos. */}
        <Route path="/encargo" element={<Navigate to="/pedido" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
