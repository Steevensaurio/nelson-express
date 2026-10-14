import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Despacho from './pages/Despacho.jsx';
import Ganancias from './pages/Ganancias.jsx';
import NuevoEncargo from './pages/NuevoEncargo.jsx';

const TITULOS = {
  '/': 'Despacho',
  '/login': 'Ingresar',
  '/ganancias': 'Ganancias',
  '/encargo': 'Nuevo encargo',
};

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
  if (cargando) return <p className="cargando" role="status">Cargando…</p>;
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
        <Route path="/encargo" element={<RutaProtegida><NuevoEncargo /></RutaProtegida>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
