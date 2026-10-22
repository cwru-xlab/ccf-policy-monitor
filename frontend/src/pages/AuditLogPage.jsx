
import { useState } from 'react'
import { Link } from 'react-router-dom'

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

function AuditLogPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  // ==========================================
  // READ SAVED DATA
  // ==========================================

  const policyVersions = getSavedArray('policyVersions')
  const recommendationDecisions = getSavedArray(
    'recommendationDecisions'
  )
  const createdReviews = getSavedArray('createdReviews')
  const addedPolicies = getSavedArray('addedPolicies')
  const addedGuidelines = getSavedArray('addedGuidelines')
  const auditEvents = getSavedArray('auditEvents')

  // ==========================================
  // POLICY VERSION HISTORY
  // ==========================================

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

  // ==========================================
  // RECOMMENDATION DECISION HISTORY
  // ==========================================

  // New decisions have dedicated audit events.
  // Older decisions may only exist in recommendationDecisions.
  // Only use those older records when there is no matching
  // audit event, to avoid displaying duplicate decisions.

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

  // ==========================================
  // REVIEW SESSION HISTORY
  // ==========================================

  const reviewRecords = createdReviews.map((review, index) => ({
    id: `review-${review.id || index}`,
    date: review.createdAt || review.date || '',
    user: review.reviewer || 'Sarah Chen',
    action: 'Review Session Created',
    category: 'Review Sessions',
    item: review.name || 'Untitled Review Session',
    details: review.description || 'Created a new review session',
    rationale: '',
  }))

  // ==========================================
  // EXPLICIT AUDIT EVENTS
  // ==========================================

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
        (
          isDecision && event.guideline
            ? `Reference guideline: ${event.guideline}`
            : event.description || ''
        ),
      rationale: isDecision
        ? event.decisionRationale || event.rationale || ''
        : '',
    }
  })

  // ==========================================
  // UPLOADED POLICY / GUIDELINE HISTORY
  // ==========================================

  function hasUploadEvent(category, name) {
    return eventRecords.some(
      (record) =>
        record.category === category &&
        record.item === name &&
        /upload|add|creat/i.test(record.action)
    )
  }

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

  // ==========================================
  // COMBINE AND SORT
  // ==========================================

  const allRecords = [
    ...policyRecords,
    ...decisionRecords,
    ...reviewRecords,
    ...uploadedPolicyRecords,
    ...uploadedGuidelineRecords,
    ...eventRecords,
  ].sort((a, b) => {
    const aTime = new Date(a.date).getTime() || 0
    const bTime = new Date(b.date).getTime() || 0

    return bTime - aTime
  })

  // ==========================================
  // SEARCH AND FILTER
  // ==========================================

  const visibleRecords = allRecords.filter((record) => {
    const matchesSearch = [
      record.action,
      record.item,
      record.user,
      record.details,
      record.rationale,
    ]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())

    const matchesFilter =
      filter === 'All' || record.category === filter

    return matchesSearch && matchesFilter
  })

  // ==========================================
  // SUMMARY COUNTS
  // ==========================================

  const policyCount = allRecords.filter(
    (record) => record.category === 'Policy Changes'
  ).length

  const guidelineCount = allRecords.filter(
    (record) => record.category === 'Guideline Changes'
  ).length

  const decisionCount = allRecords.filter(
    (record) => record.category === 'Recommendation Decisions'
  ).length

  const reviewCount = allRecords.filter(
    (record) => record.category === 'Review Sessions'
  ).length

  const columnStyle = {
    display: 'grid',
    gridTemplateColumns:
      '1.2fr 0.9fr 1.3fr 1.3fr 2fr',
    gap: '16px',
  }

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <div className="app-page">
      {/* TOP BAR */}

      <header className="top-bar">
        <div className="brand-area">
          <span className="brand-name">
            Policy Review
          </span>

          <span className="brand-divider"></span>

          <span className="workspace-name">
            Policy Review Workspace
          </span>
        </div>

        <div className="top-right">
          <div className="search-box">
            <span>⌕</span>

            <input
              type="text"
              placeholder="Search policies, guidelines..."
            />
          </div>

          <span className="top-icon">?</span>
          <span className="top-icon">⚙</span>

          <div className="user-area">
            <div className="user-avatar">
              SC
            </div>
            <span>Sarah Chen</span>
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* SIDEBAR */}

        <aside className="sidebar">
          <Link to="/dashboard" className="nav-item">
            Dashboard
          </Link>

          <Link to="/reviews" className="nav-item">
            Review Sessions
          </Link>

          <Link to="/policies" className="nav-item">
            Policy Database
          </Link>

          <Link to="/guidelines" className="nav-item">
            Guideline Database
          </Link>

          <Link
            to="/audit-log"
            className="nav-item active"
          >
            Audit Log
          </Link>
        </aside>

        {/* MAIN CONTENT */}

        <main
          className="policy-reviews-content"
          style={{ width: '100%' }}
        >
          <h1>Audit Log</h1>

          <p className="page-subtitle">
            View policy and guideline changes,
            recommendation decisions, reviewer
            rationales, and review sessions.
          </p>

          {/* SUMMARY CARDS */}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '16px',
              marginTop: '26px',
              marginBottom: '28px',
            }}
          >
            {[
              ['TOTAL CHANGES', allRecords.length],
              ['POLICY CHANGES', policyCount],
              ['GUIDELINE CHANGES', guidelineCount],
              ['RECOMMENDATION DECISIONS', decisionCount],
              ['REVIEW SESSIONS', reviewCount],
            ].map(([label, count]) => (
              <div className="stat-card" key={label}>
                <span>{label}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>

          {/* SEARCH AND FILTER */}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '22px',
              flexWrap: 'wrap',
            }}
          >
            <input
              className="review-search"
              type="text"
              placeholder="Search audit history or rationale..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value)
              }
              style={{
                padding: '11px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '7px',
                background: 'white',
              }}
            >
              <option value="All">
                All Actions
              </option>

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
            </select>
          </div>

          {/* AUDIT TABLE */}

          <div
            style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '10px',
              overflowX: 'auto',
            }}
          >
            {/* TABLE HEADER */}

            <div
              style={{
                ...columnStyle,
                minWidth: '780px',
                padding: '18px 22px',
                background: '#f8fafc',
                borderBottom: '1px solid #e5e7eb',
                fontSize: '12px',
                fontWeight: 700,
                color: '#64748b',
              }}
            >
              <span>DATE</span>
              <span>USER</span>
              <span>ACTION</span>
              <span>ITEM</span>
              <span>DETAILS</span>
            </div>

            {/* TABLE ROWS */}

            {visibleRecords.map((record) => (
              <div
                key={record.id}
                style={{
                  ...columnStyle,
                  minWidth: '780px',
                  padding: '18px 22px',
                  borderBottom:
                    '1px solid #edf0f3',
                  alignItems: 'start',
                  fontSize: '13px',
                }}
              >
                <span>
                  {formatDate(record.date)}
                </span>

                <span>{record.user}</span>

                <span
                  style={{ fontWeight: 600 }}
                >
                  {record.action}
                </span>

                <span>{record.item}</span>

                <div
                  style={{
                    color: '#64748b',
                    lineHeight: '1.6',
                    overflowWrap: 'anywhere',
                  }}
                >
                  <div>{record.details}</div>

                  {/* NEW: SHOW REVIEWER RATIONALE */}

                  {record.rationale && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '11px 13px',
                        background: '#f0f7fb',
                        border: '1px solid #c8dce9',
                        borderRadius: '5px',
                        color: '#334155',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#0078bf',
                          marginBottom: '5px',
                        }}
                      >
                        REVIEWER DECISION RATIONALE
                      </div>

                      <div
                        style={{
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {record.rationale}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* EMPTY STATE */}

            {visibleRecords.length === 0 && (
              <div
                style={{
                  padding: '45px 20px',
                  textAlign: 'center',
                  color: '#64748b',
                }}
              >
                {allRecords.length === 0
                  ? 'No recorded changes yet. Add a policy, upload a guideline, or create a review session to see activity here.'
                  : 'No audit records match your search or filter.'}
              </div>
            )}
          </div>

          {/* PROTOTYPE NOTICE */}

          <p
            style={{
              fontSize: '12px',
              color: '#64748b',
              marginTop: '18px',
              lineHeight: '1.6',
            }}
          >
            This prototype displays records saved in
            this browser. Audit history is not yet
            shared across users or devices, and browser
            storage can be changed or cleared. Upload
            records inferred from existing database
            items may not include an exact upload time.
            Deleted items are tracked when their pages
            save deletion events.
          </p>
        </main>
      </div>
    </div>
  )
}

export default AuditLogPage
