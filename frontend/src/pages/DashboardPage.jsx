
import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import './DashboardPage.css'

const originalReviews = [
  {
    id: 'dashboard-1',
    name: 'Medical Necessity - Cardiac MRI',
    status: 'In Review',
    date: 'Oct 22, 2026',
    reviewer: 'Sarah Chen',
    attention: 5,
  },
  {
    id: 'dashboard-2',
    name: 'Prior Auth - Spinal Fusion',
    status: 'Completed',
    date: 'Oct 20, 2026',
    reviewer: 'Sarah Chen',
    attention: 0,
  },
  {
    id: 'dashboard-3',
    name: 'Coverage Criteria - Biologic Therapies',
    status: 'Completed',
    date: 'Oct 19, 2026',
    reviewer: 'Dr. Aris Thorne',
    attention: 0,
  },
  {
    id: 'dashboard-4',
    name: 'Medical Necessity - Proton Beam Therapy',
    status: 'In Review',
    date: 'Oct 18, 2026',
    reviewer: 'Sarah Chen',
    attention: 3,
  },
  {
    id: 'dashboard-5',
    name: 'Prior Auth - Total Joint Arthroplasty',
    status: 'Completed',
    date: 'Oct 15, 2026',
    reviewer: 'Dr. J. Patel',
    attention: 0,
  },
  {
    id: 'dashboard-6',
    name: 'Coverage Criteria - Oncology Genetic Panel',
    status: 'In Review',
    date: 'Oct 14, 2026',
    reviewer: 'Sarah Chen',
    attention: 6,
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

const workflowSteps = [
  {
    title: 'Add a policy',
    description:
      'Open Policy Database to upload a new insurance policy or view an existing one.',
    path: '/policies',
    linkText: 'Open Policy Database',
  },
  {
    title: 'Find and map guidelines',
    description:
      'Use Document Mappings to associate guidelines with a policy. You can use the Dynamic Mapping prototype or create mappings manually.',
    path: '/mappings',
    linkText: 'Open Document Mappings',
  },
  {
    title: 'Manage guideline records',
    description:
      'Use Guideline Database to view or add reference guidelines when needed.',
    path: '/guidelines',
    linkText: 'Open Guideline Database',
  },
  {
    title: 'Create a review session',
    description:
      'Open Review Sessions, create a new review, and select the policy to review.',
    path: '/reviews',
    linkText: 'Open Review Sessions',
  },
  {
    title: 'Review recommendations',
    description:
      'Inspect the available findings and review or accept proposed policy changes.',
    path: '/reviews',
    linkText: 'View Review Sessions',
  },
  {
    title: 'Check the audit log',
    description:
      'Use Audit Log to review recorded decisions and changes throughout the workspace.',
    path: '/audit-log',
    linkText: 'Open Audit Log',
  },
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

function DashboardPage() {
  const navigate = useNavigate()

  const [helpOpen, setHelpOpen] = useState(false)
  const [savedReviews, setSavedReviews] = useState(getSavedReviews)
  const [showNextStep, setShowNextStep] = useState(true)

  useEffect(() => {
    const refreshReviews = () => {
      setSavedReviews(getSavedReviews())
    }

    window.addEventListener('storage', refreshReviews)
    window.addEventListener('focus', refreshReviews)

    return () => {
      window.removeEventListener('storage', refreshReviews)
      window.removeEventListener('focus', refreshReviews)
    }
  }, [])

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

  const createdReviews = savedReviews.map((review) => ({
    id: review.id,
    name: review.name,
    status: review.status || 'In Review',
    date: review.date || 'Recently',
    reviewer: review.reviewer || 'Sarah Chen',
    attention: Number(review.attention) || 0,
  }))

  const allReviews = [...createdReviews, ...originalReviews]

  const activeReviewCount = allReviews.filter(
    (review) => review.status === 'In Review'
  ).length

  const completedReviewCount = allReviews.filter(
    (review) => review.status === 'Completed'
  ).length

  const itemsRequiringAttention = allReviews.reduce(
    (total, review) => total + review.attention,
    0
  )

  const recentReviews = allReviews.slice(0, 5)

  const attentionReviews = allReviews
    .filter((review) => review.attention > 0)
    .sort((a, b) => b.attention - a.attention)
    .slice(0, 4)

  return (
    <div className="app-page ccf-dashboard">
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
            aria-label="How to use this workspace"
            title="How to use this workspace"
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

        {/* HOME CONTENT */}
        <main className="dashboard-content">
          <div className="ccf-dashboard-intro">
            <div>
              <h1>Home</h1>
              <p>
                Monitor review sessions, policy recommendations,
                and items that require your attention.
              </p>
            </div>

            <Link
              to="/reviews"
              className="ccf-dashboard-primary-button"
            >
              View Review Sessions
            </Link>
          </div>

          {/* OVERVIEW CARDS */}
          <div className="ccf-dashboard-stats">
            <div className="ccf-dashboard-stat-card">
              <span className="ccf-dashboard-stat-label">
                Active Review Sessions
              </span>
              <strong>{activeReviewCount}</strong>
              <small>Currently in progress</small>
            </div>

            <div className="ccf-dashboard-stat-card">
              <span className="ccf-dashboard-stat-label">
                Items Requiring Attention
              </span>
              <strong>{itemsRequiringAttention}</strong>
              <small>Suggested changes to review</small>
            </div>

            <div className="ccf-dashboard-stat-card">
              <span className="ccf-dashboard-stat-label">
                Completed Sessions
              </span>
              <strong>{completedReviewCount}</strong>
              <small>Review sessions completed</small>
            </div>
          </div>

          {/* MAIN DASHBOARD GRID */}
          <div className="ccf-dashboard-grid">
            {/* RECENT REVIEWS */}
            <section className="ccf-dashboard-panel">
              <div className="ccf-dashboard-panel-header">
                <div>
                  <h2>Recent Review Sessions</h2>
                  <p>
                    Continue an existing review or view recent activity.
                  </p>
                </div>

                <Link to="/reviews">
                  View all sessions
                </Link>
              </div>

              <div className="ccf-dashboard-table-scroll">
                <table className="ccf-dashboard-table">
                  <thead>
                    <tr>
                      <th>Review Session</th>
                      <th>Status</th>
                      <th>Last Updated</th>
                      <th>Reviewer</th>
                    </tr>
                  </thead>

                  <tbody>
                    {recentReviews.length === 0 ? (
                      <tr>
                        <td colSpan={4}>
                          No review sessions available.
                        </td>
                      </tr>
                    ) : (
                      recentReviews.map((review) => (
                        <tr key={review.id}>
                          <td>
                            <span className="ccf-dashboard-review-name">
                              {review.name}
                            </span>
                          </td>

                          <td>
                            <span
                              className={
                                review.status === 'Completed'
                                  ? 'ccf-dashboard-status completed'
                                  : 'ccf-dashboard-status in-review'
                              }
                            >
                              {review.status}
                            </span>
                          </td>

                          <td>{review.date}</td>
                          <td>{review.reviewer}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ITEMS REQUIRING ATTENTION */}
            <section className="ccf-dashboard-panel">
              <div className="ccf-dashboard-panel-header">
                <div>
                  <h2>Items Requiring Attention</h2>
                  <p>
                    Review sessions with outstanding suggested changes.
                  </p>
                </div>
              </div>

              <div className="ccf-dashboard-attention-list">
                {attentionReviews.length === 0 ? (
                  <p className="ccf-dashboard-empty">
                    No items currently require attention.
                  </p>
                ) : (
                  attentionReviews.map((review) => (
                    <div
                      className="ccf-dashboard-attention-item"
                      key={review.id}
                    >
                      <div>
                        <strong>{review.name}</strong>
                        <small>
                          {review.attention} suggested{' '}
                          {review.attention === 1
                            ? 'change'
                            : 'changes'}
                        </small>
                      </div>

                      <span className="ccf-dashboard-attention-count">
                        {review.attention}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="ccf-dashboard-panel-footer">
                <Link to="/reviews">
                  Go to Review Sessions
                </Link>
              </div>
            </section>
          </div>

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
                  Would you like to go to the Policy Database
                  to upload or review an insurance policy?
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                }}
              >
                <button
                  type="button"
                  className="ccf-dashboard-primary-button"
                  onClick={() => navigate('/policies')}
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

      {/* WORKFLOW HELP MODAL */}
      {helpOpen && (
        <div
          className="ccf-help-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setHelpOpen(false)
            }
          }}
        >
          <div
            className="ccf-help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ccf-help-title"
          >
            <div className="ccf-help-modal-header">
              <div>
                <h2 id="ccf-help-title">
                  How to Use This Workspace
                </h2>
                <p>
                  Follow these steps to manage policies,
                  guidelines, and review decisions.
                </p>
              </div>

              <button
                type="button"
                className="ccf-help-close"
                aria-label="Close help"
                onClick={() => setHelpOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="ccf-help-modal-body">
              {workflowSteps.map((step, index) => (
                <div
                  className="ccf-help-step"
                  key={step.title}
                >
                  <span className="ccf-help-step-number">
                    {index + 1}
                  </span>

                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>

                    <Link
                      to={step.path}
                      onClick={() => setHelpOpen(false)}
                    >
                      {step.linkText}
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            <div className="ccf-help-modal-footer">
              <button
                type="button"
                className="ccf-dashboard-primary-button"
                onClick={() => setHelpOpen(false)}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardPage
