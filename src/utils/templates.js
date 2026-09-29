/**
 * Recommendation Templates - Maps categories to recommended actions
 */

const actionTemplates = {
  "Billing Issue": "Route to Billing. Verify the charge or payment status on the account and reply with the resolution.",
  "Technical Problem": "Route to Technical Support. Ask for steps to reproduce, affected users and any error messages.",
  "General Inquiry": "Reply with the relevant help-center article; route to Support if it isn't covered.",
  "Feature Request": "Thank the customer, log the request with the Product team and share the roadmap link.",
  "Unknown": "Review manually."
}

// Used instead of the category template when urgency is High
const urgentActionTemplates = {
  "Billing Issue": "Escalate to the Billing lead now. Confirm the charge and issue a correction or refund if it's wrong.",
  "Technical Problem": "Page on-call engineering now and acknowledge the customer within 15 minutes.",
}

/**
 * Get recommended action for a given category
 *
 * @param {string} category - The message category
 * @param {string} urgency - The urgency level
 * @returns {string} - Recommended next step
 */
export function getRecommendedAction(category, urgency) {
  if (urgency === 'High') {
    return urgentActionTemplates[category] || "Escalate to a senior agent now and acknowledge the customer within 15 minutes."
  }
  return actionTemplates[category] || "No recommendation available."
}

/**
 * Get all available categories
 *
 * @returns {string[]} - List of categories
 */
export function getAvailableCategories() {
  return Object.keys(actionTemplates)
}
