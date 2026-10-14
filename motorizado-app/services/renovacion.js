// Comparte UNA renovación de sesión entre todas las peticiones que reciben 401 a la vez.
// Mientras la primera sigue pendiente, las demás reciben la misma promesa; al terminar
// (bien o mal) la siguiente llamada empieza una nueva.
export function crearRenovador({ renovar }) {
  let enCurso = null;
  return () => {
    if (!enCurso) {
      enCurso = renovar().finally(() => { enCurso = null; });
    }
    return enCurso;
  };
}

// ¿Esta falla de la renovación significa que la sesión ya no sirve? Solo si el servidor rechazó el refresh
// (400/401/403). Sin red, con el servidor despertando (502/503 de Render), 408 o 429 la sesión se conserva.
export const debeCerrarSesion = (error) => [400, 401, 403].includes(error?.response?.status);
