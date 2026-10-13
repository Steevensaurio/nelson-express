// Sin tildes ni mayúsculas, para comparar "HUÉQUITA" con "huequita".
const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Negocios cuyo nombre contiene el texto buscado. Texto vacío: todos.
export function filtrarNegocios(lista, texto) {
  const q = normalizar(texto);
  return q ? lista.filter((n) => normalizar(n.nombre).includes(q)) : lista;
}
