'use client'

import { useState } from 'react'

type RfpSummary = {
  opportunity_title?: string
  agency?: string
  summary?: string
  due_date?: string
  evaluation_criteria?: string
  key_requirements?: string
}

export default function SummarizePage() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<RfpSummary | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSummarize = async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:8000/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfp_text: input }),
      })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      console.error('Summarization error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">AI RFP Summarizer</h1>
      <textarea
        className="w-full h-48 p-4 border border-gray-300 rounded mb-4"
        placeholder="Paste RFP text here..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <button
        onClick={handleSummarize}
        disabled={loading || !input}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? 'Summarizing...' : 'Summarize RFP'}
      </button>

      {result && (
        <div className="mt-8 bg-gray-100 p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Summary</h2>
          <p><strong>Title:</strong> {result.opportunity_title}</p>
          <p><strong>Agency:</strong> {result.agency}</p>
          <p><strong>Due Date:</strong> {result.due_date}</p>
          <p><strong>Summary:</strong> {result.summary}</p>
          <p><strong>Evaluation Criteria:</strong> {result.evaluation_criteria}</p>
          <p><strong>Key Requirements:</strong> {result.key_requirements}</p>
        </div>
      )}

    </main>
  )
}
