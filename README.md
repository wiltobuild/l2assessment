# Customer Inbox Triage App

## Overview

The Customer Inbox Triage app is a lightweight AI-powered tool that helps classify customer support messages and recommend actions. It uses Groq AI to categorize messages, applies rule-based urgency scoring, and suggests next steps based on predefined templates.

## Problem Statement

Support teams waste time manually reading and triaging customer messages. This tool provides an automated first pass at classification to help prioritize and route messages more efficiently.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **AI**: Groq API (GPT-OSS 20B with strict JSON-schema output - Free tier)
- **Runtime**: React app plus a small Node API (`server/`) that holds the Groq key and calls Groq server-side

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Groq API key (FREE - get from https://console.groq.com)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/wiltobuild/l2assessment.git
   cd l2assessment
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Groq API Key**
   
   Create a `.env.local` file in the root directory:
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your Groq API key:
   ```
   GROQ_API_KEY=gsk_your-actual-key-here
   ```
   
   Get your FREE API key from: https://console.groq.com/keys
   
   **Why Groq?** Groq offers a generous free tier with fast inference and no credit card required!

4. **Run the application**
   ```bash
   npm run dev
   ```
   
   The app will be available at `http://localhost:5173`

## How It Works

1. **Paste Message**: User pastes a customer support message into the text area
2. **Analyze**: Click "Analyze Message" to process the input
3. **Classification**: The app runs three processes in parallel:
   - **Category Classification**: With a Groq key, the LLM returns JSON that must match a schema: one of a fixed list of categories (Technical Problem, Account Access, Billing Issue, Feature Request, General Inquiry, Feedback, Unknown), a confidence level, and a short reason. The response is validated. Without a key, or if the call fails, a rule-based classifier (`src/utils/ruleClassifier.js`) scores every category from weighted cues and derives confidence from how far the winner leads.
   - **Urgency Scoring** (Rule-based): Scores what the message says, not how it's written: outages, blocked customers, data/security risk, incorrect charges, time pressure, and churn/legal risk each add points (see `src/utils/urgencyScorer.js`). Length, punctuation, caps, politeness, and time of day are ignored. The matched signals are shown with the result, and data/security or churn signals flag the message for escalation.
   - **Recommendation** (Template-based): Maps category (and High urgency) to a recommended action and owning team
   - **Needs review**: If the category is Unknown or low-confidence (and urgency isn't already High), the message is flagged for human review instead of defaulting to Low. An emergency in unfamiliar wording goes near the top of the queue instead of the bottom.
4. **Display Results**: Shows category and confidence, urgency with the signals behind it, escalation/review flags, recommended action, and reasoning
5. **Triage Queue** (History tab): Sorted by priority (High, Needs review, Medium, Low; escalated first within a level). Agents can confirm or correct each triage, and export their reviews as `labeled-cases.json` in the eval format.

## Evaluating the triage rules

No API key is needed:

```bash
npm run eval -- --verbose
```

This runs the full rule-based pipeline over the labeled sets in `eval/` and reports category accuracy, urgency accuracy, High precision, review rate, and **buried emergencies** (expected-High messages neither marked High nor sent to review). It fails if the dev set buries any emergency.

| Set | Purpose | Category | Urgency | Emergencies buried | Sent to review |
|---|---|---|---|---|---|
| `dev` (43) | Rules are tuned against it | 100% | 100% | 0 / 13 | 14% |
| `holdout` (23) | Written before tuning, but results were seen during tuning | 96% | 100% | 0 / 5 | 17% |
| `holdout2` (20) | Written after tuning, never tuned against: **the honest estimate** | 30% | 55% | 1 / 4 | 85% |

With a Groq key, `npm run eval -- --llm` runs the same sets through the live model. The model returns category and urgency, and the higher of the model's and the rules' urgency wins:

| Set | Category | Urgency | Emergencies buried | High precision | Sent to review |
|---|---|---|---|---|---|
| `dev` | 95% | 98% | 0 / 13 | 93% | 7% |
| `holdout` | 100% | 96% | 0 / 5 | 83% | 9% |
| `holdout2` | 80% | 90% | 0 / 4 | 80% | 10% |

Keyword rules do well on phrasing they were built around and poorly on new phrasing. The review flag is what keeps unfamiliar messages from being silently marked Low. To improve the rules, add the agent reviews you export to a new case file, and keep one set you never tune against.


## Example Test Messages

Try analyzing these messages to see how the triage system works:

### Example 1: Production Issue
```
Our production server is down
```

### Example 2: Customer Feedback
```
Hi there! I just wanted to say thank you for your amazing customer service. I've been using your product for three years now and I'm really happy with it. Keep up the great work!
```

### Example 3: Feature Request
```
I would love to see a dark mode option in the app. It would be much easier on my eyes during night time usage.
```

### Example 4: Payment Issue
```
I tried to update my payment method but the page keeps loading forever. Is this a known issue?
```

### Example 5: Billing Question
```
Can I upgrade my subscription to the pro plan?
```

### Example 6: Technical Support
```
The dashboard won't load when I try to access it. I've tried refreshing but it keeps timing out.
```

## Security Note

The Groq API key never reaches the browser. The app calls its own `POST /api/categorize` endpoint (`server/categorizeHandler.js`), which reads `GROQ_API_KEY` on the server and calls Groq. Because the variable has no `VITE_` prefix, Vite never puts it in the bundle. The endpoint:

- accepts only `POST` with a JSON `{ "message": "..." }` of at most 5,000 characters (16 KB body)
- rate-limits each client to 30 requests per minute, so the key can't be drained through the endpoint
- returns only the validated classification, never Groq error details
- returns `503` when no key is configured; the app then uses the rule-based classifier

The same handler runs in `npm run dev`, `npm run preview`, and the production server:

```bash
npm run build
npm start        # http://localhost:3000, reads GROQ_API_KEY from the environment or .env.local
```

For a real deployment, also put the app behind your authentication so only your team can call the endpoint.

## Why Groq?

- ✅ **Completely Free** - No credit card required
- ✅ **Fast Inference** - Groq's LPU technology is incredibly fast
- ✅ **Generous Limits** - ~14,400 requests/day on free tier
- ✅ **Structured Outputs** - GPT-OSS models support strict JSON-schema responses
- ✅ **Easy Signup** - Get started in minutes at https://console.groq.com

## License

This project is for educational purposes only.
