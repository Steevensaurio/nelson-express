import { useEffect, useRef } from 'react';

const ENFOCABLES = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Diálogo accesible: nombra el diálogo, cierra con Esc, mantiene el foco dentro mientras está abierto
// (Tab y Shift+Tab dan la vuelta) y lo devuelve al botón que lo abrió al cerrarse.
// enfocarDialogo: el foco empieza en el propio diálogo (fichas de solo lectura, donde el primer control
// enfocable puede estar al fondo) en vez de en su primer control.
export default function Modal({ titulo, idTitulo, onCerrar, className = '', enfocarDialogo = false, children }) {
  const caja = useRef(null);
  // onCerrar se lee por referencia para que el efecto corra una sola vez (si no, se reiniciaría en cada render).
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  // Se guarda durante el primer render, antes de que un autoFocus del contenido mueva el foco.
  const abridor = useRef(null);
  if (abridor.current === null) abridor.current = document.activeElement;

  useEffect(() => {
    const enfocables = () => [...caja.current.querySelectorAll(ENFOCABLES)];
    if (!caja.current.contains(document.activeElement)) (enfocarDialogo ? caja.current : enfocables()[0])?.focus();

    const alTeclear = (e) => {
      if (e.key === 'Escape') {
        cerrar.current();
      } else if (e.key === 'Tab') {
        const lista = enfocables();
        if (lista.length === 0) return;
        const primero = lista[0];
        const ultimo = lista[lista.length - 1];
        if (e.shiftKey && (document.activeElement === primero || document.activeElement === caja.current)) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primero.focus();
        }
      }
    };
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      abridor.current?.focus?.();
    };
  }, []);

  return (
    <div className="fondo-modal" onClick={onCerrar}>
      <div
        ref={caja}
        className={`modal ${className}`}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={idTitulo}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={idTitulo}>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}
