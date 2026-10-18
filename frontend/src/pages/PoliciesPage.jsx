
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getGuidelinesForPolicy } from '../data/guidelineMappings'

function PoliciesPage() {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('Most recent')
  const [hoveredPolicyId, setHoveredPolicyId] = useState(null)

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
  // DELETED POLICIES
  // ==========================================

  const [deletedPolicyIds, setDeletedPolicyIds] = useState(
    () => getSavedArray('deletedPolicyIds')
  )

  // ==========================================
  // ORIGINAL POLICIES
  // ==========================================

  const originalPolicies = [
    {
      id: 1,
      name: 'Cardiac Coverage Policy',
      description: 'Policy review for cardiac procedures and treatments.',
      fileName: 'Cardiac_Coverage_Policy_v4.pdf',
      created: 'Sep 23, 2026',
      createdAge: '2 days ago',
      updated: 'Sep 23, 2026',
      updatedAge: '2 days ago',
      status: 'In Review',
    },
    {
      id: 2,
      name: 'Diabetes Treatment Policy',
      description: 'Policy review for diabetes management and treatment.',
      fileName: 'Diabetes_Treatment_Policy_v3.pdf',
      created: 'Sep 18, 2026',
      createdAge: '6 days ago',
      updated: 'Sep 18, 2026',
      updatedAge: '6 days ago',
      status: 'Completed',
    },
    {
      id: 3,
      name: 'Oncology Coverage Policy',
      description: 'Policy review for oncology services and treatments.',
      fileName: 'Oncology_Policy_v2.pdf',
      created: 'Sep 10, 2026',
      createdAge: '14 days ago',
      updated: 'Sep 10, 2026',
      updatedAge: '14 days ago',
      status: 'Completed',
    },
    {
      id: 4,
      name: 'Orthopedic Surgery Policy',
      description: 'Policy review for orthopedic procedures and rehab.',
      fileName: 'Ortho_Surgery_Policy_v5.pdf',
      created: 'Sep 5, 2026',
      createdAge: '19 days ago',
      updated: 'Sep 5, 2026',
      updatedAge: '19 days ago',
      status: 'In Review',
    },
    {
      id: 5,
      name: 'Mental Health Coverage Policy',
      description: 'Policy review for mental health services and treatment.',
      fileName: 'Mental_Health_Policy_v3.pdf',
      created: 'Aug 28, 2026',
      createdAge: '27 days ago',
      updated: 'Aug 28, 2026',
      updatedAge: '27 days ago',
      status: 'Completed',
    },
  ]

  // ==========================================
  // GET UPLOADED POLICIES
  // ==========================================

  const savedPolicies = getSavedArray('addedPolicies')

  const addedPolicies = savedPolicies.map((policy) => ({
    ...policy,
    created: policy.created || policy.date,
    createdAge: policy.createdAge || policy.age || 'Just now',
    updated: policy.updated || policy.date || policy.created,
    updatedAge: policy.updatedAge || policy.age || 'Just now',
    fileName: policy.fileName || policy.name,
  }))

  // ==========================================
  // GET SAVED POLICY VERSIONS
  // ==========================================

  const policyVersions = getSavedArray('policyVersions')

  // ==========================================
  // COMBINE POLICIES
  // ==========================================

  const basePolicies = [
    ...addedPolicies,
    ...originalPolicies,
  ].filter(
    (policy) =>
      !deletedPolicyIds.some(
        (id) => String(id) === String(policy.id)
      )
  )

  // ==========================================
  // APPLY EDITED VERSION INFORMATION
  // ==========================================

  const allPolicies = basePolicies.map((policy) => {
    const matchingVersions = policyVersions.filter(
      (version) =>
        version.originalPolicy === policy.fileName ||
        version.originalPolicy === policy.name
    )

    if (matchingVersions.length === 0) {
      return {
        ...policy,
        versionCount: 0,
      }
    }

    const newestVersion = [...matchingVersions].sort(
      (a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
    )[0]

    const updatedDate = new Date(
      newestVersion.createdAt
    ).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    return {
      ...policy,
      updated: updatedDate,
      updatedAge: 'Just now',
      versionCount: matchingVersions.length,
      latestVersion: newestVersion,
    }
  })

  // ==========================================
  // GUIDELINES FROM THE DATABASE
  // ==========================================

  const originalGuidelines = [
    { id: 1, name: 'Cardiac Coverage Guideline' },
    { id: 2, name: 'Diabetes Treatment Guideline' },
    { id: 3, name: 'Oncology Coverage Guideline' },
    { id: 4, name: 'Orthopedic Surgery Guideline' },
    { id: 5, name: 'Mental Health Guideline' },
  ]

  const addedGuidelines = getSavedArray('addedGuidelines')
  const deletedGuidelineIds = getSavedArray('deletedGuidelineIds')

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
  // GET ASSOCIATED GUIDELINES
  // ==========================================

  function getAssociatedGuidelines(policy) {
    return getGuidelinesForPolicy(
      policy,
      allGuidelines
    )
  }

  // ==========================================
  // DELETE POLICY + RECORD AUDIT EVENT
  // ==========================================

  function deletePolicy(id, name) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${name}"?`
    )

    if (!confirmed) return

    // Remove from uploaded policies, if present.
    const currentSavedPolicies =
      getSavedArray('addedPolicies')

    const updatedSavedPolicies =
      currentSavedPolicies.filter(
        (policy) =>
          String(policy.id) !== String(id)
      )

    localStorage.setItem(
      'addedPolicies',
      JSON.stringify(updatedSavedPolicies)
    )

    // Hide the policy from the database.
    const updatedDeletedIds = [
      ...deletedPolicyIds,
      id,
    ]

    setDeletedPolicyIds(updatedDeletedIds)

    localStorage.setItem(
      'deletedPolicyIds',
      JSON.stringify(updatedDeletedIds)
    )

    // Record deletion in the Audit Log.
    const auditEvents = getSavedArray('auditEvents')

    const auditEvent = {
      id: `policy-delete-${Date.now()}-${id}`,
      date: new Date().toISOString(),
      user: 'Sarah Chen',
      action: 'Policy Deleted',
      category: 'Policy Changes',
      item: name,
      details: `Deleted policy "${name}" from the Policy Database.`,
    }

    auditEvents.push(auditEvent)

    localStorage.setItem(
      'auditEvents',
      JSON.stringify(auditEvents)
    )
  }

  // ==========================================
  // SEARCH + FILTER + SORT
  // ==========================================

  const visiblePolicies = allPolicies
    .filter((policy) => {
      const matchesSearch = policy.name
        .toLowerCase()
        .includes(search.toLowerCase())

      const matchesFilter =
        filter === 'All' || policy.status === filter

      return matchesSearch && matchesFilter
    })
    .sort((a, b) => {
      if (sort === 'Oldest') {
        return new Date(a.created) - new Date(b.created)
      }

      return new Date(b.created) - new Date(a.created)
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

          <Link
            to="/policies"
            className="nav-item active"
          >
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

        <main className="policies-content">
          <h1>Policies</h1>

          <p className="policies-subtitle">
            View and manage your policies. Hover over
            a policy name to see its associated guidelines.
          </p>

          {/* CONTROLS */}

          <div className="policies-controls">
            <div className="policies-search">
              <span>⌕</span>

              <input
                type="text"
                placeholder="Search policies..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <div className="policies-filter-buttons">
              <button
                type="button"
                className={
                  filter === 'All' ? 'active' : ''
                }
                onClick={() => setFilter('All')}
              >
                All
              </button>

              <button
                type="button"
                className={
                  filter === 'In Review' ? 'active' : ''
                }
                onClick={() =>
                  setFilter('In Review')
                }
              >
                In Review
              </button>

              <button
                type="button"
                className={
                  filter === 'Completed' ? 'active' : ''
                }
                onClick={() =>
                  setFilter('Completed')
                }
              >
                Completed
              </button>
            </div>

            <div className="policies-sort">
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

          {/* POLICY TABLE */}

          <div className="policies-table">
            <div className="policies-table-header">
              <div>POLICY NAME</div>
              <div>DATE CREATED</div>
              <div>LAST UPDATED</div>
              <div>STATUS</div>
            </div>

            {visiblePolicies.map((policy) => {
              const associatedGuidelines =
                getAssociatedGuidelines(policy)

              return (
                <div
                  className="policies-table-row"
                  key={policy.id}
                >
                  <div className="policy-name-cell">
                    {/* POLICY NAME + HOVER PANEL */}

                    <div
                      style={{
                        position: 'relative',
                        display: 'inline-block',
                        maxWidth: '100%',
                      }}
                      onMouseEnter={() =>
                        setHoveredPolicyId(policy.id)
                      }
                      onMouseLeave={() =>
                        setHoveredPolicyId(null)
                      }
                    >
                      <Link
                        to={`/policies/${policy.id}`}
                        className="policy-name-link"
                        aria-describedby={
                          hoveredPolicyId === policy.id
                            ? `guideline-tooltip-${policy.id}`
                            : undefined
                        }
                      >
                        {policy.name}
                      </Link>

                      {hoveredPolicyId === policy.id && (
                        <div
                          id={`guideline-tooltip-${policy.id}`}
                          role="tooltip"
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            zIndex: 100,
                            width: '290px',
                            padding: '14px 16px',
                            marginTop: '4px',
                            background: '#ffffff',
                            border:
                              '1px solid #dbe3eb',
                            borderRadius: '8px',
                            boxShadow:
                              '0 8px 24px rgba(0,0,0,0.14)',
                            textAlign: 'left',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              color: '#475569',
                              marginBottom: '10px',
                            }}
                          >
                            ASSOCIATED GUIDELINES
                          </div>

                          {associatedGuidelines.length > 0 ? (
                            associatedGuidelines.map(
                              (guideline) => (
                                <div
                                  key={guideline.id}
                                  style={{
                                    padding: '7px 0',
                                    fontSize: '13px',
                                    color: '#0078bf',
                                    borderBottom:
                                      '1px solid #f1f5f9',
                                  }}
                                >
                                  {guideline.name}
                                </div>
                              )
                            )
                          ) : (
                            <div
                              style={{
                                fontSize: '13px',
                                color: '#64748b',
                              }}
                            >
                              No associated guidelines
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <p>{policy.description}</p>

                    {policy.versionCount > 0 && (
                      <small className="policy-version-note">
                        {policy.versionCount === 1
                          ? '1 edited version saved'
                          : `${policy.versionCount} edited versions saved`}
                      </small>
                    )}
                  </div>

                  <div className="policy-date-cell">
                    <span>{policy.created}</span>
                    <small>{policy.createdAge}</small>
                  </div>

                  <div className="policy-date-cell">
                    <span>{policy.updated}</span>
                    <small>{policy.updatedAge}</small>
                  </div>

                  <div className="policy-status-actions">
                    <span
                      className={
                        policy.status === 'Completed'
                          ? 'status completed'
                          : 'status in-review'
                      }
                    >
                      {policy.status}
                    </span>

                    <button
                      type="button"
                      className="delete-policy-button"
                      onClick={() =>
                        deletePolicy(
                          policy.id,
                          policy.name
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* NEW POLICY BUTTON */}

          <button
            type="button"
            className="new-policy-button"
            onClick={() =>
              navigate('/policies/new')
            }
          >
            New Policy
            <span>＋</span>
          </button>
        </main>
      </div>
    </div>
  )
}

export default PoliciesPage
