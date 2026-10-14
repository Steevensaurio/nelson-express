// Qué hacer al entrar a una pantalla: con datos recientes no se pide nada, con datos viejos se muestran
// y se refrescan por detrás, y sin datos se carga (con esqueleto). `maxEdad` 0 = siempre refresca.
export const decidirCarga = ({ hayDatos, edadMs, maxEdad }) => {
  if (!hayDatos) return 'cargar';
  return edadMs < maxEdad ? 'mostrar-y-saltar' : 'mostrar-y-refrescar';
};
