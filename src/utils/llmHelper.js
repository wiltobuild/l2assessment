import { classifyWithRules } from './ruleClassifier';

/**
 * LLM Helper for categorizing customer support messages.
 *
 * The browser never talks to Groq directly: it calls our own /api/categorize
 * endpoint (server/categorizeHandler.js), which holds the API key. If the
 * endpoint is unavailable, has no key configured, or fails, the rule-based
 * classifier is used instead.
 */

export { CATEGORIES } from './categories';

const API_PATH = '/api/categorize';

/**
 * Categorize a customer support message
 *
 * @param {string} message - The customer support message
 * @returns {Promise<{category: string, confidence: string, urgency?: string, reasoning: string, source: 'ai'|'rules'}>}
 */
export async function categorizeMessage(message) {
  try {
    const response = await fetch(API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) {
      // 503 just means no key is configured; anything else is worth a warning
      if (response.status !== 503) {
        console.warn(`Categorize API returned ${response.status}, using rule-based categorization`);
      }
      return categorizeWithRules(message);
    }
    return await response.json();
  } catch (error) {
    console.warn('Categorize API unreachable, using rule-based categorization:', error.message);
    return categorizeWithRules(message);
  }
}

/**
 * Rule-based categorization, used when no API key is configured or the API
 * call fails.
 */
export function categorizeWithRules(message) {
  const { category, confidence, reasoning } = classifyWithRules(message);
  return { category, confidence, reasoning, source: "rules" };
}
