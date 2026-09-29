import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { CATEGORIES } from '../utils/llmHelper'
import { byPriority } from '../utils/triage'

const URGENCY_LEVELS = ['High', 'Medium', 'Low']

const PRIORITY_STYLES = {
  High: 'bg-red-200 text-red-900',
  Review: 'bg-amber-200 text-amber-900',
  Medium: 'bg-yellow-200 text-yellow-900',
  Low: 'bg-green-200 text-green-900',
}

const loadHistory = () =>
  JSON.parse(localStorage.getItem('triageHistory') || '[]').map((item, id) => ({ ...item, id }))

const saveHistory = history =>
  localStorage.setItem('triageHistory', JSON.stringify(history, (key, value) => (key === 'id' ? undefined : value)))

// What the agent says the triage should be, falling back to the automatic result
const finalCategory = item => item.label?.category ?? item.category
const finalUrgency = item => item.label?.urgency ?? item.urgency
const finalPriority = item =>
  item.label ? item.label.urgency : item.priority ?? item.urgency

function HistoryPage() {
  const [history, setHistory] = useState(loadHistory)
  const [filter, setFilter] = useState('all')
  const [sortMode, setSortMode] = useState('priority')
  const [expandedId, setExpandedId] = useState(null)
  const [draft, setDraft] = useState(null)

  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear all history?')) {
      localStorage.setItem('triageHistory', '[]')
      setHistory([])
    }
  }

  const toggleExpanded = item => {
    if (expandedId === item.id) {
      setExpandedId(null)
    } else {
      setExpandedId(item.id)
      setDraft({ category: finalCategory(item), urgency: finalUrgency(item) })
    }
  }

  const saveLabel = item => {
    const updated = history.map(h => (h.id === item.id ? { ...h, label: draft } : h))
    setHistory(updated)
    saveHistory(updated)
  }

  const exportLabels = () => {
    const cases = history
      .filter(item => item.label)
      .map(item => ({ message: item.message, category: item.label.category, urgency: item.label.urgency }))
    const blob = new Blob([JSON.stringify(cases, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'labeled-cases.json'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const sortedHistory = [...history].sort((a, b) =>
    sortMode === 'priority'
      ? byPriority({ ...a, priority: finalPriority(a) }, { ...b, priority: finalPriority(b) })
      : new Date(b.timestamp) - new Date(a.timestamp)
  )

  const filteredHistory = filter === 'all'
    ? sortedHistory
    : sortedHistory.filter(item => finalCategory(item) === filter)

  const categories = [...new Set(history.map(finalCategory))]
  const labeledCount = history.filter(item => item.label).length
  const changedCount = history.filter(item =>
    item.label && (item.label.category !== item.category || item.label.urgency !== item.urgency)
  ).length

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Triage Queue</h1>
              <p className="text-gray-600">
                Most pressing first. Open a message to confirm or correct its triage.
              </p>
            </div>
            {history.length > 0 && (
              <div className="flex space-x-2">
                <button
                  onClick={exportLabels}
                  disabled={labeledCount === 0}
                  title="Download reviewed messages in the eval/ case format"
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    labeledCount === 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Export {labeledCount} reviewed
                </button>
                <button
                  onClick={clearHistory}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 font-semibold"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {labeledCount > 0 && (
            <p className="text-sm text-gray-600 mb-4">
              Agents reviewed {labeledCount} message{labeledCount === 1 ? '' : 's'} and changed the automatic
              triage on {changedCount} ({Math.round((100 * changedCount) / labeledCount)}%).
            </p>
          )}

          {/* Sort and Filter */}
          {history.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <select
                value={sortMode}
                onChange={e => setSortMode(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 font-semibold text-gray-700"
              >
                <option value="priority">Sort: Priority</option>
                <option value="newest">Sort: Newest</option>
              </select>
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-semibold ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({history.length})
              </button>
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setFilter(category)}
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    filter === category
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category} ({history.filter(h => finalCategory(h) === category).length})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* History List */}
        {filteredHistory.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-5xl mb-4">📭</div>
            <div className="text-xl text-gray-600 mb-2">No history yet</div>
            <p className="text-gray-500 mb-6">
              Analyzed messages will appear here
            </p>
            <a
              href="/analyze"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold"
            >
              Analyze a Message
            </a>
          </div>
        )}

        <div className="space-y-4">
          {filteredHistory.map(item => {
            const priority = finalPriority(item)
            return (
              <div
                key={item.id}
                className="bg-white rounded-lg shadow-md overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleExpanded(item)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-sm text-gray-500 mb-1">
                        {new Date(item.timestamp).toLocaleString()}
                      </div>
                      <div className="text-gray-800 font-medium mb-2">
                        "{item.message.substring(0, 100)}{item.message.length > 100 ? '...' : ''}"
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.Low}`}>
                          {priority === 'Review' ? 'Needs review' : `${priority} Urgency`}
                        </span>
                        {item.escalate && !item.label && (
                          <span className="text-xs bg-red-600 text-white px-3 py-1 rounded-full font-semibold">
                            Escalate
                          </span>
                        )}
                        <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">
                          {finalCategory(item)}
                        </span>
                        {item.label && (
                          <span className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-semibold">
                            ✓ Reviewed
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-gray-400 ml-4">
                      {expandedId === item.id ? '▲' : '▼'}
                    </div>
                  </div>
                </div>

                {expandedId === item.id && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-semibold text-gray-600 mb-1">Full Message</div>
                        <div className="text-sm text-gray-800 bg-white p-3 rounded border border-gray-200">
                          {item.message}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-600 mb-1">Recommended Action</div>
                        <div className="text-sm text-gray-800 bg-purple-50 p-3 rounded border border-purple-200">
                          {item.recommendedAction}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-600 mb-1">AI Reasoning</div>
                        <div className="bg-white p-3 rounded border border-gray-200">
                          <div className="prose prose-sm max-w-none text-gray-700">
                            <ReactMarkdown>
                              {item.reasoning}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-600 mb-1">
                          Agent review
                          <span className="font-normal text-gray-500">
                            {' '}(automatic: {item.category}, {item.urgency})
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={draft.category}
                            onChange={e => setDraft({ ...draft, category: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <select
                            value={draft.urgency}
                            onChange={e => setDraft({ ...draft, urgency: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          >
                            {URGENCY_LEVELS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                          <button
                            onClick={() => saveLabel(item)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold"
                          >
                            {item.label ? 'Update review' : 'Confirm'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default HistoryPage
