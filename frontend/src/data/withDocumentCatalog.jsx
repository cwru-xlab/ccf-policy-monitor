import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listPolicies, listGuidelines } from '../api'
import { policyRecord, guidelineRecords, savedArray } from './documentCatalog'

// Mount each screen only after the catalog loads, so saved selections are
// validated against the actual database rather than a temporary empty list.
export function withDocumentCatalog(Page) {
  return function DocumentCatalogPage() {
    const [catalog, setCatalog] = useState(null)
    const [error, setError] = useState('')
    const [attempt, setAttempt] = useState(0)
    useEffect(() => {
      let active = true
      setError('')
      Promise.all([listPolicies(), listGuidelines()]).then(([policies, guidelines]) => {
        if (active) setCatalog({
          policies: policies.map((row) => policyRecord(row, savedArray('addedPolicies'))),
          guidelines: guidelineRecords(guidelines, savedArray('addedGuidelines')),
        })
      }).catch((err) => { if (active) setError(err.message) })
      return () => { active = false }
    }, [attempt])
    if (!catalog) return (
      <main className="app-page" style={{ padding: 32 }}>
        {error ? <>
          <p role="alert">Could not load the document database: {error}</p>
          <button onClick={() => setAttempt(attempt + 1)}>Retry</button>
        </> : <p role="status">Loading document database…</p>}
        <p><Link to="/dashboard">Back to dashboard</Link></p>
      </main>
    )
    return <Page catalog={catalog} />
  }
}
