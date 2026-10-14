// Teléfonos de Ecuador. Mismo contenido en cliente-app, motorizado-app y admin-web (y misma regla que el servidor).
export const MENSAJE_TELEFONO =
  'Ingresa un teléfono válido de Ecuador: celular 09XXXXXXXX (10 dígitos) o fijo 0XXXXXXXX (9 dígitos).';

// Devuelve la forma nacional (solo dígitos, empieza con 0) o null si no es válido.
export function normalizarTelefono(texto) {
  let t = String(texto ?? '').replace(/[\s\-.()]/g, '');
  if (t.startsWith('+593')) t = '0' + t.slice(4);
  else if (t.startsWith('593')) t = '0' + t.slice(3);
  return /^(09\d{8}|0[2-7]\d{7})$/.test(t) ? t : null;
}
