import { useState } from 'react';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await login(username.trim(), password);
    } catch (err) {
      if (err.message === 'SIN_ACCESO') setError('Esta cuenta no tiene acceso al panel de despacho.');
      else if (err.response?.status === 401) setError('Usuario o contraseña incorrectos.');
      else setError('No se pudo conectar con el servidor.');
      setEnviando(false);
    }
  };

  return (
    <main className="login">
      <img className="login-logo" src="/logo-circular.png" alt="Nelson Express" />
      <form className="login-tarjeta" onSubmit={enviar}>
        <p className="login-sub">Panel de despacho</p>

        <label>
          Usuario
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" disabled={enviando || !username.trim() || !password}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  );
}
