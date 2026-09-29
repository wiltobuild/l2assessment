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
    'not loading', "won't load", 'wont load', 'timing out', 'times out', '5\\d\\d error',
  ]],
  ['Customers or team blocked', 45, [
    "can'?t (log ?in|sign ?in|access|login)", 'cannot (log ?in|sign ?in|access|login)',
    'locked out', 'no access', 'unable to (log ?in|access|use)',
    'checkout (is )?broken', "customers can'?t", 'all (of our )?users', 'whole team',
  ]],
  ['Data loss or security risk', 55, [
    'data loss', 'lost (all|our|my) data', 'deleted', 'missing data', 'breach', 'hacked',
    'compromised', 'security (issue|incident|hole|problem)','leak(ed)?', 'phishing',
  ]],
  ['Money taken incorrectly', 40, [
    'charged twice', 'double charged', 'double charge', 'overcharged', 'wrong amount',
    'payment failed', 'card declined', 'unauthori[sz]ed charge', 'fraud',
  ]],

  // Time pressure
  ['Time-sensitive', 25, [
    'urgent', 'urgently', 'asap', 'immediately', 'right now', 'emergency', 'critical',
    'deadline', 'in an hour', 'in \\d+ (minutes|mins|hours)', 'by (today|tonight|tomorrow)',
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
    'bug', 'error', 'broken', 'not working', "doesn'?t work", "isn'?t working", 'crash(ed|es|ing)?',
    'fail(ed|s|ing)?', 'slow', 'stuck', 'freez(e|es|ing)',
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
