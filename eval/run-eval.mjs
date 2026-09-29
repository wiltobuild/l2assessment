/**
 * Offline evaluation of the rule-based triage pipeline (no API key needed).
 *
 *   npm run eval              # all case sets
 *   npm run eval -- --verbose # also list every miss
 *   npm run eval -- --llm     # use the Groq LLM for categories (needs VITE_GROQ_API_KEY)
 *
 * Case sets:
 *   dev-cases.json      - regression set; the rules are tuned against it
 *   holdout-cases.json  - written before tuning, but its results were seen during tuning
 *   holdout2-cases.json - written after tuning and not tuned against: the honest estimate
 *
 * The key safety metric is "buried emergencies": expected-High messages that
 * were neither flagged High nor sent to human review. The run fails if the dev
 * set buries any; holdout results are reported but don't fail the run.
 */
import { readFileSync, existsSync } from 'node:fs'
import { createServer } from 'vite'

const verbose = process.argv.includes('--verbose')
const useLlm = process.argv.includes('--llm')
// Stay under Groq's free-tier requests-per-minute limit
const LLM_DELAY_MS = 2500
const SETS = ['dev', 'holdout', 'holdout2']
const GATED_SET = 'dev'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
const { triageWithRules, triageMessage } = await server.ssrLoadModule('/src/utils/triage.js')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
let fallbacks = 0
const triage = async message => {
  if (!useLlm) return triageWithRules(message)
  await sleep(LLM_DELAY_MS)
  const result = await triageMessage(message)
  if (result.categorySource !== 'ai') fallbacks++
  return result
}
console.log(useLlm ? 'Mode: LLM + rules (higher urgency wins)' : 'Mode: rules only')

const pct = (n, d) => (d === 0 ? 'n/a' : `${Math.round((100 * n) / d)}%`)
let gatedFailures = 0

for (const name of SETS) {
  const file = new URL(`./${name}-cases.json`, import.meta.url)
  if (!existsSync(file)) continue
  const cases = JSON.parse(readFileSync(file, 'utf8'))

  let catOk = 0, urgOk = 0, reviewed = 0
  let highExpected = 0, highFlagged = 0, highPredicted = 0, buried = 0
  const misses = []

  for (const c of cases) {
    const t = await triage(c.message)
    if (t.category === c.category) catOk++
    if (t.urgency === c.urgency) urgOk++
    if (t.needsReview) reviewed++
    if (t.urgency === 'High') highPredicted++
    if (c.urgency === 'High') {
      highExpected++
      if (t.urgency === 'High') highFlagged++
      else if (!t.needsReview) buried++
    }
    if (t.category !== c.category || t.urgency !== c.urgency) {
      const flag = t.needsReview ? ' [review]' : ''
      misses.push(`  ${c.message.slice(0, 58).padEnd(58)}  cat ${t.category} (want ${c.category})  urg ${t.urgency} (want ${c.urgency})${flag}`)
    }
  }
  if (name === GATED_SET) gatedFailures += buried

  console.log(`\n${name} set (${cases.length} messages)`)
  console.log(`  Category accuracy:     ${pct(catOk, cases.length)} (${catOk}/${cases.length})`)
  console.log(`  Urgency accuracy:      ${pct(urgOk, cases.length)} (${urgOk}/${cases.length})`)
  console.log(`  Emergencies flagged:   ${pct(highFlagged, highExpected)} (${highFlagged}/${highExpected} marked High)`)
  console.log(`  Emergencies buried:    ${buried}/${highExpected} (not High and not sent to review)`)
  console.log(`  High precision:        ${pct(highFlagged, highPredicted)} (${highFlagged}/${highPredicted} High flags correct)`)
  console.log(`  Sent to human review:  ${pct(reviewed, cases.length)} (${reviewed}/${cases.length})`)
  if (verbose && misses.length) console.log(misses.join('\n'))
}

await server.close()
if (useLlm) console.log(`\nLLM calls that fell back to rules: ${fallbacks}`)

if (gatedFailures > 0) {
  console.error(`\nFAIL: ${gatedFailures} emergency message(s) in the ${GATED_SET} set were buried`)
  process.exit(1)
}
