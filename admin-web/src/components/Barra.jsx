import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const SECCIONES = { '/': 'Despacho', '/encargo': 'Nuevo encargo', '/ganancias': 'Ganancias' };

// En pantallas chicas (<768px) la navegación se pliega en un menú: el botón abre un panel con los enlaces y
// "Cerrar sesión". Se cierra con Esc, al tocar fuera, al salir el foco del menú y al navegar (cada página monta
// su propia barra). En pantallas grandes el CSS muestra el mismo menú en línea y esconde el botón.
export default function Barra() {
  const { usuario, logout } = useAuth();
  const { pathname } = useLocation();
  const [abierto, setAbierto] = useState(false);
  const barra = useRef(null);
  const boton = useRef(null);
  const menu = useRef(null);

  const cerrar = (devolverFoco) => {
    setAbierto(false);
    if (devolverFoco) boton.current?.focus();
  };

  useEffect(() => {
    if (!abierto) return undefined;
    menu.current?.querySelector('a')?.focus();
    const alTeclear = (e) => {
      if (e.key === 'Escape') cerrar(true);
    };
    const alTocar = (e) => {
      if (!barra.current?.contains(e.target)) cerrar(false);
    };
    document.addEventListener('keydown', alTeclear);
    document.addEventListener('pointerdown', alTocar);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.removeEventListener('pointerdown', alTocar);
    };
  }, [abierto]);

  const nombre = usuario.first_name || usuario.username;

  return (
    <header
      ref={barra}
      className={`barra ${abierto ? 'abierta' : ''}`}
      onBlur={(e) => {
        if (abierto && e.relatedTarget && !barra.current.contains(e.relatedTarget)) cerrar(false);
      }}
    >
      <img className="barra-logo" src="/logo-circular.png" alt="Nelson Express" />
      <span className="barra-seccion" aria-hidden="true">{SECCIONES[pathname] ?? ''}</span>
      <button
        ref={boton}
        type="button"
        className="barra-boton-menu"
        aria-expanded={abierto}
        aria-controls="menu-principal"
        aria-label="Menú"
        onClick={() => (abierto ? cerrar(true) : setAbierto(true))}
      >
        <span className="barra-icono-menu" aria-hidden="true" />
      </button>
      <div className="barra-menu" id="menu-principal" ref={menu}>
        <nav className="barra-nav" aria-label="Principal">
          <NavLink to="/" end>Despacho</NavLink>
          <NavLink to="/encargo">Nuevo encargo</NavLink>
          <NavLink to="/ganancias">Ganancias</NavLink>
        </nav>
        <div className="barra-usuario">
          <span className="barra-nombre" title={nombre}>{nombre}</span>
          <button type="button" className="secundario" onClick={logout}>Cerrar sesión</button>
        </div>
      </div>
    </header>
  );
}
