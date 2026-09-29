/**
 * Urgency Scorer - Rule-based urgency calculation
 *
 * Scores a message on what it says (business impact, time pressure, churn
 * risk), not how it's written. Punctuation, length, politeness, caps and the
 * time of day are deliberately ignored: a terse "Server down now" is an
 * emergency, and a long, exclamation-filled thank-you note is not.
 *
 * Every point added is tied to a named signal so agents can see why a
 * message was ranked where it was.
 */

// Each rule: [label, points, patterns]. Patterns are matched case-insensitively
// with word boundaries so e.g. "download" doesn't trigger "down".
const SIGNAL_RULES = [
  // Service is unavailable or data is at risk
  ['Outage or service down', 50, [
    'down', 'outage', 'offline', 'unreachable', 'connection lost', 'lost connection',
    'not loading', "won'?t load", 'timing out', 'times out', '5\\d\\d( errors?)?', 'every request',
    '(site|app|api|server|service|website|system) (is |was )?unavailable',
  ]],
  ['Customers or team blocked', 50, [
    "(can'?t|cannot|unable to|not able to) (log ?in|sign ?in|login|access|use|place|process|check ?out|complete|make|pay|send|receive)",
    'locked out', 'no access', "customers can'?t", 'checkout (is )?broken',
    '(none of (our|my|the) (customers|users|team)|no ?one|nobody) (can|is able)',
    'account (is |was |has been |got )?(disabled|suspended|locked|deactivated)',
    'service (is |was |has been |got )?(suspended|cut off|disabled)',
  ]],
  ['Data loss or security risk', 55, [
    'data loss', 'lost (all )?(of )?(our |my |the )?(data|files|records|orders|work|customers)',
    '(was|were|got|been|all|everything) (deleted|wiped|erased)', 'missing data',
    'breach', 'hacked', 'compromised', 'without (my|our) permission', 'unauthori[sz]ed',
    'suspicious (login|activity)', 'security (issue|incident|hole|problem)', 'leak(ed)?', 'phishing',
    'lock (the|my|our) account',
  ]],
  ['Money taken incorrectly', 40, [
    'charged twice', 'double charg(ed|e)', 'overcharg(ed|e)', 'wrong amount', 'payment failed',
    '(card )?(was )?declined', 'fraud', 'why (was|am|were) (i|we) charged',
    'charged \\$?\\d+ (when|but|instead)',
  ]],

  // Time pressure
  ['Time-sensitive', 25, [
    'urgent', 'urgently', 'asap', 'immediately', 'right now', 'emergency', 'critical',
    'deadline', 'in an hour', 'in \\d+ (minutes|mins|hours)', 'by (today|tonight|tomorrow)',
    '(fixed|resolved|working|back|sorted) (by )?(today|tonight)',
    'demo', 'launch', 'go.?live',
  ]],

  // Churn and escalation risk
  ['Churn or legal risk', 35, [
    'cancel', 'cancell?ing', 'refund', 'chargeback', 'switch(ing)? providers?', 'competitor',
    'lawyer', 'legal', 'sue', 'unacceptable', 'fed up', '(second|third|fourth) time',
    'again and again', 'still (not|broken)',
  ]],

  // Ordinary product problems
  ['Something is broken', 20, [
    'bugs?', 'errors?', 'broken', 'not working', "(doesn'?t|does not|isn'?t|won'?t) (work|open|save)",
    'does nothing', 'stopped (working|arriving|syncing|sending|loading)', 'crash(ed|es|ing)?',
    'fail(ed|s|ing|ure)?', 'slow', 'stuck', 'freez(e|es|ing)', 'never (arrives|arrived|loads)',
    'keeps loading', 'loading forever', 'spins', 'spinning', 'out of date', 'glitch(es|y)?',
  ]],

  // A single user who can't get into their account
  ['Account access problem', 20, [
    'passwords?', 'reset', '2fa', 'two.factor', 'mfa', 'verification code', 'expired',
  ]],
]

// Signals that decide escalation regardless of the overall score
const ESCALATION_SIGNALS = new Set([
  'Data loss or security risk',
  'Churn or legal risk',
])

const HIGH_THRESHOLD = 50
const MEDIUM_THRESHOLD = 20

const compiled = SIGNAL_RULES.map(([label, points, patterns]) => ({
  label,
  points,
  regex: new RegExp(`\\b(${patterns.join('|')})\\b`, 'i'),
}))

/**
 * Score a message's urgency with an explanation.
 *
 * @param {string} message - The customer support message
 * @returns {{level: 'High'|'Medium'|'Low', score: number, signals: {label: string, points: number, match: string}[]}}
 */
export function scoreUrgency(message) {
  const signals = []
  for (const { label, points, regex } of compiled) {
    const found = message.match(regex)
    if (found) signals.push({ label, points, match: found[0] })
  }

  const score = Math.min(100, signals.reduce((sum, s) => sum + s.points, 0))
  const level = score >= HIGH_THRESHOLD ? 'High' : score >= MEDIUM_THRESHOLD ? 'Medium' : 'Low'

  return { level, score, signals }
}

/**
 * @param {string} message - The customer support message
 * @returns {'High'|'Medium'|'Low'}
 */
export function calculateUrgency(message) {
  return scoreUrgency(message).level
}

/**
 * Whether a message needs a senior agent / manager, based on its urgency signals.
 *
 * @param {{level: string, signals: {label: string}[]}} urgency - Result of scoreUrgency
 * @returns {boolean}
 */
export function needsEscalation(urgency) {
  return urgency.level === 'High' || urgency.signals.some(s => ESCALATION_SIGNALS.has(s.label))
}
