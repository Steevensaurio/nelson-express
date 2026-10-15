import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { BP, anchoMinimo } from '../useMedia.js';

const SECCIONES = { '/': 'Despacho', '/pedido': 'Nuevo pedido', '/ganancias': 'Ganancias' };

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

  // Al cambiar de ruta se cierra (además, cada página monta su propia barra).
  useEffect(() => setAbierto(false), [pathname]);

  useEffect(() => {
    if (!abierto) return undefined;
    menu.current?.querySelector('a')?.focus();
    // Al pasar a pantalla ancha el menú se muestra en línea: el panel deja de tener sentido.
    const ancho = window.matchMedia(anchoMinimo(BP.tablet));
    const alCambiarAncho = () => ancho.matches && setAbierto(false);
    ancho.addEventListener('change', alCambiarAncho);
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
      ancho.removeEventListener('change', alCambiarAncho);
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
        {/* Tocar un enlace cierra el panel, también el de la página actual (que no cambia la ruta). */}
        <nav className="barra-nav" aria-label="Principal" onClick={(e) => e.target.closest('a') && setAbierto(false)}>
          <NavLink to="/" end>Despacho</NavLink>
          <NavLink to="/pedido">Nuevo pedido</NavLink>
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
