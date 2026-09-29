/**
 * Full triage pipeline: category, urgency, escalation, review flag and action.
 * Shared by the Analyze page and the offline eval so both run the same logic.
 */
import { categorizeMessage, categorizeWithRules } from './llmHelper'
import { scoreUrgency, needsEscalation } from './urgencyScorer'
import { getRecommendedAction } from './templates'

// Queue order: most pressing first
export const PRIORITY_RANK = { High: 0, Review: 1, Medium: 2, Low: 3 }

/**
 * Combine a categorization with urgency scoring.
 *
 * "Needs review" is set when the category is unclear. Such messages must not
 * sink to the bottom as Low: an emergency phrased in words the rules don't
 * know would otherwise be buried.
 */
export function buildTriage(message, categorization) {
  const { category, confidence, reasoning, source } = categorization
  const urgency = scoreUrgency(message)
  const escalate = needsEscalation(urgency)
  const needsReview = urgency.level !== 'High' && (category === 'Unknown' || confidence === 'low')

  return {
    message,
    category,
    confidence,
    categorySource: source,
    urgency: urgency.level,
    urgencyScore: urgency.score,
    urgencySignals: urgency.signals,
    escalate,
    needsReview,
    priority: needsReview ? 'Review' : urgency.level,
    recommendedAction: needsReview
      ? 'Needs human review: the category is unclear. Read the message and set category and urgency by hand.'
      : getRecommendedAction(category, urgency.level),
    reasoning,
  }
}

/** Triage using the LLM when configured, otherwise rules. */
export async function triageMessage(message) {
  return buildTriage(message, await categorizeMessage(message))
}

/** Triage using rules only (no network). */
export function triageWithRules(message) {
  return buildTriage(message, categorizeWithRules(message))
}

/** Sort comparator for a priority queue: priority, then escalated, then newest. */
export function byPriority(a, b) {
  const rank = item => PRIORITY_RANK[item.priority ?? item.urgency] ?? 3
  return (
    rank(a) - rank(b) ||
    Number(Boolean(b.escalate)) - Number(Boolean(a.escalate)) ||
    new Date(b.timestamp) - new Date(a.timestamp)
  )
}
