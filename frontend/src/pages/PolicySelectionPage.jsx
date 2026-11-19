
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import './DashboardPage.css'
import './PolicySelectionPage.css'

// ==========================================
// READ SAVED DATA
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
  {
    id: 1,
    name: 'Cardiac Coverage Policy',
    description:
      'Coverage criteria for cardiac procedures, diagnostic testing, and treatment.',
    updated: 'Sep 23, 2026',
    status: 'Active',
    version: 'v4.0',
  },
  {
    id: 2,
    name: 'Diabetes Treatment Policy',
    description:
      'Coverage criteria for diabetes management, medications, and treatment.',
    updated: 'Sep 18, 2026',
    status: 'Active',
    version: 'v3.0',
  },
  {
    id: 3,
    name: 'Oncology Coverage Policy',
    description:
      'Coverage criteria for oncology services, testing, and treatments.',
    updated: 'Sep 10, 2026',
    status: 'Active',
    version: 'v2.0',
  },
  {
    id: 4,
    name: 'Orthopedic Surgery Policy',
    description:
      'Coverage criteria for orthopedic procedures and rehabilitation.',
    updated: 'Sep 5, 2026',
    status: 'Active',
    version: 'v5.0',
  },
  {
    id: 5,
    name: 'Mental Health Coverage Policy',
    description:
      'Coverage criteria for mental health services and treatment.',
    updated: 'Aug 28, 2026',
    status: 'Active',
    version: 'v3.0',
  },
]

