
import { Link } from 'react-router-dom'

function DashboardPage() {
  // ==========================================
  // ORIGINAL / DEMO REVIEW SESSIONS
  // ==========================================

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

  // ==========================================
  // GET REVIEW SESSIONS CREATED BY USER
  // ==========================================

  const savedReviews =
    JSON.parse(localStorage.getItem('createdReviews')) || []

  const createdReviews = savedReviews.map((review) => ({
    id: review.id,
    name: review.name,
    status: review.status || 'In Review',
    date: review.date || 'Recently',
    reviewer: review.reviewer || 'Sarah Chen',
    attention: review.attention || 0,
  }))

  // ==========================================
  // COMBINE REVIEW SESSIONS
  // ==========================================

  const allReviews = [
    ...createdReviews,
    ...originalReviews,
  ]

  // ==========================================
  // DASHBOARD COUNTS
  // ==========================================

  const activeReviewCount = allReviews.filter(
    (review) => review.status === 'In Review'
  ).length

  const completedReviewCount = allReviews.filter(
    (review) => review.status === 'Completed'
  ).length

  const itemsRequiringAttention = allReviews.reduce(
    (total, review) => total + (review.attention || 0),
    0
  )

  // ==========================================
  // RECENT REVIEW SESSIONS
  // ==========================================

  const recentReviews = allReviews.slice(0, 5)

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
        {/* LEFT SIDEBAR */}

        <aside className="sidebar">
          <Link
            to="/dashboard"
            className="nav-item active"
          >
            Dashboard
          </Link>

          <Link
            to="/reviews"
            className="nav-item"
          >
            Review Sessions
          </Link>

          <Link
            to="/policies"
            className="nav-item"
          >
            Policy Database
          </Link>

          <Link
            to="/guidelines"
            className="nav-item"
          >
            Guideline Database
          </Link>

          <Link
            to="/mappings"
            className="nav-item"
          >
            Document Mappings
          </Link>

          <Link
            to="/audit-log"
            className="nav-item"
          >
            Audit Log
          </Link>
        </aside>

        {/* DASHBOARD CONTENT */}

        <main className="dashboard-content">
          {/* PAGE INTRODUCTION */}

          <div
            style={{
              marginBottom: '28px',
            }}
          >
            <h1
              style={{
                marginBottom: '8px',
              }}
            >
              Dashboard
            </h1>

            <p
              style={{
                margin: 0,
                color: '#666',
                maxWidth: '650px',
                lineHeight: '1.5',
              }}
            >
              Monitor review sessions, policy recommendations,
              and items that require your attention.
            </p>
          </div>

          {/* OVERVIEW CARDS */}

          <div
            className="stat-cards"
            style={{
              gridTemplateColumns:
                'repeat(3, minmax(0, 1fr))',
            }}
          >
            {/* ACTIVE REVIEW SESSIONS */}

            <div
              className="stat-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '10px',
                boxSizing: 'border-box',
                minWidth: 0,
                height: 'auto',
                minHeight: '105px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  gap: '5px',
                }}
              >
                <span>ACTIVE REVIEW SESSIONS</span>

                <small style={{ color: '#777' }}>
                  – Currently in progress
                </small>
              </div>

              <strong>{activeReviewCount}</strong>
            </div>

            {/* ITEMS REQUIRING ATTENTION */}

            <div
              className="stat-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '10px',
                boxSizing: 'border-box',
                minWidth: 0,
                height: 'auto',
                minHeight: '105px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  gap: '5px',
                }}
              >
                <span>ITEMS REQUIRING ATTENTION</span>

                <small style={{ color: '#777' }}>
                  – Suggested changes to review
                </small>
              </div>

              <strong>{itemsRequiringAttention}</strong>
            </div>

            {/* COMPLETED SESSIONS */}

            <div
              className="stat-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '10px',
                boxSizing: 'border-box',
                minWidth: 0,
                height: 'auto',
                minHeight: '105px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  gap: '5px',
                }}
              >
                <span>COMPLETED SESSIONS</span>

                <small style={{ color: '#777' }}>
                  – Review sessions completed
                </small>
              </div>

              <strong>{completedReviewCount}</strong>
            </div>
          </div>

          {/* DASHBOARD GRID */}

          <div className="dashboard-grid">
            {/* RECENT REVIEW SESSIONS */}

            <section
              className="reviews-card"
              style={{
                padding: 0,
                overflow: 'hidden',
                minWidth: 0,
                boxSizing: 'border-box',
              }}
            >
              {/* HEADER */}

              <div
                style={{
                  padding: '18px 20px 14px',
                  boxSizing: 'border-box',
                  width: '100%',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    width: '100%',
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      textAlign: 'left',
                      fontSize: '18px',
                    }}
                  >
                    Recent Review Sessions
                  </h2>

                  <Link
                    to="/reviews"
                    style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      textDecoration: 'underline',
                      whiteSpace: 'nowrap',
                      marginLeft: 'auto',
                    }}
                  >
                    View all sessions
                  </Link>
                </div>

                {/* CENTERED DESCRIPTION */}

                <p
                  style={{
                    margin: '12px 0 0',
                    color: '#777',
                    fontSize: '13px',
                    textAlign: 'center',
                    width: '100%',
                  }}
                >
                  Continue an existing review or view recent activity.
                </p>
              </div>

              {/* REVIEW TABLE HEADINGS */}

              <div className="review-table-header">
                <span>REVIEW SESSION</span>
                <span>STATUS</span>
                <span>LAST UPDATED</span>
                <span>REVIEWER</span>
              </div>

              {/* REVIEW SESSION ROWS */}

              {recentReviews.map((review) => (
                <div
                  className="review-row"
                  key={review.id}
                >
                  <strong>{review.name}</strong>

                  <span
                    className={
                      review.status === 'Completed'
                        ? 'status completed'
                        : 'status in-review'
                    }
                  >
                    {review.status}
                  </span>

                  <span>{review.date}</span>
                  <span>{review.reviewer}</span>
                </div>
              ))}
            </section>

            {/* ITEMS REQUIRING ATTENTION */}

            <section className="recommendation-card">
              <h2>Items Requiring Attention</h2>

              <p>
                Recommendations identified during policy review.
              </p>

              {/* HIGH PRIORITY */}

              <div className="recommendation-item">
                <div className="recommendation-label">
                  <strong>High Priority Changes</strong>
                  <span>5</span>
                </div>

                <div className="progress-background">
                  <div
                    className="progress criteria"
                    style={{ width: '75%' }}
                  ></div>
                </div>
              </div>

              {/* LOW PRIORITY */}

              <div className="recommendation-item">
                <div className="recommendation-label">
                  <strong>Low Priority Changes</strong>
                  <span>6</span>
                </div>

                <div className="progress-background">
                  <div
                    className="progress mismatch"
                    style={{ width: '55%' }}
                  ></div>
                </div>
              </div>

              {/* NEW EVIDENCE */}

              <div className="recommendation-item">
                <div className="recommendation-label">
                  <strong>New Evidence Available</strong>
                  <span>3</span>
                </div>

                <div className="progress-background">
                  <div
                    className="progress evidence"
                    style={{ width: '35%' }}
                  ></div>
                </div>
              </div>

              <Link
                to="/reviews"
                style={{
                  display: 'inline-block',
                  marginTop: '18px',
                  fontSize: '13px',
                  fontWeight: '600',
                }}
              >
                Go to Review Sessions →
              </Link>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

export default DashboardPage
