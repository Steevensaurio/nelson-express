// Tarjeta de motorizado compartida: Nuevo pedido (dentro de un radio) y Despacho (solo informativa).
// El estado siempre lleva punto + palabra, nunca solo color.

export const iniciales = (nombre) =>
  (nombre || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

// Libres primero, luego menos entregas en curso, luego nombre.
export const ordenarMotorizados = (lista) =>
  [...lista].sort((a, b) => (a.entregas_activas - b.entregas_activas) || a.nombre.localeCompare(b.nombre, 'es'));

export function EstadoMotorizado({ m }) {
  const libre = m.entregas_activas === 0;
  return (
    <span className={`moto-estado ${libre ? 'libre' : 'ocupado'}`}>
      <span className="moto-punto" aria-hidden="true" />
      {libre ? 'Libre' : `${m.entregas_activas} en curso`}
    </span>
  );
}

const Check = () => (
  <svg className="moto-check" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <circle cx="10" cy="10" r="10" fill="currentColor" />
    <path d="M5.8 10.4l2.8 2.8 5.6-5.8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Cuerpo de la tarjeta. m = null -> opción "Sin asignar". seleccionable añade el check.
export function TarjetaMotorizado({ m, seleccionable = false, titulo, apoyo }) {
  return (
    <div className="tarjeta-moto">
      <span className={`moto-avatar ${m ? '' : 'sin-asignar'}`} aria-hidden="true">{m ? iniciales(m.nombre) : '–'}</span>
      <span className="moto-texto">
        <span className="moto-nombre">{m ? m.nombre : titulo}</span>
        {m ? <EstadoMotorizado m={m} /> : <span className="moto-estado">{apoyo}</span>}
      </span>
      {seleccionable ? <Check /> : null}
    </div>
  );
}

export function TarjetaSkeleton() {
  return (
    <div className="tarjeta-moto esqueleto" aria-hidden="true">
      <span className="moto-avatar" />
      <span className="moto-texto"><span className="sk-linea" /><span className="sk-linea corta" /></span>
    </div>
  );
}
