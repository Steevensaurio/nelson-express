import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El puerto 5173 está permitido en CORS_ALLOWED_ORIGINS del backend; strictPort evita que Vite
// se mueva a otro puerto en silencio (y el navegador empiece a fallar por CORS).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
