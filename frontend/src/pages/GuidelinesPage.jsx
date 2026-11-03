
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { originalGuidelines, deleteGuideline } from '../data/guidelines'
import { getPoliciesForGuideline } from '../data/guidelineMappings'

function GuidelinesPage() {
  const [search, setSearch] = useState('')
  const [deletedGuidelineIds, setDeletedGuidelineIds] = useState(() => getSavedArray('deletedGuidelineIds'))
  const [deleteError, setDeleteError] = useState('')

  function handleDelete(guideline) {
    if (!window.confirm('Are you sure you want to delete "' + guideline.name + '"?')) return
    try {
      deleteGuideline(guideline)
      setDeleteError('')
    } catch {
      setDeleteError('Could not finish deleting the guideline. Please try again.')
    } finally {
      setDeletedGuidelineIds(getSavedArray('deletedGuidelineIds'))
    }
  }
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('Most recent')

  // ==========================================
  // READ SAVED DATABASE DATA SAFELY
  // ==========================================

  function getSavedArray(key) {
    try {
      const data = JSON.parse(localStorage.getItem(key))
      return Array.isArray(data) ? data : []
    } catch {
      return []
    }
  }

  // ==========================================
  // ORIGINAL POLICIES
  // ==========================================

  const originalPolicies = [
    { id: 1, name: 'Cardiac Coverage Policy' },
    { id: 2, name: 'Diabetes Treatment Policy' },
    { id: 3, name: 'Oncology Coverage Policy' },
    { id: 4, name: 'Orthopedic Surgery Policy' },
    { id: 5, name: 'Mental Health Coverage Policy' },
  ]

  // ==========================================
  // ORIGINAL GUIDELINES
  // ==========================================



  // ==========================================
  // LOAD POLICIES FROM DATABASE
  // ==========================================

  const addedPolicies = getSavedArray('addedPolicies')
  const deletedPolicyIds = getSavedArray('deletedPolicyIds')

  const allPolicies = [
    ...addedPolicies,
    ...originalPolicies,
  ].filter(
    (policy) =>
      !deletedPolicyIds.some(
        (id) => String(id) === String(policy.id)
      )
  )

  // ==========================================
  // LOAD GUIDELINES FROM DATABASE
  // ==========================================

  const addedGuidelines = getSavedArray('addedGuidelines')

  const allGuidelines = [
    ...addedGuidelines,
    ...originalGuidelines,
  ].filter(
    (guideline) =>
      !deletedGuidelineIds.some(
        (id) => String(id) === String(guideline.id)
      )
  )

  // ==========================================
  // SEARCH + FILTER + SORT
  // ==========================================

  const visibleGuidelines = allGuidelines
    .filter((guideline) => {
      const associatedPolicies = getPoliciesForGuideline(
        guideline,
        allPolicies
      )

      const searchText = [
        guideline.name,
        guideline.description || '',
        ...associatedPolicies.map((policy) => policy.name),
      ]
        .join(' ')
        .toLowerCase()

      const matchesSearch = searchText.includes(
        search.toLowerCase()
      )

      const matchesFilter =
        filter === 'All' || guideline.status === filter

      return matchesSearch && matchesFilter
    })
    .sort((a, b) => {
      const firstDate = new Date(
        a.createdAt || a.created || a.date || 0
      ).getTime()

      const secondDate = new Date(
        b.createdAt || b.created || b.date || 0
      ).getTime()

      if (sort === 'Oldest') {
        return firstDate - secondDate
      }

      return secondDate - firstDate
    })

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

          <Link to="/reviews" className="nav-item">
            Review Sessions
          </Link>

          <Link to="/policies" className="nav-item">
            Policy Database
          </Link>

          <Link
            to="/guidelines"
            className="nav-item active"
          >
            Guideline Database
          </Link>

          <Link
            to="/mappings"
            className="nav-item"
          >
            Document Mappings
          </Link>

          <Link to="/audit-log" className="nav-item">
            Audit Log
          </Link>
        </aside>

        {/* MAIN PAGE */}

        <main className="guidelines-content">
          {/* PAGE HEADING AND UPLOAD BUTTON */}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h1>Guidelines</h1>

              <p className="guidelines-subtitle">
                Reference guidelines and the policies they align with.
                Upload new guidelines directly into the Guideline Database.
              </p>
            </div>

            {/* NEW: UPLOAD GUIDELINE BUTTON */}

            <Link
              to="/guidelines/new"
              style={{
                display: 'inline-block',
                background: '#0078bf',
                color: 'white',
                padding: '12px 20px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              + Upload Guideline
            </Link>
          </div>

          {/* CONTROLS */}

          <div className="guidelines-controls">
            <div className="guidelines-search">
              <span>⌕</span>

              <input
                type="text"
                placeholder="Search guidelines or policies..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <div className="guidelines-filter-buttons">
              <button
                type="button"
                className={filter === 'All' ? 'active' : ''}
                onClick={() => setFilter('All')}
              >
                All
              </button>

              <button
                type="button"
                className={
                  filter === 'In Review' ? 'active' : ''
                }
                onClick={() => setFilter('In Review')}
              >
                In Review
              </button>

              <button
                type="button"
                className={
                  filter === 'Completed' ? 'active' : ''
                }
                onClick={() => setFilter('Completed')}
              >
                Completed
              </button>
            </div>

            <div className="guidelines-sort">
              <span>Sort by</span>

              <select
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value)
                }
              >
                <option>Most recent</option>
                <option>Oldest</option>
              </select>
            </div>
          </div>

          {deleteError && <p role="alert" className="new-policy-error">{deleteError}</p>}

          {/* GUIDELINES TABLE */}

          <div className="guidelines-table">
            <div className="guidelines-table-header">
              <div>GUIDELINE NAME</div>
              <div>DATE CREATED</div>
              <div>LAST UPDATED</div>
              <div>ASSOCIATED POLICIES</div>
            </div>

            {visibleGuidelines.map((guideline) => {
              const associatedPolicies = getPoliciesForGuideline(
                guideline,
                allPolicies
              )

              return (
                <div
                  className="guidelines-table-row"
                  key={guideline.id}
                >
                  <div className="guideline-name-cell">
                    <Link className="guideline-details-link" to={"/guidelines/" + guideline.id}>{guideline.name}</Link>
                    <p>{guideline.description}</p>
                    <button type="button" className="delete-policy-button"
                      aria-label={'Delete ' + guideline.name} onClick={() => handleDelete(guideline)}>
                      Delete
                    </button>
                  </div>

                  <div className="guideline-date-cell">
                    <span>
                      {guideline.created ||
                        guideline.date ||
                        'Recently'}
                    </span>

                    <small>
                      {guideline.createdAge ||
                        guideline.age ||
                        ''}
                    </small>
                  </div>

                  <div className="guideline-date-cell">
                    <span>
                      {guideline.updated ||
                        guideline.date ||
                        'Recently'}
                    </span>

                    <small>
                      {guideline.updatedAge || ''}
                    </small>
                  </div>

                  <div className="guideline-status-actions">
                    {associatedPolicies.length > 0 ? (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: '7px',
                        }}
                      >
                        {associatedPolicies.map((policy) => (
                          <Link
                            key={policy.id}
                            to={`/policies/${policy.id}`}
                            style={{
                              color: '#0078bf',
                              fontSize: '13px',
                              fontWeight: 600,
                              textDecoration: 'none',
                            }}
                          >
                            {policy.name}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <span
                        style={{
                          color: '#777',
                          fontSize: '13px',
                        }}
                      >
                        No mapped policies
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {visibleGuidelines.length === 0 && (
            <div
              style={{
                padding: '30px',
                textAlign: 'center',
                color: '#777',
              }}
            >
              No guidelines match your search or filter.
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default GuidelinesPage