function PolicySelectionPage() {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const [selectedId, setSelectedId] = useState(() => {
    const saved = getSavedArray('selectedPolicies')
    return saved.length > 0 ? String(saved[0].id) : ''
  })

  // ==========================================
  // LOAD POLICY DATABASE
  // ==========================================

  const deletedIds = getSavedArray('deletedPolicyIds')

  const policies = [
    ...getSavedArray('addedPolicies'),
    ...originalPolicies,
  ]
    .filter(
      (policy) =>
        !deletedIds.some(
          (id) => String(id) === String(policy.id)
        )
    )
    .filter(
      (policy, index, array) =>
        array.findIndex(
          (item) => String(item.id) === String(policy.id)
        ) === index
    )

  const visiblePolicies = policies.filter((policy) => {
    const query = search.toLowerCase().trim()

    return (
      (policy.name || policy.fileName || '')
        .toLowerCase()
        .includes(query) ||
      (policy.description || '')
        .toLowerCase()
        .includes(query)
    )
  })

  const selectedPolicy = policies.find(
    (policy) => String(policy.id) === selectedId
  )

  function selectPolicy(id) {
    setSelectedId(String(id))
    setError('')
  }

  // ==========================================
  // CONFIRM POLICY SELECTION
  // ==========================================

  function confirmSelection() {
    const currentDeletedIds = getSavedArray(
      'deletedPolicyIds'
    )

    const currentPolicies = [
      ...getSavedArray('addedPolicies'),
      ...originalPolicies,
    ].filter(
      (policy) =>
        !currentDeletedIds.some(
          (id) => String(id) === String(policy.id)
        )
    )

    const selected = currentPolicies.find(
      (policy) => String(policy.id) === selectedId
    )

    if (!selected) {
      setError(
        'Please select one policy from the Policy Database.'
      )
      return
    }

    localStorage.setItem(
      'selectedPolicies',
      JSON.stringify([selected])
    )

    // Reset guideline selection for the newly selected policy
    localStorage.removeItem('selectedGuidelines')

    navigate('/reviews/new')
  }

  return (
    <div className="app-page ccf-dashboard ccf-policy-selection-page">
      {/* GREEN HEADER */}
      <header className="top-bar">
        <div className="brand-area">
          <span className="brand-name">CCF</span>
          <span className="brand-divider" />
          <span className="workspace-name">
            Insurance Policy Review Workspace
          </span>
        </div>

        <div className="top-right">
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

          <Link to="/mappings" className="nav-item">
            Document Mappings
          </Link>

          <Link to="/audit-log" className="nav-item">
            Audit Log
          </Link>
        </aside>

        {/* MAIN CONTENT */}
        <main className="ccf-policy-selection-content">
          <Link
            to="/reviews/new"
            className="ccf-policy-selection-back"
          >
            ← Back to Review Session
          </Link>

          <div className="ccf-policy-selection-heading">
            <span className="ccf-policy-selection-eyebrow">
              NEW REVIEW SESSION
            </span>

            <h1>Select a Policy</h1>

            <p>
              Choose one policy from the Policy Database
              to include in your review session.
            </p>
          </div>

          {/* POLICY SELECTION CARD */}
          <section className="ccf-policy-selection-card">
            <div className="ccf-policy-selection-card-heading">
              <div>
                <h2>Policy Database</h2>

                <p>
                  Search available policies and select
                  the policy you want to review.
                </p>
              </div>

              <span className="ccf-policy-selection-count">
                {policies.length}{' '}
                {policies.length === 1
                  ? 'policy available'
                  : 'policies available'}
              </span>
            </div>

            {/* SEARCH */}
            <div className="ccf-policy-selection-toolbar">
              <div className="ccf-policy-selection-search">
                <span aria-hidden="true">⌕</span>

                <input
                  type="search"
                  placeholder="Search policies by name or description..."
                  aria-label="Search policies"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />
              </div>

              <span
                className={`ccf-policy-selection-selected-count ${
                  selectedPolicy ? 'has-selection' : ''
                }`}
              >
                {selectedPolicy
                  ? '1 policy selected'
                  : 'No policy selected'}
              </span>
            </div>

            {/* POLICY TABLE */}
            <div className="ccf-policy-selection-table-wrapper">
              <table className="ccf-policy-selection-table">
                <thead>
                  <tr>
                    <th aria-label="Select policy" />
                    <th>POLICY NAME</th>
                    <th>VERSION</th>
                    <th>LAST UPDATED</th>
                    <th>STATUS</th>
                  </tr>
                </thead>

                <tbody>
                  {visiblePolicies.map((policy) => {
                    const isSelected =
                      selectedId === String(policy.id)

                    return (
                      <tr
                        key={policy.id}
                        className={
                          isSelected ? 'selected' : ''
                        }
                        onClick={() =>
                          selectPolicy(policy.id)
                        }
                      >
                        <td>
                          <input
                            type="radio"
                            name="selected-policy"
                            checked={isSelected}
                            onChange={() =>
                              selectPolicy(policy.id)
                            }
                            aria-label={`Select ${
                              policy.name ||
                              policy.fileName ||
                              'Untitled Policy'
                            }`}
                          />
                        </td>

                        <td>
                          <strong>
                            {policy.name ||
                              policy.fileName ||
                              'Untitled Policy'}
                          </strong>

                          <p>
                            {policy.description || ''}
                          </p>
                        </td>

                        <td>
                          {policy.version || 'v1.0'}
                        </td>

                        <td>
                          {policy.updated ||
                            policy.date ||
                            policy.created ||
                            'Recently'}
                        </td>

                        <td>
                          <span className="ccf-policy-selection-status">
                            {policy.status || 'Active'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {visiblePolicies.length === 0 && (
                <div className="ccf-policy-selection-empty">
                  <strong>No policies found</strong>

                  <p>
                    Try searching for a different
                    policy name or description.
                  </p>
                </div>
              )}
            </div>

            {/* SELECTED POLICY SUMMARY */}
            {selectedPolicy && (
              <div className="ccf-policy-selection-summary">
                <div>
                  <span>SELECTED POLICY</span>

                  <strong>
                    {selectedPolicy.name ||
                      selectedPolicy.fileName ||
                      'Untitled Policy'}
                  </strong>

                  <p>
                    {selectedPolicy.description ||
                      'This policy will be included in the review session.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedId('')
                    setError('')
                  }}
                >
                  Clear Selection
                </button>
              </div>
            )}

            {/* ERROR */}
            {error && (
              <p
                className="ccf-policy-selection-error"
                role="alert"
              >
                {error}
              </p>
            )}

            {/* BOTTOM BUTTONS */}
            <div className="ccf-policy-selection-actions">
              <button
                type="button"
                className="ccf-policy-selection-cancel"
                onClick={() =>
                  navigate('/reviews/new')
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="ccf-policy-selection-confirm"
                onClick={confirmSelection}
                disabled={!selectedPolicy}
              >
                Add Policy to Review
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default PolicySelectionPage
