
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function PolicySelectionPage() {
  const navigate = useNavigate()

  // ==========================================
  // ORIGINAL POLICIES IN DATABASE
  // ==========================================

  const originalPolicies = [
    {
      id: 1,
      name: 'Cardiac Coverage Policy',
      description:
        'Coverage criteria for cardiac procedures, diagnostic testing, and treatment.',
      date: 'Sep 23, 2026',
      age: '2 days ago',
      updated: 'Sep 23, 2026',
      updatedAge: '2 days ago',
      status: 'Active',
      version: 'v4.0',
    },
    {
      id: 2,
      name: 'Diabetes Treatment Policy',
      description:
        'Coverage criteria for diabetes management, medications, and treatment.',
      date: 'Sep 18, 2026',
      age: '6 days ago',
      updated: 'Sep 18, 2026',
      updatedAge: '6 days ago',
      status: 'Active',
      version: 'v3.0',
    },
    {
      id: 3,
      name: 'Oncology Coverage Policy',
      description:
        'Coverage criteria for oncology services, testing, and treatments.',
      date: 'Sep 10, 2026',
      age: '14 days ago',
      updated: 'Sep 10, 2026',
      updatedAge: '14 days ago',
      status: 'Active',
      version: 'v2.0',
    },
    {
      id: 4,
      name: 'Orthopedic Surgery Policy',
      description:
        'Coverage criteria for orthopedic procedures and rehabilitation.',
      date: 'Sep 5, 2026',
      age: '19 days ago',
      updated: 'Sep 5, 2026',
      updatedAge: '19 days ago',
      status: 'Active',
      version: 'v5.0',
    },
    {
      id: 5,
      name: 'Mental Health Coverage Policy',
      description:
        'Coverage criteria for mental health services and treatment.',
      date: 'Aug 28, 2026',
      age: '27 days ago',
      updated: 'Aug 28, 2026',
      updatedAge: '27 days ago',
      status: 'Active',
      version: 'v3.0',
    },
  ]

  // ==========================================
  // READ DATABASE DATA SAFELY
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
  // GET UPLOADED POLICIES FROM DATABASE
  // ==========================================

  const savedPolicies = getSavedArray('addedPolicies')

  const addedPolicies = savedPolicies.map((policy) => ({
    ...policy,
    date: policy.date || policy.created || 'Recently',
    age: policy.age || policy.createdAge || 'Just now',
    updated:
      policy.updated ||
      policy.date ||
      policy.created ||
      'Recently',
    updatedAge: policy.updatedAge || 'Just now',
    status: policy.status || 'Active',
    version: policy.version || 'v1.0',
  }))

  // ==========================================
  // EXCLUDE DELETED DATABASE POLICIES
  // ==========================================

  const deletedPolicyIds = getSavedArray('deletedPolicyIds')

  const policies = [
    ...addedPolicies,
    ...originalPolicies,
  ].filter(
    (policy) => !deletedPolicyIds.includes(policy.id)
  )

  // ==========================================
  // PREVIOUSLY SELECTED POLICIES
  // ==========================================

  const previouslySelected = getSavedArray('selectedPolicies')

  // Only restore selections that still exist
  // in the Policy Database.
  const startingSelections = previouslySelected
    .map((policy) => policy.id)
    .filter((id) =>
      policies.some((policy) => policy.id === id)
    )

  const [selectedPolicies, setSelectedPolicies] =
    useState(startingSelections)

  // ==========================================
  // SEARCH
  // ==========================================

  const [search, setSearch] = useState('')

  const visiblePolicies = policies.filter((policy) => {
    const searchText = search.toLowerCase()

    return (
      policy.name.toLowerCase().includes(searchText) ||
      (policy.description || '')
        .toLowerCase()
        .includes(searchText)
    )
  })

  // ==========================================
  // CHECK / UNCHECK POLICY
  // ==========================================

  function togglePolicy(id) {
    // Do not allow selecting policies
    // that are missing from the database.
    const existsInDatabase = policies.some(
      (policy) => policy.id === id
    )

    if (!existsInDatabase) return

    if (selectedPolicies.includes(id)) {
      setSelectedPolicies(
        selectedPolicies.filter(
          (policyId) => policyId !== id
        )
      )
    } else {
      setSelectedPolicies([
        ...selectedPolicies,
        id,
      ])
    }
  }

  // ==========================================
  // CONFIRM SELECTIONS
  // ==========================================

  function confirmSelections() {
    // Recheck the database at confirmation time
    // so deleted policies cannot be added.
    const currentUploadedPolicies =
      getSavedArray('addedPolicies')

    const currentDeletedIds =
      getSavedArray('deletedPolicyIds')

    const currentDatabasePolicies = [
      ...currentUploadedPolicies,
      ...originalPolicies,
    ].filter(
      (policy) => !currentDeletedIds.includes(policy.id)
    )

    const selected = currentDatabasePolicies.filter(
      (policy) => selectedPolicies.includes(policy.id)
    )

    if (selected.length === 0) {
      alert(
        'Please select at least one policy from the Policy Database.'
      )
      return
    }

    localStorage.setItem(
      'selectedPolicies',
      JSON.stringify(selected)
    )

    navigate('/reviews/new')
  }

  // ==========================================
  // CANCEL
  // ==========================================

  function cancelSelection() {
    navigate('/reviews/new')
  }

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <div className="policy-selection-page">
      {/* BACKGROUND PAGE */}

      <div className="selection-background">
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

          <main className="selection-background-content">
            <span>← Back to Review Sessions</span>

            <h1>Start a Review Session</h1>

            <p>
              Create a review session and choose the policies
              that should be evaluated.
            </p>

            <div className="background-card">
              <h2>Review Session Details</h2>
            </div>

            <div className="background-card">
              <h2>Policies in this Review Session</h2>
            </div>
          </main>
        </div>
      </div>

      {/* DARK / BLUR OVERLAY */}

      <div
        className="selection-overlay"
        onClick={cancelSelection}
      ></div>

      {/* POLICY SELECTION MODAL */}

      <div className="policy-selection-modal">
        {/* MODAL HEADER */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '20px',
            marginBottom: '8px',
          }}
        >
          <div>
            <h1 style={{ marginBottom: '7px' }}>
              Select Policies
            </h1>

            <p
              className="selection-subtitle"
              style={{ margin: 0 }}
            >
              Choose existing policies from the Policy Database
              to include in this review session.
            </p>
          </div>

          <button
            type="button"
            onClick={cancelSelection}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '22px',
              cursor: 'pointer',
              color: '#666',
            }}
            aria-label="Close policy selection"
          >
            ×
          </button>
        </div>

        {/* SEARCH + SELECTION COUNT */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '20px',
            margin: '22px 0 18px',
          }}
        >
          <input
            type="text"
            placeholder="⌕   Search Policy Database..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            style={{
              flex: 1,
              minWidth: 0,
              padding: '10px 12px',
              border: '1px solid #cfcfcf',
              borderRadius: '4px',
              fontFamily: 'inherit',
            }}
          />

          <span
            style={{
              fontSize: '13px',
              fontWeight: '700',
              color:
                selectedPolicies.length > 0
                  ? '#0078bf'
                  : '#777',
              whiteSpace: 'nowrap',
            }}
          >
            {selectedPolicies.length}{' '}
            {selectedPolicies.length === 1
              ? 'policy selected'
              : 'policies selected'}
          </span>
        </div>

        {/* POLICY TABLE */}

        <div className="selection-table">
          <div className="selection-table-header">
            <div></div>
            <div>POLICY NAME</div>
            <div>VERSION</div>
            <div>LAST UPDATED</div>
            <div>STATUS</div>
          </div>

          {visiblePolicies.map((policy) => (
            <div
              className="selection-table-row"
              key={policy.id}
              style={{ cursor: 'pointer' }}
              onClick={() => togglePolicy(policy.id)}
            >
              <div className="selection-checkbox-cell">
                <input
                  type="checkbox"
                  checked={selectedPolicies.includes(
                    policy.id
                  )}
                  onChange={() => togglePolicy(policy.id)}
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                />
              </div>

              <div className="selection-policy-name">
                <strong>{policy.name}</strong>
                <p>{policy.description}</p>
              </div>

              <div className="selection-date">
                <span>
                  {policy.version || 'v1.0'}
                </span>
                <small>Current version</small>
              </div>

              <div className="selection-date">
                <span>{policy.updated}</span>
                <small>{policy.updatedAge}</small>
              </div>

              <div>
                <span className="status completed">
                  {policy.status || 'Active'}
                </span>
              </div>
            </div>
          ))}

          {visiblePolicies.length === 0 && (
            <div
              style={{
                padding: '30px',
                textAlign: 'center',
                color: '#777',
              }}
            >
              {policies.length === 0
                ? 'No policies are available in the Policy Database.'
                : 'No policies match your search.'}
            </div>
          )}
        </div>

        {/* BOTTOM ACTIONS */}

        <div
          className="selection-confirm-row"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            className="cancel-review-button"
            onClick={cancelSelection}
          >
            Cancel
          </button>

          <button
            type="button"
            className="confirm-selection-button"
            onClick={confirmSelections}
          >
            Add {selectedPolicies.length}{' '}
            {selectedPolicies.length === 1
              ? 'Policy'
              : 'Policies'} to Session
          </button>
        </div>
      </div>
    </div>
  )
}

export default PolicySelectionPage
