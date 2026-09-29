/**
 * POST /api/categorize  { "message": "..." }
 *   200 { category, confidence, urgency, reasoning, source }
 *   400 bad input · 405 wrong method · 413 too large · 429 rate limited
 *   502 Groq call failed · 503 no API key configured
 *
 * Written as connect-style middleware so the Vite dev/preview servers and the
 * production server (server/index.js) share it.
 */
import { createGroqClassifier, DEFAULT_MODEL } from './groqClassifier.js'

export const API_PATH = '/api/categorize'

const MAX_BODY_BYTES = 16 * 1024
const MAX_MESSAGE_CHARS = 5000
const RATE_LIMIT = { requests: 30, windowMs: 60 * 1000 }

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', chunk => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Body too large'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/**
 * @param {{apiKey?: string, model?: string}} config
 */
export function createCategorizeHandler({ apiKey, model = DEFAULT_MODEL } = {}) {
  const classify = apiKey ? createGroqClassifier({ apiKey, model }) : null
  const recentRequests = new Map() // client address -> request timestamps

  const isRateLimited = client => {
    const now = Date.now()
    const recent = (recentRequests.get(client) || []).filter(t => now - t < RATE_LIMIT.windowMs)
    recent.push(now)
    recentRequests.set(client, recent)
    return recent.length > RATE_LIMIT.requests
  }

  return async function categorizeHandler(req, res, next) {
    const path = (req.url || '').split('?')[0]
    if (path !== API_PATH) return next?.()

    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' })
    if (!classify) return sendJson(res, 503, { error: 'not_configured' })
    if (isRateLimited(req.socket?.remoteAddress || 'unknown')) {
      return sendJson(res, 429, { error: 'rate_limited' })
    }

    let message
    try {
      message = JSON.parse(await readBody(req)).message
    } catch (error) {
      return sendJson(res, error.status || 400, { error: error.status === 413 ? 'too_large' : 'invalid_json' })
    }
    if (typeof message !== 'string' || !message.trim()) {
      return sendJson(res, 400, { error: 'message_required' })
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return sendJson(res, 413, { error: 'too_large' })
    }

    try {
      return sendJson(res, 200, await classify(message))
    } catch (error) {
      // Log details server-side only; the browser just falls back to rules
      console.warn('Groq categorization failed:', error.message)
      return sendJson(res, 502, { error: 'upstream_failed' })
    }
  }
}
