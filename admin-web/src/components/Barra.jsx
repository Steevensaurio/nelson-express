import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Barra() {
  const { usuario, logout } = useAuth();

  return (
    <header className="barra">
      <div className="barra-izquierda">
        <img className="barra-logo" src="/logo-circular.png" alt="Nelson Express" />
        <nav className="barra-nav">
          <NavLink to="/" end>Despacho</NavLink>
          <NavLink to="/encargo">Nuevo encargo</NavLink>
          <NavLink to="/ganancias">Ganancias</NavLink>
        </nav>
      </div>
      <div className="barra-usuario">
        <span>{usuario.first_name || usuario.username}</span>
        <button className="secundario" onClick={logout}>Cerrar sesión</button>
      </div>
    </header>
  );
}
