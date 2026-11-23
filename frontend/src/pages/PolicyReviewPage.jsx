
import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import './DashboardPage.css'
import './PolicyReviewPage.css'

const originalReviews = [
  {
    id: 1,
    name: 'Cardiac Coverage Review',
    description:
      'Review of cardiac coverage policies against current clinical guidelines.',
    policies: 3,
    guideline: '2026 Cardiac Coverage Guidelines',
    date: 'Sep 23, 2026',
    age: '2 days ago',
    status: 'In Review',
    findings: 14,
    selectedPolicies: [
      { id: 'demo-cardiac-1', name: 'Cardiac Coverage Policy' },
      { id: 'demo-cardiac-2', name: 'Coronary Intervention Policy' },
      { id: 'demo-cardiac-3', name: 'Cardiac Imaging Policy' },
    ],
    selectedGuidelines: [
      {
        id: 'demo-cardiac-guideline',
        name: '2026 Cardiac Coverage Guidelines',
      },
    ],
  },
  {
    id: 2,
    name: 'Diabetes Treatment Review',
    description:
      'Review of diabetes management and treatment policies.',
    policies: 2,
    guideline: '2026 Diabetes Treatment Guidelines',
    date: 'Sep 18, 2026',
    age: '6 days ago',
    status: 'Completed',
    findings: 8,
    selectedPolicies: [
      { id: 'demo-diabetes-1', name: 'Diabetes Treatment Policy' },
      {
        id: 'demo-diabetes-2',
        name: 'Diabetes Medication Coverage Policy',
      },
    ],
    selectedGuidelines: [
      {
        id: 'demo-diabetes-guideline',
        name: '2026 Diabetes Treatment Guidelines',
      },
    ],
  },
  {
    id: 3,
    name: 'Oncology Coverage Review',
    description:
      'Review of oncology coverage policies and treatment criteria.',
    policies: 4,
    guideline: 'Oncology Coverage Guidelines',
    date: 'Sep 10, 2026',
    age: '14 days ago',
    status: 'Completed',
    findings: 21,
    selectedPolicies: [
      { id: 'demo-oncology-1', name: 'Oncology Coverage Policy' },
      { id: 'demo-oncology-2', name: 'Targeted Therapy Policy' },
      { id: 'demo-oncology-3', name: 'Cancer Treatment Policy' },
      { id: 'demo-oncology-4', name: 'Oncology Medication Policy' },
    ],
    selectedGuidelines: [
      {
        id: 'demo-oncology-guideline',
        name: 'Oncology Coverage Guidelines',
      },
    ],
  },
  {
    id: 4,
    name: 'Orthopedic Surgery Review',
    description:
      'Review of orthopedic procedure and rehabilitation policies.',
    policies: 3,
    guideline: '2026 Orthopedic Guidelines',
    date: 'Sep 5, 2026',
    age: '19 days ago',
    status: 'In Review',
    findings: 0,
    selectedPolicies: [
      { id: 'demo-orthopedic-1', name: 'Orthopedic Surgery Policy' },
      { id: 'demo-orthopedic-2', name: 'Joint Replacement Policy' },
      {
        id: 'demo-orthopedic-3',
        name: 'Rehabilitation Coverage Policy',
      },
    ],
    selectedGuidelines: [
      {
        id: 'demo-orthopedic-guideline',
        name: '2026 Orthopedic Guidelines',
      },
    ],
  },
  {
    id: 5,
    name: 'Mental Health Coverage Review',
    description:
      'Review of mental health coverage and treatment policies.',
    policies: 2,
    guideline: '2026 Mental Health Guidelines',
    date: 'Aug 28, 2026',
    age: '27 days ago',
    status: 'Completed',
    findings: 12,
    selectedPolicies: [
      {
        id: 'demo-mental-health-1',
        name: 'Mental Health Coverage Policy',
      },
      {
        id: 'demo-mental-health-2',
        name: 'Behavioral Health Treatment Policy',
      },
    ],
    selectedGuidelines: [
      {
        id: 'demo-mental-health-guideline',
        name: '2026 Mental Health Guidelines',
      },
    ],
  },
]

const navigation = [
  { label: 'Home', path: '/dashboard' },
  { label: 'Policy Database', path: '/policies' },
  { label: 'Document Mappings', path: '/mappings' },
  { label: 'Guideline Database', path: '/guidelines' },
  { label: 'Review Sessions', path: '/reviews' },
  { label: 'Audit Log', path: '/audit-log' },
]

