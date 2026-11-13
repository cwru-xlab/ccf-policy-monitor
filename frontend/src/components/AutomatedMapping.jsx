/*
  Dynamic Mapping on the Document Mappings page.

  The prototype's steps (start, pick a policy, search, review results, done),
  backed by the mapping engine: the backend agent proposes authorities and
  guideline URLs for the policy, and the user approves or rejects each one.
  An approved guideline is added to the Guideline Database and mapped to the
  policy (data/discoveredGuidelines.js).
*/

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  decideAuthority,
  decideProposal,
  discoverGuidelines,
  listAuthorities,
  listProposals,
} from '../api'
import { saveApprovedGuideline } from '../data/discoveredGuidelines'
import './AutomatedMapping.css'

function AutomatedMapping({ policies, onMapped }) {
  const [step, setStep] = useState(1)
  const [policyId, setPolicyId] = useState(null)
  const [search, setSearch] = useState('')
  const [proposals, setProposals] = useState([])
  const [authorities, setAuthorities] = useState([])
  const [selected, setSelected] = useState([])
  const [openDetails, setOpenDetails] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')

  const policy = policies.find((p) => String(p.id) === String(policyId))
  const visiblePolicies = policies.filter((p) =>
    String(p.name || '').toLowerCase().includes(search.toLowerCase())
  )
  const uploadedCount = policies.filter((p) => p.documentId).length

  async function loadResults(documentId) {
    const [pending, allAuthorities] = await Promise.all([
      listProposals({ status: 'proposed', policyDocumentId: documentId }),
      listAuthorities(),
    ])
    setProposals(pending)
    setAuthorities(allAuthorities.filter((a) => a.status === 'proposed'))
    setSelected([])
    return pending
  }

  async function choosePolicy(id) {
    const chosen = policies.find((p) => String(p.id) === String(id))
    setPolicyId(id)
    setError('')
    setStep(3)
    try {
      await loadResults(chosen.documentId)
    } catch (e) {
      setError(e.message)
    }
  }

  async function startSearch() {
    setBusy('Searching authoritative sources for guidelines. This usually takes 2–5 minutes…')
    setError('')
    try {
      const detail = await discoverGuidelines(policy.documentId)
      await loadResults(policy.documentId)
      const dropped = detail.dropped_unverified?.length || 0
      setSummary(
        `${detail.guidelines_proposed} new guideline${detail.guidelines_proposed === 1 ? '' : 's'} proposed` +
        (dropped ? `; ${dropped} unverified link${dropped === 1 ? '' : 's'} discarded.` : '.')
      )
      setStep(4)
    } catch (e) {
      setError(`Guideline search failed: ${e.message}`)
    } finally {
      setBusy('')
    }
  }

  function toggle(sourceId) {
    setSelected((prev) =>
      prev.includes(sourceId) ? prev.filter((id) => id !== sourceId) : [...prev, sourceId]
    )
  }

  async function decideSelected(status) {
    const chosen = proposals.filter((p) => selected.includes(p.source_id))
    setBusy(status === 'approved'
      ? `Fetching and mapping ${chosen.length} guideline${chosen.length === 1 ? '' : 's'}…`
      : 'Rejecting…')
    setError('')
    const failures = []
    let done = 0
    for (const proposal of chosen) {
      try {
        const mapping = await decideProposal(proposal.source_id, policy.documentId, status)
        if (status === 'approved') saveApprovedGuideline(mapping, policy)
        done++
      } catch (e) {
        failures.push(`${proposal.title}: ${e.message}`)
      }
    }
    setBusy('')
    onMapped()
    if (failures.length) setError(failures.join('\n'))
    if (status === 'approved' && done > 0) {
      setSummary(`${done} guideline${done === 1 ? '' : 's'} mapped to ${policy.name}.`)
      setStep(5)
    } else {
      await loadResults(policy.documentId)
    }
  }

  async function decideAuthorityStatus(authorityId, status) {
    try {
      await decideAuthority(authorityId, status)
      setAuthorities((prev) => prev.filter((a) => a.authority_id !== authorityId))
    } catch (e) {
      setError(e.message)
    }
  }

  function reset() {
    setStep(1)
    setPolicyId(null)
    setSearch('')
    setProposals([])
    setSelected([])
    setSummary('')
    setError('')
  }

  return (
    <section className="auto-card">
      {step === 1 && (
        <div className="auto-center">
          <h2>Dynamic Document Mapping</h2>
          <p className="auto-muted">
            Select a policy. The mapping engine searches authoritative bodies for
            relevant guidelines, and you approve which ones to map.
          </p>
          <div className="auto-actions" style={{ justifyContent: 'center' }}>
            <button type="button" className="auto-button" onClick={() => setStep(2)}>
              Select a Policy
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2>Select a Policy</h2>
          <p className="auto-muted">
            Choose a policy from your Policy Database. Only uploaded policies can be searched.
          </p>
          {uploadedCount === 0 && (
            <p className="auto-status">
              No uploaded policies yet. <Link to="/policies/new">Upload a policy</Link> to use
              dynamic mapping.
            </p>
          )}
          <input
            className="mapping-search"
            type="text"
            placeholder="Search policy database..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginTop: 16 }}
          />
          <div className="auto-list">
            {visiblePolicies.map((p) => (
              <button
                key={p.id}
                type="button"
                className="auto-item"
                disabled={!p.documentId}
                onClick={() => choosePolicy(p.id)}
              >
                <span className="auto-item-main">
                  <strong>{p.name}</strong>
                  <small>{p.documentId ? `Policy ID: ${p.id}` : 'Not uploaded — demo record'}</small>
                </span>
              </button>
            ))}
            {visiblePolicies.length === 0 && <p>No policies found.</p>}
          </div>
          <div className="auto-actions">
            <button type="button" className="auto-button-secondary" onClick={() => setStep(1)}>
              Back
            </button>
          </div>
        </div>
      )}

      {step === 3 && policy && (
        <div>
          <h2>Selected Policy</h2>
          <div className="auto-item" style={{ marginTop: 16 }}>
            <span className="auto-item-main">
              <strong>{policy.name}</strong>
              <small>Policy ID: {policy.id}</small>
            </span>
          </div>
          <p style={{ marginTop: 20 }}>
            Start the guideline search for this policy. The agent reads the policy, searches
            authoritative sources with Firecrawl, and proposes guidelines for your approval.
          </p>
          {proposals.length > 0 && (
            <p className="auto-muted">
              {proposals.length} proposal{proposals.length === 1 ? '' : 's'} from earlier runs
              {' '}{proposals.length === 1 ? 'is' : 'are'} waiting for review.
            </p>
          )}
          {busy && <p className="auto-status" role="status">{busy}</p>}
          {error && <p className="auto-error" role="alert">{error}</p>}
          <div className="auto-actions">
            <button type="button" className="auto-button-secondary" disabled={!!busy}
              onClick={() => setStep(2)}>
              Back
            </button>
            <div>
              {proposals.length > 0 && (
                <button type="button" className="auto-button-secondary" disabled={!!busy}
                  onClick={() => { setSummary(''); setStep(4) }}>
                  Review Pending ({proposals.length})
                </button>
              )}
              <button type="button" className="auto-button" disabled={!!busy}
                onClick={startSearch}>
                {busy ? 'Searching…' : 'Start Guideline Search'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 4 && policy && (
        <div>
          <h2>Guidelines Found</h2>
          <p className="auto-muted">
            Select guidelines to map to <strong>{policy.name}</strong>. {summary}
          </p>

          {authorities.length > 0 && (
            <>
              <h3>Proposed authorities</h3>
              <p className="auto-muted">
                Approved authorities are watched for new guidance on scheduled runs.
              </p>
              <div className="auto-list">
                {authorities.map((a) => (
                  <div key={a.authority_id} className="auto-item">
                    <div className="auto-item-main">
                      <strong>{a.name}</strong>{' '}
                      <a href={a.homepage_url} target="_blank" rel="noopener noreferrer">
                        {a.authority_id}
                      </a>
                      <small>{a.rationale}</small>
                    </div>
                    <div className="auto-item-buttons">
                      <button type="button" className="auto-button-secondary"
                        onClick={() => decideAuthorityStatus(a.authority_id, 'rejected')}>
                        Reject
                      </button>
                      <button type="button" className="auto-button"
                        onClick={() => decideAuthorityStatus(a.authority_id, 'approved')}>
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <h3>Proposed guidelines</h3>
          <div className="auto-list">
            {proposals.map((p) => {
              const checked = selected.includes(p.source_id)
              return (
                <div key={p.source_id} className={`auto-item ${checked ? 'selected' : ''}`}>
                  <div className="auto-item-main">
                    <label>
                      <input type="checkbox" checked={checked} onChange={() => toggle(p.source_id)} />
                      <span>
                        <strong>{p.title}</strong>
                        <small>{p.authority_name || new URL(p.url).hostname}</small>
                      </span>
                    </label>
                    {openDetails === p.source_id && (
                      <div className="auto-details">
                        <p style={{ marginTop: 0 }}>{p.rationale}</p>
                        <a href={p.url} target="_blank" rel="noopener noreferrer">{p.url}</a>
                      </div>
                    )}
                  </div>
                  <button type="button" className="auto-button-secondary"
                    onClick={() => setOpenDetails(openDetails === p.source_id ? null : p.source_id)}>
                    {openDetails === p.source_id ? 'Hide Details' : 'View Details'}
                  </button>
                </div>
              )
            })}
            {proposals.length === 0 && (
              <p>No guidelines are waiting for review for this policy.</p>
            )}
          </div>

          {busy && <p className="auto-status" role="status">{busy}</p>}
          {error && <p className="auto-error" role="alert" style={{ whiteSpace: 'pre-line' }}>{error}</p>}

          <div className="auto-actions">
            <button type="button" className="auto-button-secondary" disabled={!!busy}
              onClick={() => setStep(3)}>
              Back
            </button>
            <div>
              <button type="button" className="auto-button-secondary"
                disabled={!!busy || selected.length === 0}
                onClick={() => decideSelected('rejected')}>
                Reject Selected
              </button>
              <button type="button" className="auto-button"
                disabled={!!busy || selected.length === 0}
                onClick={() => decideSelected('approved')}>
                Map to Policy ({selected.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 5 && policy && (
        <div className="auto-center">
          <div style={{ fontSize: 42, color: 'var(--brand-green)' }}>✓</div>
          <h2>Guidelines Mapped Successfully</h2>
          <p role="status">{summary}</p>
          <p className="auto-muted">
            They are in the Guideline Database and tracked for updates; changes appear under
            {' '}<Link to="/mappings/automation">Mapping Automation</Link>.
          </p>
          {error && <p className="auto-error" role="alert" style={{ whiteSpace: 'pre-line' }}>{error}</p>}
          <div className="auto-actions" style={{ justifyContent: 'center' }}>
            <button type="button" className="auto-button-secondary"
              onClick={() => choosePolicy(policy.id)}>
              Review Remaining Proposals
            </button>
            <button type="button" className="auto-button" onClick={reset}>
              Start Another Mapping
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export default AutomatedMapping
