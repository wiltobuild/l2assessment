import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createCategorizeHandler } from './server/categorizeHandler.js'

// Serves /api/categorize from the dev and preview servers. The key is read
// server-side (no VITE_ prefix), so it is never bundled into the browser code.
function categorizeApi(env) {
  const handler = createCategorizeHandler({ apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL })
  return {
    name: 'categorize-api',
    configureServer: server => { server.middlewares.use(handler) },
    configurePreviewServer: server => { server.middlewares.use(handler) },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), categorizeApi(env)],
  }
})
