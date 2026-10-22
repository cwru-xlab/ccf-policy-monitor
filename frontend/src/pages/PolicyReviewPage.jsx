
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function PolicyReviewPage() {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('Most recent')

  // ORIGINAL / DEMO REVIEW SESSIONS

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

  // GET REVIEW SESSIONS CREATED BY USER

  const savedReviews =
    JSON.parse(localStorage.getItem('createdReviews')) || []

  const createdReviews = savedReviews.map((review) => ({
    ...review,
    policies:
      typeof review.policies === 'number'
        ? review.policies
        : review.selectedPolicies?.length || 1,
    guideline:
      review.guideline ||
      review.selectedGuidelines?.[0]?.name ||
      'Reference guidelines selected',
    status: review.status || 'In Review',
    findings: review.findings ?? 0,
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

  // SEARCH / FILTER / SORT

  const visibleReviews = [...allReviews]
    .filter((review) => {
      const reviewName = review.name || 'Untitled Review Session'

      const matchesSearch = reviewName
        .toLowerCase()
        .includes(search.toLowerCase())

      const matchesFilter =
        filter === 'All' || review.status === filter

      return matchesSearch && matchesFilter
    })
    .sort((a, b) => {
      const aDate = new Date(a.date)
      const bDate = new Date(b.date)

      const aTime = Number.isNaN(aDate.getTime())
        ? 0
        : aDate.getTime()

      const bTime = Number.isNaN(bDate.getTime())
        ? 0
        : bDate.getTime()

      return sort === 'Oldest'
        ? aTime - bTime
        : bTime - aTime
    })

  // OPEN EXISTING REVIEW SESSION

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

  return (
    <div className="app-page">
      <header className="top-bar">
        <div className="brand-area">
          <span className="brand-name">Policy Review</span>
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
            <div className="user-avatar">SC</div>
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

          <Link to="/reviews" className="nav-item active">
            Review Sessions
          </Link>

          <Link to="/policies" className="nav-item">
            Policy Database
          </Link>

          <Link to="/guidelines" className="nav-item">
            Guideline Database
          </Link>

          <Link to="/audit-log" className="nav-item">
            Audit Log
          </Link>
        </aside>

        {/* MAIN PAGE */}

        <main className="policy-reviews-content">
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
              <h1 style={{ marginBottom: '8px' }}>
                Review Sessions
              </h1>

              <p
                className="page-subtitle"
                style={{ marginBottom: 0 }}
              >
                Create, continue, and monitor policy review
                sessions.
              </p>
            </div>

            <Link
              to="/reviews/new"
              className="new-review-button"
              style={{
                position: 'static',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Start a Review Session
              <span>+</span>
            </Link>
          </div>

          {/* SESSION SUMMARY */}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(3, minmax(0, 1fr))',
              gap: '16px',
              marginBottom: '28px',
            }}
          >
            <div className="stat-card">
              <span>ACTIVE SESSIONS</span>
              <strong>{activeCount}</strong>
            </div>

            <div className="stat-card">
              <span>COMPLETED SESSIONS</span>
              <strong>{completedCount}</strong>
            </div>

            <div className="stat-card">
              <span>TOTAL FINDINGS</span>
              <strong>{totalFindings}</strong>
            </div>
          </div>

          {/* CONTROLS */}

          <div className="review-controls">
            <input
              className="review-search"
              type="text"
              placeholder="⌕   Search review sessions..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

            <div className="filter-buttons">
              <button
                type="button"
                className={filter === 'All' ? 'selected' : ''}
                onClick={() => setFilter('All')}
              >
                All
              </button>

              <button
                type="button"
                className={
                  filter === 'In Review' ? 'selected' : ''
                }
                onClick={() => setFilter('In Review')}
              >
                In Review
              </button>

              <button
                type="button"
                className={
                  filter === 'Completed' ? 'selected' : ''
                }
                onClick={() => setFilter('Completed')}
              >
                Completed
              </button>
            </div>

            <div className="sort-area">
              <span>Sort by</span>

              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option>Most recent</option>
                <option>Oldest</option>
              </select>
            </div>
          </div>

          {/* REVIEW SESSION TABLE */}

          <div className="policy-review-table">
            <div className="policy-review-header">
              <span>REVIEW SESSION</span>
              <span>POLICIES</span>
              <span>REFERENCE GUIDELINES</span>
              <span>DATE CREATED</span>
              <span>STATUS</span>
              <span>FINDINGS</span>
            </div>

            {visibleReviews.map((review) => (
              <div
                className="policy-review-row"
                key={review.id}
                onClick={() => openReviewSession(review)}
                style={{ cursor: 'pointer' }}
                title="Open review session"
              >
                <div>
                  <strong
                    className="review-name"
                    style={{
                      textDecoration: 'underline',
                      textUnderlineOffset: '2px',
                    }}
                  >
                    {review.name || 'Untitled Review Session'}
                  </strong>

                  <p>
                    {review.description || 'Policy review session.'}
                  </p>
                </div>

                <div className="document-cell">
                  <span className="pdf-icon">
                    {review.policies || 1}
                  </span>

                  <div>
                    <strong>
                      {review.policies || 1}{' '}
                      {(review.policies || 1) === 1
                        ? 'Policy'
                        : 'Policies'}
                    </strong>
                    <small>included in session</small>
                  </div>
                </div>

                <div className="guideline-cell">
                  <span className="guideline-icon">⌜</span>

                  <div>
                    <strong>
                      {review.guideline || 'Not selected'}
                    </strong>
                    <small>Reference guideline</small>
                  </div>
                </div>

                <div className="date-cell">
                  <span>{review.date || 'Recently'}</span>
                  <small>{review.age || 'Recently'}</small>
                </div>

                <div>
                  <span
                    className={
                      review.status === 'Completed'
                        ? 'status completed'
                        : 'status in-review'
                    }
                  >
                    {review.status || 'In Review'}
                  </span>
                </div>

                <div className="findings-cell">
                  <strong>{review.findings || 0}</strong>
                  <small>identified</small>
                </div>
              </div>
            ))}

            {visibleReviews.length === 0 && (
              <div
                style={{
                  padding: '35px',
                  textAlign: 'center',
                  color: '#777',
                }}
              >
                No review sessions match your search.
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default PolicyReviewPage
