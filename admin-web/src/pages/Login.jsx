import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth.jsx';

// Tras estos milisegundos de espera se avisa que el servidor (Render gratis) está despertando.
const ESPERA_LENTA_MS = 5000;

export default function Login() {
  const { login } = useAuth();
  // Un doble clic dispara dos envíos antes de que el estado `enviando` se actualice: el ref lo impide.
  const enCurso = useRef(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [lento, setLento] = useState(false);
  // En pantallas chicas no se enfoca solo: abriría el teclado y taparía el formulario.
  const [enfocar] = useState(() => window.matchMedia('(min-width: 900px)').matches);

  useEffect(() => {
    if (!enviando) return undefined;
    const id = setTimeout(() => setLento(true), ESPERA_LENTA_MS);
    return () => { clearTimeout(id); setLento(false); };
  }, [enviando]);

  const enviar = async (evento) => {
    evento.preventDefault();
    if (enCurso.current) return;
    enCurso.current = true;
    setEnviando(true);
    setError('');
    try {
      await login(username.trim(), password);
    } catch (err) {
      if (err.message === 'SIN_ACCESO') setError('Esta cuenta no tiene acceso al panel de despacho.');
      else if (!err.response) setError('No se pudo conectar con el servidor.');
      else if (err.response.status === 400 || err.response.status === 401) setError('Usuario o contraseña incorrectos.');
      else setError('El servidor no está disponible en este momento. Intenta de nuevo en un minuto.');
      setEnviando(false);
    } finally {
      enCurso.current = false;
    }
  };

  return (
    <main className="login" id="contenido">
      <section className="login-fondo">
        <div className="login-rayas" aria-hidden="true" />
        <div className="login-marca">
          <img className="login-logo" src="/logo-circular.png" alt="" />
          <div>
            <p className="login-marca-nombre">Nelson Express</p>
            <p className="login-marca-sub">Panel de despacho</p>
          </div>
        </div>
        <div className="login-texto">
          <p className="login-titular">
            Despacha fácil,
            <br />
            <span className="login-acento">entrega rápido</span>
          </p>
          <p className="login-apoyo">Todos los pedidos y motorizados en un solo lugar.</p>
        </div>
      </section>

      <div className="login-hoja">
        <form className="login-form" onSubmit={enviar}>
          <h1>Bienvenido de nuevo</h1>

          <label>
            Usuario
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus={enfocar} autoComplete="username" />
          </label>
          <label>
            Contraseña
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>

          {error ? <p className="error" role="alert">{error}</p> : null}

          <button type="submit" disabled={enviando || !username.trim() || !password}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>

          <p className="login-lento" role="status">
            {enviando && lento ? 'El servidor está despertando, puede tardar hasta un minuto…' : ''}
          </p>

          <p className="login-pie">Nelson Express · Santo Domingo</p>
        </form>
      </div>
    </main>
  );
}
