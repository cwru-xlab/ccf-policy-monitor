
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
      {/* ======================================
          TOP BAR
      ====================================== */}

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

          <span className="top-icon">
            ?
          </span>

          <span className="top-icon">
            ⚙
          </span>

          <div className="user-area">
            <div className="user-avatar">
              SC
            </div>

            <span>
              Sarah Chen
            </span>
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* ======================================
            LEFT SIDEBAR
        ====================================== */}

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
            to="/audit-log"
            className="nav-item"
          >
            Audit Log
          </Link>
        </aside>

        {/* ======================================
            DASHBOARD CONTENT
        ====================================== */}

        <main className="dashboard-content">
          {/* ==================================
              PAGE INTRODUCTION
          ================================== */}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '24px',
              marginBottom: '28px',
            }}
          >
            <div>
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

            <Link
              to="/reviews/new"
              className="primary-button"
              style={{
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              + Start a Review Session
            </Link>
          </div>

          {/* ==================================
              OVERVIEW CARDS
          ================================== */}

          <div
            className="stat-cards"
            style={{
              gridTemplateColumns:
                'repeat(3, minmax(0, 1fr))',
            }}
          >
            <div className="stat-card">
              <span>
                ACTIVE REVIEW SESSIONS
              </span>

              <strong>
                {activeReviewCount}
              </strong>

              <small
                style={{
                  color: '#777',
                  marginTop: '6px',
                }}
              >
                Currently in progress
              </small>
            </div>

            <div className="stat-card">
              <span>
                ITEMS REQUIRING ATTENTION
              </span>

              <strong>
                {itemsRequiringAttention}
              </strong>

              <small
                style={{
                  color: '#777',
                  marginTop: '6px',
                }}
              >
                Suggested changes to review
              </small>
            </div>

            <div className="stat-card">
              <span>
                COMPLETED SESSIONS
              </span>

              <strong>
                {completedReviewCount}
              </strong>

              <small
                style={{
                  color: '#777',
                  marginTop: '6px',
                }}
              >
                Review sessions completed
              </small>
            </div>
          </div>

          {/* ==================================
              DASHBOARD GRID
          ================================== */}

          <div className="dashboard-grid">
            {/* ==================================
                RECENT REVIEW SESSIONS
            ================================== */}

            <section className="reviews-card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '18px',
                }}
              >
                <div>
                  <h2
                    style={{
                      marginBottom: '5px',
                    }}
                  >
                    Recent Review Sessions
                  </h2>

                  <p
                    style={{
                      margin: 0,
                      color: '#777',
                      fontSize: '13px',
                    }}
                  >
                    Continue an existing review or view recent activity.
                  </p>
                </div>

                <Link
                  to="/reviews"
                  style={{
                    fontSize: '13px',
                    fontWeight: '600',
                  }}
                >
                  View all sessions
                </Link>
              </div>

              <div className="review-table-header">
                <span>
                  REVIEW SESSION
                </span>

                <span>
                  STATUS
                </span>

                <span>
                  LAST UPDATED
                </span>

                <span>
                  REVIEWER
                </span>
              </div>

              {recentReviews.map((review) => (
                <div
                  className="review-row"
                  key={review.id}
                >
                  <strong>
                    {review.name}
                  </strong>

                  <span
                    className={
                      review.status === 'Completed'
                        ? 'status completed'
                        : 'status in-review'
                    }
                  >
                    {review.status}
                  </span>

                  <span>
                    {review.date}
                  </span>

                  <span>
                    {review.reviewer}
                  </span>
                </div>
              ))}
            </section>

            {/* ==================================
                ATTENTION SUMMARY
            ================================== */}

            <section className="recommendation-card">
              <h2>
                Items Requiring Attention
              </h2>

              <p>
                Recommendations identified during policy review.
              </p>

              <div className="recommendation-item">
                <div className="recommendation-label">
                  <strong>
                    High Priority Changes
                  </strong>

                  <span>
                    5
                  </span>
                </div>

                <div className="progress-background">
                  <div
                    className="progress criteria"
                    style={{
                      width: '75%',
                    }}
                  ></div>
                </div>
              </div>

              <div className="recommendation-item">
                <div className="recommendation-label">
                  <strong>
                    Low Priority Changes
                  </strong>

                  <span>
                    6
                  </span>
                </div>

                <div className="progress-background">
                  <div
                    className="progress mismatch"
                    style={{
                      width: '55%',
                    }}
                  ></div>
                </div>
              </div>

              <div className="recommendation-item">
                <div className="recommendation-label">
                  <strong>
                    New Evidence Available
                  </strong>

                  <span>
                    3
                  </span>
                </div>

                <div className="progress-background">
                  <div
                    className="progress evidence"
                    style={{
                      width: '35%',
                    }}
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
