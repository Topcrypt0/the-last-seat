import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In development, serve /api/* from the same handlers Vercel runs in production.
function devApi() {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();
        const path = req.url.split('?')[0].replace(/\/$/, '');
        try {
          const mod = await server.ssrLoadModule(`${path}.js`);
          await mod.default(req, res);
        } catch (e) {
          console.error(e);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e.message || e) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, import.meta.dirname, ''));
  return { plugins: [react(), devApi()] };
});
