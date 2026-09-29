/**
 * Rule-based category classifier (works without an API key).
 *
 * Every category is scored from weighted cues rather than taking the first
 * keyword hit, so a message with several topics goes to the one with the
 * strongest evidence ("locked out ... thanks" is Account Access, not
 * Feedback). Confidence comes from how far the winner leads the runner-up.
 */

// [pattern, weight, 'raw'?]. Patterns are case-insensitive, must start at a
// and end at word boundaries unless marked 'raw', and each counts once per message.
const CATEGORY_CUES = {
  "Account Access": [
    ['locked out|lock (the|my|our) account', 3],
    ['passwords?|2fa|two.factor|mfa|verification code', 3],
    ['hacked|compromised|suspicious (login|activity)|without (my|our) permission', 3],
    ["(can'?t|cannot|unable to|not able to) (log ?in|sign ?in|login)", 3],
    ['account (is |was |has been |got )?(disabled|suspended|locked|deactivated)', 3],
    ['log ?ins?|sign ?in|admin email|reset link', 1.5],
  ],
  "Billing Issue": [
    ['charged?|charges|overcharg\\w*|refund\\w*|invoices?|receipts?', 3],
    ['payments?|card (was )?declined|declined', 3],
    ['(want|like|need|going) to cancel', 3],
    ['bill(ing|ed)?|credit card|subscription|upgrade|downgrade|annual|monthly plan', 2],
    ['\\$\\d', 2, 'raw'],
    ['cancel\\w*|pricing|price', 1],
    ['plan', 0.5],
  ],
  "Technical Problem": [
    ['down|outage|offline|unavailable|unreachable', 2.5],
    ['bugs?|errors?|crash\\w*|broken|glitch\\w*|5\\d\\d', 2],
    ["not working|(doesn'?t|does not|isn'?t|won'?t) (work|load|open|save)|does nothing|stopped (working|arriving|syncing|sending|loading)", 2],
    ['not loading|keeps loading|loading forever|timing out|times out|spins|spinning|freez\\w*|stuck', 2],
    ['lost (all )?(of )?(our |my |the )?(data|files|records|orders|work)|data loss|connection lost', 3],
    ['slow|lag\\w*', 2],
    ['out of date|never (arrives|arrived)|sync\\w*|fail\\w*', 1],
  ],
  "Feature Request": [
    ["(could|can) you (please )?add|please (add|consider)|consider adding|would (love|like) to see", 3],
    ["would be (great|nice|useful|helpful|awesome)|it'?d be (great|nice|useful|helpful)|any plans to", 3],
    ['(would|it.?d) help .* if|ability to|wish (you|there|it)|feature request', 3],
    ['feature|integrat\\w*|support for|supported|dark mode|option to', 1.5],
  ],
  "Feedback": [
    ['just wanted to (say|share|let)|keep up the|positive feedback|shout.?out', 3],
    ['appreciate\\w*|fantastic|amazing|awesome|excellent|wonderful|nice (job|work|design)|well done', 2],
    ['confusing|not a fan|liked the old|prefer(red)? the old|disappointed|frustrat\\w*', 2],
    ['thanks?|thank you', 1.5],
    ['love(d|s)?|great', 1.5],
    ['really useful|happy with', 1.5],
  ],
  "General Inquiry": [
    ['difference between|business hours|phone number|documentation|docs|do you (have|offer|support)', 2],
    ['\\?|\\b(how|what|where|when|why|which|is there|are there|can i|do i)\\b', 1, 'raw'],
  ],
}

// Used to break ties: the category the team must act on first wins.
const PRIORITY = ["Account Access", "Billing Issue", "Technical Problem", "Feature Request", "Feedback", "General Inquiry"]

const compiled = Object.fromEntries(
  Object.entries(CATEGORY_CUES).map(([category, cues]) => [
    category,
    cues.map(([pattern, weight, raw]) => ({ regex: new RegExp(raw ? pattern : `\\b(${pattern})\\b`, 'i'), weight })),
  ])
)

/**
 * @param {string} message
 * @returns {{category: string, confidence: 'high'|'medium'|'low', reasoning: string, scores: Object<string, number>}}
 */
export function classifyWithRules(message) {
  const scores = {}
  const cues = {}
  for (const [category, rules] of Object.entries(compiled)) {
    scores[category] = 0
    cues[category] = []
    for (const { regex, weight } of rules) {
      const found = message.match(regex)
      if (found) {
        scores[category] += weight
        cues[category].push(found[0])
      }
    }
  }

  const ranked = [...PRIORITY].sort((a, b) => scores[b] - scores[a] || PRIORITY.indexOf(a) - PRIORITY.indexOf(b))
  const [best, runnerUp] = ranked
  const top = scores[best]
  const margin = top - scores[runnerUp]
  const wordCount = (message.match(/[a-z]{2,}/gi) || []).length

  // Too short to act on, or only a generic question cue
  if (top === 0 || (wordCount < 3 && (best === "General Inquiry" || top < 2))) {
    return {
      category: "Unknown",
      confidence: "low",
      reasoning: "Too short or unclear to categorize; needs manual review.",
      scores,
    }
  }

  // A single weak cue (score < 2) is a guess, whatever the margin
  const confidence = top >= 3 && margin >= 2 ? "high" : top >= 2 && margin >= 1 ? "medium" : "low"
  const quoted = cues[best].map(c => `"${c}"`).join(', ')
  const alternative = confidence !== "high" && scores[runnerUp] > 0 ? ` Could also be ${runnerUp}.` : ""

  return {
    category: best,
    confidence,
    reasoning: `Matched ${best} cues: ${quoted}.${alternative}`,
    scores,
  }
}
