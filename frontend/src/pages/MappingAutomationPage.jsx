/*
  Mapping Automation (/mappings/automation): set up the mapping engine.

  Schedule, guideline-update notifications, proposals waiting for approval
  (from scheduled or earlier runs), the tracked guideline list, and the
  authorities that scope scheduled discovery.
*/

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  addTrackedSource,
  checkGuidelineUpdates,
  decideAuthority,
  decideProposal,
  getMappingSchedule,
  listAuthorities,
  listGuidelineChanges,
  listProposals,
  listTrackedSources,
  markGuidelineChangeRead,
  pauseTrackedSource,
  runMappingScheduleNow,
  saveMappingSchedule,
  untrackSource,
} from '../api'
import {
  findPolicyByDocumentId,
  saveApprovedGuideline,
  syncTrackedGuidelines,
} from '../data/discoveredGuidelines'
import '../components/AutomatedMapping.css'

const INTERVALS = [
  { hours: 24, label: 'Daily' },
  { hours: 168, label: 'Weekly' },
  { hours: 336, label: 'Every 2 weeks' },
  { hours: 720, label: 'Monthly' },
]

function getSavedArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

const formatTime = (value) => (value ? new Date(value).toLocaleString() : '—')

function policyName(documentId) {
  return findPolicyByDocumentId(documentId)?.name || documentId
}

