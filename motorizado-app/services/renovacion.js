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
