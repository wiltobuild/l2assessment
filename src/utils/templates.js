/**
 * Recommendation Templates - Maps categories to recommended actions
 */

const actionTemplates = {
  "Billing Issue": "Route to Billing. Verify the charge or payment status on the account and reply with the resolution.",
  "Technical Problem": "Route to Technical Support. Ask for steps to reproduce, affected users and any error messages.",
  "Account Access": "Route to Support. Verify the customer's identity, then help them reset their password or 2FA.",
  "General Inquiry": "Reply with the relevant help-center article; route to Support if it isn't covered.",
  "Feature Request": "Thank the customer, log the request with the Product team and share the roadmap link.",
  "Feedback": "Thank the customer and share the feedback with the relevant team. No further action needed.",
  "Unknown": "Review manually."
}

// Used instead of the category template when urgency is High
const urgentActionTemplates = {
  "Billing Issue": "Escalate to the Billing lead now. Confirm the charge and issue a correction or refund if it's wrong.",
  "Technical Problem": "Page on-call engineering now and acknowledge the customer within 15 minutes.",
  "Account Access": "Escalate to the Security/Support lead now. Verify identity, secure the account and restore access.",
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
