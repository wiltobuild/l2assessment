/**
 * Production server: serves the built app from dist/ and the categorize API.
 *
 *   npm run build
 *   npm start            # reads GROQ_API_KEY from the environment or .env.local
 */
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCategorizeHandler } from './categorizeHandler.js'

const DIST = resolve(fileURLToPath(new URL('../dist', import.meta.url)))
const PORT = Number(process.env.PORT) || 3000

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
}

const categorize = createCategorizeHandler({
  apiKey: process.env.GROQ_API_KEY,
  model: process.env.GROQ_MODEL,
})

async function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  const filePath = normalize(join(DIST, urlPath))
  // Unknown paths fall back to index.html so client-side routes work
  const candidates = filePath.startsWith(DIST) && extname(filePath) ? [filePath] : []
  candidates.push(join(DIST, 'index.html'))

  for (const candidate of candidates) {
    try {
      const body = await readFile(candidate)
      res.setHeader('Content-Type', CONTENT_TYPES[extname(candidate)] || 'application/octet-stream')
      res.end(body)
      return
    } catch {
      // try the next candidate
    }
  }
  res.statusCode = 404
  res.end('Not found - run `npm run build` first')
}

http
  .createServer((req, res) => categorize(req, res, () => serveStatic(req, res)))
  .listen(PORT, () => {
    const mode = process.env.GROQ_API_KEY ? 'Groq enabled' : 'no GROQ_API_KEY, rule-based only'
    console.log(`Relay triage running at http://localhost:${PORT} (${mode})`)
  })
