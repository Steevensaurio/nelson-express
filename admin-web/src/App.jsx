import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Despacho from './pages/Despacho.jsx';
import Ganancias from './pages/Ganancias.jsx';
import NuevoEncargo from './pages/NuevoEncargo.jsx';

function RutaProtegida({ children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <p className="cargando">Cargando…</p>;
  return usuario ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { usuario } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={usuario ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<RutaProtegida><Despacho /></RutaProtegida>} />
      <Route path="/ganancias" element={<RutaProtegida><Ganancias /></RutaProtegida>} />
      <Route path="/encargo" element={<RutaProtegida><NuevoEncargo /></RutaProtegida>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