function MappingAutomationPage() {
  const [schedule, setSchedule] = useState(null)
  const [enabled, setEnabled] = useState(false)
  const [interval, setIntervalHours] = useState(168)
  const [changes, setChanges] = useState([])
  const [proposals, setProposals] = useState([])
  const [sources, setSources] = useState([])
  const [authorities, setAuthorities] = useState([])
  const [newUrl, setNewUrl] = useState('')
  const [newUrlPolicy, setNewUrlPolicy] = useState('')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const uploadedPolicies = getSavedArray('addedPolicies').filter((p) => p.documentId)

  const load = useCallback(async () => {
    try {
      const [s, c, p, t, a] = await Promise.all([
        getMappingSchedule(),
        listGuidelineChanges(),
        listProposals({ status: 'proposed' }),
        listTrackedSources(),
        listAuthorities(),
      ])
      setSchedule(s)
      setEnabled(s.enabled)
      setIntervalHours(s.interval_hours)
      setChanges(c)
      setProposals(p)
      setSources(t)
      syncTrackedGuidelines(t)
      setAuthorities(a)
    } catch (e) {
      setError(`Could not load the mapping engine: ${e.message}`)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Run one action with a status line, then reload everything.
  async function act(label, work, done) {
    setBusy(label)
    setError('')
    setNotice('')
    try {
      const result = await work()
      if (done) setNotice(done(result))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
      await load()
    }
  }

  const saveSchedule = () =>
    act('Saving schedule…', () => saveMappingSchedule(enabled, Number(interval)), () => 'Schedule saved.')

  const runNow = () =>
    act('Running discovery and update checks for all mapped policies. This can take several minutes…',
      runMappingScheduleNow,
      (d) => {
        const proposed = d.discovery.reduce((n, r) => n + (r.guidelines_proposed || 0), 0)
        return `Run finished: ${proposed} new proposal${proposed === 1 ? '' : 's'}, ` +
          `${d.updates.changed} guideline update${d.updates.changed === 1 ? '' : 's'} ` +
          `(${d.updates.checked} checked).`
      })

  const checkNow = () =>
    act('Checking tracked guidelines for changes…', checkGuidelineUpdates,
      (d) => `${d.checked} checked, ${d.changed} material change${d.changed === 1 ? '' : 's'}` +
        (d.failed.length ? `, ${d.failed.length} could not be fetched.` : '.'))

  const decide = (proposal, status) =>
    act(status === 'approved' ? 'Fetching and approving guideline…' : 'Rejecting…', async () => {
      const mapping = await decideProposal(proposal.source_id, proposal.policy_document_id, status)
      if (status === 'approved') {
        saveApprovedGuideline(mapping, findPolicyByDocumentId(proposal.policy_document_id))
      }
    })

  const addUrl = (event) => {
    event.preventDefault()
    act('Fetching guideline…', async () => {
      const mapping = await addTrackedSource(newUrl.trim(), newUrlPolicy)
      saveApprovedGuideline(mapping, findPolicyByDocumentId(newUrlPolicy))
      setNewUrl('')
    }, () => 'Guideline added and tracked.')
  }

  const unread = changes.filter((c) => !c.read_at).length

  return (
    <div className="app-page">
      <header className="top-bar">
        <div className="brand-area">
          <span className="brand-name">Policy Review</span>
          <span className="brand-divider" />
          <span className="workspace-name">Policy Review Workspace</span>
        </div>
        <div className="top-right">
          <div className="user-area">
            <div className="user-avatar">SC</div>
            <span>Sarah Chen</span>
          </div>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <Link to="/dashboard" className="nav-item">Dashboard</Link>
          <Link to="/reviews" className="nav-item">Review Sessions</Link>
          <Link to="/policies" className="nav-item">Policy Database</Link>
          <Link to="/guidelines" className="nav-item">Guideline Database</Link>
          <Link to="/mappings" className="nav-item active">Document Mappings</Link>
          <Link to="/audit-log" className="nav-item">Audit Log</Link>
        </aside>

        <main className="automation-content">
          <div>
            <Link to="/mappings" className="back-link">← Document Mappings</Link>
            <div className="mapping-heading">
              <h1>Mapping Automation</h1>
              <p>
                Scheduled discovery of guidelines from approved authorities, and tracking of
                mapped guidelines for updates. Every new guideline waits for your approval.
              </p>
            </div>
          </div>

          {schedule && !schedule.firecrawl_configured && (
            <p className="auto-error">
              The backend has no FIRECRAWL_API_KEY, so searches and update checks are disabled.
            </p>
          )}
          {busy && <p className="auto-status" role="status">{busy}</p>}
          {notice && <p className="auto-status" role="status">{notice}</p>}
          {error && <p className="auto-error" role="alert">{error}</p>}

          {/* SCHEDULE */}
          <section className="auto-card">
            <h2>Scheduled runs</h2>
            <p className="auto-muted">
              Each run searches approved authorities for new guidance on every policy that has
              been through dynamic mapping, then checks tracked guidelines for changes.
            </p>
            <div className="automation-form">
              <label>
                <input type="checkbox" checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)} />{' '}
                Run automatically
              </label>
              <select value={interval} onChange={(e) => setIntervalHours(e.target.value)}
                aria-label="Run frequency">
                {INTERVALS.map((i) => <option key={i.hours} value={i.hours}>{i.label}</option>)}
                {!INTERVALS.some((i) => i.hours === Number(interval)) && (
                  <option value={interval}>Every {interval} hours</option>
                )}
              </select>
              <button type="button" className="auto-button" disabled={!!busy} onClick={saveSchedule}>
                Save Schedule
              </button>
              <button type="button" className="auto-button-secondary" disabled={!!busy} onClick={runNow}>
                Run Now
              </button>
            </div>
            <p className="auto-muted">
              Last run: {formatTime(schedule?.last_run_at)} · Next run:{' '}
              {schedule?.enabled ? formatTime(schedule?.next_run_at) : 'not scheduled'}
            </p>
          </section>

          {/* UPDATES */}
          <section className="auto-card">
            <div className="auto-actions" style={{ marginTop: 0 }}>
              <h2>Guideline updates {unread > 0 && <span className="auto-badge unread">{unread} new</span>}</h2>
              <button type="button" className="auto-button-secondary" disabled={!!busy} onClick={checkNow}>
                Check for Updates Now
              </button>
            </div>
            <div className="auto-list">
              {changes.map((c) => (
                <div key={c.change_id} className="auto-item">
                  <div className="auto-item-main">
                    <strong>{c.title}</strong>{' '}
                    {!c.read_at && <span className="auto-badge unread">New</span>}
                    <small>Detected {formatTime(c.detected_at)}</small>
                    <p style={{ margin: '8px 0' }}>{c.summary}</p>
                    <a href={c.url} target="_blank" rel="noopener noreferrer">{c.url}</a>
                  </div>
                  {!c.read_at && (
                    <button type="button" className="auto-button-secondary"
                      onClick={() => act('', () => markGuidelineChangeRead(c.change_id))}>
                      Mark as Read
                    </button>
                  )}
                </div>
              ))}
              {changes.length === 0 && <p className="auto-muted">No guideline updates detected yet.</p>}
            </div>
          </section>

          {/* PENDING APPROVALS */}
          <section className="auto-card">
            <h2>Waiting for approval</h2>
            <p className="auto-muted">Guidelines proposed by discovery runs.</p>
            <div className="auto-list">
              {proposals.map((p) => (
                <div key={`${p.source_id}-${p.policy_document_id}`} className="auto-item">
                  <div className="auto-item-main">
                    <strong>{p.title}</strong>{' '}
                    <span className="auto-badge proposed">{p.origin}</span>
                    <small>For {policyName(p.policy_document_id)} · {p.authority_name || new URL(p.url).hostname}</small>
                    <p style={{ margin: '8px 0' }}>{p.rationale}</p>
                    <a href={p.url} target="_blank" rel="noopener noreferrer">{p.url}</a>
                  </div>
                  <div className="auto-item-buttons">
                    <button type="button" className="auto-button-secondary" disabled={!!busy}
                      onClick={() => decide(p, 'rejected')}>Reject</button>
                    <button type="button" className="auto-button" disabled={!!busy}
                      onClick={() => decide(p, 'approved')}>Approve</button>
                  </div>
                </div>
              ))}
              {proposals.length === 0 && <p className="auto-muted">Nothing is waiting for approval.</p>}
            </div>
          </section>

          {/* TRACKED GUIDELINES */}
          <section className="auto-card">
            <h2>Tracked guidelines</h2>
            <p className="auto-muted">Approved guidelines checked for updates on each run.</p>
            <div className="auto-list">
              {sources.map((s) => (
                <div key={s.source_id} className="auto-item">
                  <div className="auto-item-main">
                    <strong>{s.title}</strong>{' '}
                    {s.paused && <span className="auto-badge rejected">Paused</span>}
                    <small>
                      {s.policy_document_ids.map(policyName).join(', ')} · last checked{' '}
                      {formatTime(s.last_checked_at)}
                      {s.last_changed_at && ` · changed ${formatTime(s.last_changed_at)}`}
                    </small>
                    <a href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a>
                  </div>
                  <div className="auto-item-buttons">
                    <button type="button" className="auto-button-secondary" disabled={!!busy}
                      onClick={() => act('', () => pauseTrackedSource(s.source_id, !s.paused))}>
                      {s.paused ? 'Resume' : 'Pause'}
                    </button>
                    <button type="button" className="auto-button-secondary" disabled={!!busy}
                      onClick={() => window.confirm(`Stop tracking "${s.title}"?`) &&
                        act('', () => untrackSource(s.source_id), () => 'Guideline removed from tracking.')}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {sources.length === 0 && <p className="auto-muted">No guidelines are tracked yet.</p>}
            </div>
            <h3>Add a guideline URL</h3>
            <form className="automation-form" onSubmit={addUrl}>
              <input type="url" required placeholder="https://…" value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)} aria-label="Guideline URL" />
              <select required value={newUrlPolicy} onChange={(e) => setNewUrlPolicy(e.target.value)}
                aria-label="Policy">
                <option value="">Map to policy…</option>
                {uploadedPolicies.map((p) => <option key={p.id} value={p.documentId}>{p.name}</option>)}
              </select>
              <button type="submit" className="auto-button" disabled={!!busy}>Add and Track</button>
            </form>
          </section>

          {/* AUTHORITIES */}
          <section className="auto-card">
            <h2>Authorities</h2>
            <p className="auto-muted">Scheduled discovery searches only approved authorities.</p>
            <div className="auto-list">
              {authorities.map((a) => (
                <div key={a.authority_id} className="auto-item">
                  <div className="auto-item-main">
                    <strong>{a.name}</strong>{' '}
                    <span className={`auto-badge ${a.status}`}>{a.status}</span>
                    <small>
                      <a href={a.homepage_url} target="_blank" rel="noopener noreferrer">{a.authority_id}</a>
                      {' · '}{a.rationale}
                    </small>
                  </div>
                  <div className="auto-item-buttons">
                    {a.status !== 'rejected' && (
                      <button type="button" className="auto-button-secondary" disabled={!!busy}
                        onClick={() => act('', () => decideAuthority(a.authority_id, 'rejected'))}>
                        Reject
                      </button>
                    )}
                    {a.status !== 'approved' && (
                      <button type="button" className="auto-button" disabled={!!busy}
                        onClick={() => act('', () => decideAuthority(a.authority_id, 'approved'))}>
                        Approve
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {authorities.length === 0 && (
                <p className="auto-muted">No authorities yet. Run dynamic mapping for a policy first.</p>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default MappingAutomationPage
