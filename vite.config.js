import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In local development, run the same /api/claude function that Vercel runs in production,
// so `npm run dev` works with just a .env.local file holding ANTHROPIC_API_KEY.
function localApi() {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use('/api/claude', async (req, res) => {
        const { default: handler } = await server.ssrLoadModule('/api/claude.js');
        await handler(req, res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of ['ANTHROPIC_API_KEY', 'EXPLAIN_MODEL', 'VERIFY_MODEL']) {
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  }
  return {
    plugins: [react(), localApi()],
    build: { chunkSizeWarningLimit: 1500 },
  };
});
