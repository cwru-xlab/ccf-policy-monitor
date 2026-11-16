
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import './DashboardPage.css'
import './AuditLogPage.css'

function getSavedArray(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function formatDate(value) {
  if (!value) return 'Date unavailable'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const navigation = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Review Sessions', path: '/reviews' },
  { label: 'Policy Database', path: '/policies' },
  { label: 'Guideline Database', path: '/guidelines' },
  { label: 'Document Mappings', path: '/mappings' },
  { label: 'Audit Log', path: '/audit-log' },
]

function AuditLogPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('Newest first')
  const [helpOpen, setHelpOpen] = useState(false)

  // Load existing browser data
  const policyVersions = getSavedArray('policyVersions')
  const recommendationDecisions = getSavedArray(
    'recommendationDecisions'
  )
  const createdReviews = getSavedArray('createdReviews')
  const addedPolicies = getSavedArray('addedPolicies')
  const addedGuidelines = getSavedArray('addedGuidelines')
  const auditEvents = getSavedArray('auditEvents')

  // Policy version history
  const policyRecords = policyVersions.map((version, index) => ({
    id: `policy-${version.id || index}`,
    date: version.createdAt || '',
    user: version.reviewer || 'Sarah Chen',
    action: 'Policy Updated',
    category: 'Policy Changes',
    item: version.originalPolicy || version.policy || 'Policy',
    details: version.reviewName
      ? `Updated during ${version.reviewName}`
      : 'Saved a new policy version',
    rationale: '',
  }))

  // Prevent duplicate recommendation decision records
  function hasDecisionAuditEvent(decision) {
    return auditEvents.some((event) => {
      const isDecisionEvent =
        event.type === 'Recommendation Decision' ||
        event.category === 'Recommendation Decisions'

      return (
        isDecisionEvent &&
        String(event.reviewId ?? '') ===
          String(decision.reviewId ?? '') &&
        String(event.findingId ?? '') ===
          String(decision.findingId ?? '') &&
        (
          (event.timestamp &&
            event.timestamp === decision.decidedAt) ||
          (event.decision === decision.decision &&
            event.decisionRationale ===
              decision.decisionRationale)
        )
      )
    })
  }

  // Recommendation decision history
  const decisionRecords = recommendationDecisions
    .filter((decision) => !hasDecisionAuditEvent(decision))
    .map((decision, index) => ({
      id: `decision-${decision.id || index}`,
      date: decision.decidedAt || '',
      user: decision.reviewer || 'Sarah Chen',
      action: decision.decision || 'Decision Recorded',
      category: 'Recommendation Decisions',
      item: decision.policy || 'Policy recommendation',
      details: decision.guideline
        ? `Reference guideline: ${decision.guideline}`
        : 'Reviewed a policy recommendation',
      rationale: decision.decisionRationale || '',
    }))

  // Review session history
  const reviewRecords = createdReviews.map((review, index) => ({
    id: `review-${review.id || index}`,
    date: review.createdAt || review.date || '',
    user: review.reviewer || 'Sarah Chen',
    action: 'Review Session Created',
    category: 'Review Sessions',
    item: review.name || 'Untitled Review Session',
    details:
      review.description || 'Created a new review session',
    rationale: '',
  }))

  // Explicit audit events
  const eventRecords = auditEvents.map((event, index) => {
    const isDecision =
      event.type === 'Recommendation Decision' ||
      event.category === 'Recommendation Decisions'

    return {
      id: `event-${event.id || index}`,
      date:
        event.timestamp ||
        event.createdAt ||
        event.date ||
        '',
      user: event.user || event.reviewer || 'Sarah Chen',
      action: event.action || 'Change Recorded',
      category: isDecision
        ? 'Recommendation Decisions'
        : event.category || 'Policy Changes',
      item:
        event.item ||
        event.policy ||
        'Unknown item',
      details:
        event.details ||
        (isDecision && event.guideline
          ? `Reference guideline: ${event.guideline}`
          : event.description || ''),
      rationale: isDecision
        ? event.decisionRationale || event.rationale || ''
        : '',
    }
  })

  // Check for upload events already recorded
  function hasUploadEvent(category, name) {
    return eventRecords.some(
      (record) =>
        record.category === category &&
        record.item === name &&
        /upload|add|creat/i.test(record.action)
    )
  }

  // Policy uploads without explicit audit events
  const uploadedPolicyRecords = addedPolicies
    .filter(
      (policy) =>
        !hasUploadEvent('Policy Changes', policy.name)
    )
    .map((policy, index) => ({
      id: `uploaded-policy-${policy.id || index}`,
      date:
        policy.createdAt ||
        policy.date ||
        policy.created ||
        '',
      user: 'Sarah Chen',
      action: 'Policy Uploaded',
      category: 'Policy Changes',
      item: policy.name || 'Unnamed Policy',
      details: policy.fileName
        ? `Document: ${policy.fileName}`
        : 'Added to Policy Database',
      rationale: '',
    }))

  // Guideline uploads without explicit audit events
  const uploadedGuidelineRecords = addedGuidelines
    .filter(
      (guideline) =>
        !hasUploadEvent('Guideline Changes', guideline.name)
    )
    .map((guideline, index) => ({
      id: `uploaded-guideline-${guideline.id || index}`,
      date:
        guideline.createdAt ||
        guideline.created ||
        guideline.date ||
        '',
      user: 'Sarah Chen',
      action: 'Guideline Uploaded',
      category: 'Guideline Changes',
      item: guideline.name || 'Unnamed Guideline',
      details: guideline.fileName
        ? `Document: ${guideline.fileName}`
        : 'Added to Guideline Database',
      rationale: '',
    }))

  // Combine all audit records
  const allRecords = [
    ...policyRecords,
    ...decisionRecords,
    ...reviewRecords,
    ...uploadedPolicyRecords,
    ...uploadedGuidelineRecords,
    ...eventRecords,
  ]

  // Search and filter
  const visibleRecords = allRecords
    .filter((record) => {
      const matchesSearch = [
        record.action,
        record.category,
        record.item,
        record.user,
        record.details,
        record.rationale,
      ]
        .join(' ')
        .toLowerCase()
        .includes(search.trim().toLowerCase())

      const matchesFilter =
        filter === 'All' || record.category === filter

      return matchesSearch && matchesFilter
    })
    .sort((a, b) => {
      const aTime = new Date(a.date).getTime() || 0
      const bTime = new Date(b.date).getTime() || 0

      return sort === 'Oldest first'
        ? aTime - bTime
        : bTime - aTime
    })

  // Summary counts
  const policyCount = allRecords.filter(
    (record) => record.category === 'Policy Changes'
  ).length

  const guidelineCount = allRecords.filter(
    (record) => record.category === 'Guideline Changes'
  ).length

  const decisionCount = allRecords.filter(
    (record) =>
      record.category === 'Recommendation Decisions'
  ).length

  const reviewCount = allRecords.filter(
    (record) => record.category === 'Review Sessions'
  ).length

  const mappingCount = allRecords.filter(
    (record) => record.category === 'Document Mappings'
  ).length

  return (
    <div className="app-page ccf-dashboard ccf-audit-page">
      {/* HEADER */}
      <header className="top-bar">
        <div className="brand-area">
          <span className="brand-name">CCF</span>
          <span className="brand-divider" />
          <span className="workspace-name">
            Insurance Policy Review Workspace
          </span>
        </div>

        <div className="top-right">
          <button
            type="button"
            className="ccf-help-button"
            aria-label="Help with Audit Log"
            onClick={() => setHelpOpen(true)}
          >
            ?
          </button>

          <div className="user-area">
            <div className="user-avatar">SC</div>
            <span>Sarah Chen</span>
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* SIDEBAR */}
        <aside className="sidebar" aria-label="Main navigation">
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-item${isActive ? ' active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </aside>

        {/* MAIN CONTENT */}
        <main className="ccf-audit-content">
          <div className="ccf-audit-heading">
            <h1>Audit Log</h1>
            <p>
              Track policy and guideline changes, review
              sessions, recommendation decisions, reviewer
              rationales, and document mappings.
            </p>
          </div>

          {/* SUMMARY CARDS */}
          <div className="ccf-audit-stats">
            <div className="ccf-audit-stat">
              <span>Total Events</span>
              <strong>{allRecords.length}</strong>
            </div>

            <div className="ccf-audit-stat">
              <span>Policy Changes</span>
              <strong>{policyCount}</strong>
            </div>

            <div className="ccf-audit-stat">
              <span>Guideline Changes</span>
              <strong>{guidelineCount}</strong>
            </div>

            <div className="ccf-audit-stat">
              <span>Decisions</span>
              <strong>{decisionCount}</strong>
            </div>

            <div className="ccf-audit-stat">
              <span>Review Sessions</span>
              <strong>{reviewCount}</strong>
            </div>

            <div className="ccf-audit-stat">
              <span>Document Mappings</span>
              <strong>{mappingCount}</strong>
            </div>
          </div>

          {/* AUDIT HISTORY */}
          <section className="ccf-audit-panel">
            <div className="ccf-audit-panel-heading">
              <div>
                <h2>Activity History</h2>
                <p>
                  Browse and filter recorded workspace activity.
                </p>
              </div>

              <span className="ccf-audit-count">
                {visibleRecords.length} events
              </span>
            </div>

            <div className="ccf-audit-controls">
              <input
                type="search"
                className="ccf-audit-search"
                placeholder="Search audit history or rationale..."
                aria-label="Search audit history"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />

              <label className="ccf-audit-select-label">
                <span>Category</span>
                <select
                  value={filter}
                  onChange={(event) =>
                    setFilter(event.target.value)
                  }
                >
                  <option value="All">All Actions</option>
                  <option value="Policy Changes">
                    Policy Changes
                  </option>
                  <option value="Guideline Changes">
                    Guideline Changes
                  </option>
                  <option value="Recommendation Decisions">
                    Recommendation Decisions
                  </option>
                  <option value="Review Sessions">
                    Review Sessions
                  </option>
                  <option value="Document Mappings">
                    Document Mappings
                  </option>
                </select>
              </label>

              <label className="ccf-audit-select-label">
                <span>Sort by</span>
                <select
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value)
                  }
                >
                  <option value="Newest first">
                    Newest first
                  </option>
                  <option value="Oldest first">
                    Oldest first
                  </option>
                </select>
              </label>
            </div>

            {/* SCROLLABLE TABLE */}
            <div className="ccf-audit-table-scroll">
              <table className="ccf-audit-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Category</th>
                    <th>Item</th>
                    <th>Details</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="ccf-audit-date">
                        {formatDate(record.date)}
                      </td>

                      <td>{record.user}</td>

                      <td>
                        <strong className="ccf-audit-action">
                          {record.action}
                        </strong>
                      </td>

                      <td>
                        <span className="ccf-audit-category">
                          {record.category}
                        </span>
                      </td>

                      <td className="ccf-audit-item">
                        {record.item}
                      </td>

                      <td className="ccf-audit-details">
                        <div>{record.details}</div>

                        {record.rationale && (
                          <div className="ccf-audit-rationale">
                            <strong>
                              Reviewer Decision Rationale
                            </strong>
                            <p>{record.rationale}</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}

                  {visibleRecords.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="ccf-audit-empty"
                      >
                        {allRecords.length === 0
                          ? 'No recorded changes yet. Upload a policy or guideline, create a review session, or save a mapping to see activity here.'
                          : 'No audit records match your search or filter.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="ccf-audit-table-footer">
              Showing {visibleRecords.length} of{' '}
              {allRecords.length} events
            </div>
          </section>

          <p className="ccf-audit-notice">
            This prototype displays records saved in this browser.
            Audit history is not shared across users or devices,
            and browser storage can be changed or cleared.
            Records inferred from existing database items may
            not have exact timestamps. Deleted items appear
            when their pages save deletion events.
          </p>
        </main>
      </div>

      {/* HELP DIALOG */}
      {helpOpen && (
        <div
          className="ccf-audit-help-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setHelpOpen(false)
            }
          }}
        >
          <div
            className="ccf-audit-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-help-title"
          >
            <div className="ccf-audit-help-heading">
              <h2 id="audit-help-title">
                Audit Log Help
              </h2>

              <button
                type="button"
                aria-label="Close help"
                onClick={() => setHelpOpen(false)}
              >
                ×
              </button>
            </div>

            <p>
              The Audit Log displays recorded changes made
              throughout the workspace.
            </p>

            <p>
              Use the search bar to find events by policy,
              guideline, action, user, or reviewer rationale.
            </p>

            <p>
              Use Category to filter activity and Sort by
              to change the order of events.
            </p>

            <p>
              The activity is stored in your browser for
              this prototype, not in a shared audit database.
            </p>

            <button
              type="button"
              className="ccf-audit-primary-button"
              onClick={() => setHelpOpen(false)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AuditLogPage