function getSavedReviews() {
  try {
    const saved = JSON.parse(
      localStorage.getItem('createdReviews') || '[]'
    )
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

function PolicyReviewPage() {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('Most recent')
  const [helpOpen, setHelpOpen] = useState(false)
  const [showNextStep, setShowNextStep] = useState(true)

  useEffect(() => {
    if (!helpOpen) return

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setHelpOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [helpOpen])

  const savedReviews = getSavedReviews()

  const createdReviews = savedReviews.map((review) => ({
    ...review,
    policies:
      typeof review.policies === 'number'
        ? review.policies
        : review.selectedPolicies?.length || 1,
    guideline:
      review.guideline ||
      review.selectedGuidelines?.[0]?.name ||
      'No mapped guidelines',
    status: review.status || 'In Review',
    findings: Number(review.findings) || 0,
    age: review.age || 'Recently',
  }))

  const allReviews = [...createdReviews, ...originalReviews]

  const activeCount = allReviews.filter(
    (review) => review.status === 'In Review'
  ).length

  const completedCount = allReviews.filter(
    (review) => review.status === 'Completed'
  ).length

  const totalFindings = allReviews.reduce(
    (total, review) => total + Number(review.findings || 0),
    0
  )

  const visibleReviews = allReviews
    .filter((review) => {
      const query = search.toLowerCase().trim()

      const matchesSearch =
        (review.name || '').toLowerCase().includes(query) ||
        (review.description || '').toLowerCase().includes(query)

      const matchesFilter =
        filter === 'All' || review.status === filter

      return matchesSearch && matchesFilter
    })
    .sort((a, b) => {
      const aTime = new Date(a.date).getTime() || 0
      const bTime = new Date(b.date).getTime() || 0

      return sort === 'Oldest'
        ? aTime - bTime
        : bTime - aTime
    })

  function openReviewSession(review) {
    const sessionToOpen = {
      ...review,
      selectedPolicies: review.selectedPolicies || [],
      selectedGuidelines: review.selectedGuidelines || [],
    }

    localStorage.setItem(
      'currentReview',
      JSON.stringify(sessionToOpen)
    )

    localStorage.setItem(
      'selectedPolicies',
      JSON.stringify(sessionToOpen.selectedPolicies)
    )

    localStorage.setItem(
      'selectedGuidelines',
      JSON.stringify(sessionToOpen.selectedGuidelines)
    )

    localStorage.setItem(
      'newReviewName',
      sessionToOpen.name || ''
    )

    localStorage.setItem(
      'newReviewDescription',
      sessionToOpen.description || ''
    )

    navigate('/reviews/findings')
  }

  function startNewReview() {
    localStorage.removeItem('currentReview')
    localStorage.removeItem('selectedPolicies')
    localStorage.removeItem('selectedGuidelines')
    localStorage.removeItem('newReviewName')
    localStorage.removeItem('newReviewDescription')

    navigate('/reviews/new')
  }

  return (
    <div className="app-page ccf-dashboard ccf-review-page">
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
            aria-label="Help with Review Sessions"
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
        <main className="ccf-review-content">
          <div className="ccf-review-heading">
            <h1>Review Sessions</h1>
            <p>
              Create, continue, and monitor insurance policy
              review sessions.
            </p>
          </div>

          {/* STATISTICS */}
          <div className="ccf-review-stats">
            <div className="ccf-review-stat">
              <span>ACTIVE SESSIONS</span>
              <strong>{activeCount}</strong>
              <small>Currently in progress</small>
            </div>

            <div className="ccf-review-stat">
              <span>COMPLETED SESSIONS</span>
              <strong>{completedCount}</strong>
              <small>Finished reviews</small>
            </div>

            <div className="ccf-review-stat">
              <span>TOTAL FINDINGS</span>
              <strong>{totalFindings}</strong>
              <small>Findings identified</small>
            </div>
          </div>

          {/* REVIEW SESSIONS TABLE */}
          <section className="ccf-review-panel">
            <div className="ccf-review-panel-heading">
              <div>
                <h2>All Review Sessions</h2>
                <p>
                  Select a review session to view its findings.
                </p>
              </div>

              <span className="ccf-review-total">
                {visibleReviews.length} sessions
              </span>
            </div>

            {/* SEARCH, FILTER, SORT */}
            <div className="ccf-review-controls">
              <input
                type="search"
                aria-label="Search review sessions"
                placeholder="Search review sessions..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />

              <div className="ccf-review-filters">
                {['All', 'In Review', 'Completed'].map(
                  (option) => (
                    <button
                      key={option}
                      type="button"
                      className={
                        filter === option ? 'selected' : ''
                      }
                      onClick={() => setFilter(option)}
                    >
                      {option}
                    </button>
                  )
                )}
              </div>

              <label className="ccf-review-sort">
                <span>Sort by</span>
                <select
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value)
                  }
                >
                  <option value="Most recent">
                    Most recent
                  </option>
                  <option value="Oldest">
                    Oldest
                  </option>
                </select>
              </label>
            </div>

            <div className="ccf-review-table-scroll">
              <table className="ccf-review-table">
                <thead>
                  <tr>
                    <th>Review Session</th>
                    <th>Policies</th>
                    <th>Reference Guidelines</th>
                    <th>Date Created</th>
                    <th>Status</th>
                    <th>Findings</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleReviews.map((review) => (
                    <tr key={review.id}>
                      <td>
                        <button
                          type="button"
                          className="ccf-review-name-link"
                          onClick={() =>
                            openReviewSession(review)
                          }
                        >
                          {review.name ||
                            'Untitled Review Session'}
                        </button>

                        <p className="ccf-review-description">
                          {review.description ||
                            'Policy review session.'}
                        </p>
                      </td>

                      <td>
                        <strong>
                          {review.policies || 1}
                        </strong>
                        <small>
                          {(review.policies || 1) === 1
                            ? 'Policy'
                            : 'Policies'}
                        </small>
                      </td>

                      <td>
                        <span className="ccf-review-guideline">
                          {review.guideline ||
                            'No mapped guidelines'}
                        </span>
                      </td>

                      <td>
                        <span>
                          {review.date || 'Recently'}
                        </span>
                        <small>
                          {review.age || ''}
                        </small>
                      </td>

                      <td>
                        <span
                          className={`ccf-review-status ${
                            review.status === 'Completed'
                              ? 'completed'
                              : 'in-review'
                          }`}
                        >
                          {review.status}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {review.findings || 0}
                        </strong>
                        <small>identified</small>
                      </td>
                    </tr>
                  ))}

                  {visibleReviews.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="ccf-review-empty"
                      >
                        No review sessions match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* NEW REVIEW BUTTON */}
            <div className="ccf-review-bottom">
              <span>
                Showing {visibleReviews.length} of{' '}
                {allReviews.length} review sessions
              </span>

              <button
                type="button"
                className="ccf-review-new-button"
                onClick={startNewReview}
              >
                <span aria-hidden="true">+</span>
                New Review
              </button>
            </div>
          </section>

          {/* NEXT WORKFLOW STEP */}
          {showNextStep && (
            <section
              style={{
                marginTop: '26px',
                padding: '22px',
                background: '#ffffff',
                border: '1px solid #dfe5eb',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '18px',
              }}
            >
              <div>
                <h2
                  style={{
                    margin: '0 0 8px',
                    fontSize: '16px',
                    color: '#172033',
                  }}
                >
                  Continue to the Next Step?
                </h2>

                <p
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    color: '#667085',
                    lineHeight: '1.5',
                  }}
                >
                  Would you like to go to Audit Log
                  to review recorded policy changes
                  and review decisions?
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="ccf-review-new-button"
                  onClick={() => navigate('/audit-log')}
                >
                  Yes
                </button>

                <button
                  type="button"
                  onClick={() => setShowNextStep(false)}
                  style={{
                    minHeight: '40px',
                    padding: '10px 18px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#344054',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  No
                </button>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* HELP WINDOW */}
      {helpOpen && (
        <div
          className="ccf-review-help-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setHelpOpen(false)
            }
          }}
        >
          <div
            className="ccf-review-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-help-title"
          >
            <div className="ccf-review-help-heading">
              <h2 id="review-help-title">
                How Review Sessions Work
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
              Review Sessions helps you organize policy
              evaluations and inspect findings.
            </p>

            <ol>
              <li>
                Click <strong>New Review</strong> to
                create a session.
              </li>
              <li>
                Enter a name and description for the review.
              </li>
              <li>
                Choose a policy from the Policy Database.
              </li>
              <li>
                Review the guidelines already mapped to
                that policy.
              </li>
              <li>
                Open the review session to inspect its findings.
              </li>
            </ol>

            <p>
              To manage policy-to-guideline relationships,
              visit{' '}
              <Link
                to="/mappings"
                onClick={() => setHelpOpen(false)}
              >
                Document Mappings
              </Link>.
            </p>

            <button
              type="button"
              className="ccf-review-new-button"
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

export default PolicyReviewPage
