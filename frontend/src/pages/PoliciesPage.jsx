
import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { getGuidelinesForPolicy } from '../data/guidelineMappings'
import './DashboardPage.css'
import './PoliciesPage.css'

function getSavedArray(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

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

const originalGuidelines = [
  { id: 1, name: 'Cardiac Coverage Guideline' },
  { id: 2, name: 'Diabetes Treatment Guideline' },
  { id: 3, name: 'Oncology Coverage Guideline' },
  { id: 4, name: 'Orthopedic Surgery Guideline' },
  { id: 5, name: 'Mental Health Guideline' },
]

const navigation = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Review Sessions', path: '/reviews' },
  { label: 'Policy Database', path: '/policies' },
  { label: 'Guideline Database', path: '/guidelines' },
  { label: 'Document Mappings', path: '/mappings' },
  { label: 'Audit Log', path: '/audit-log' },
]

function PoliciesPage() {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('Most recent')
  const [hoveredPolicyId, setHoveredPolicyId] = useState(null)
  const [helpOpen, setHelpOpen] = useState(false)

  const [deletedPolicyIds, setDeletedPolicyIds] = useState(
    () => getSavedArray('deletedPolicyIds')
  )

  const savedPolicies = getSavedArray('addedPolicies')

  const addedPolicies = savedPolicies.map((policy) => ({
    ...policy,
    created: policy.created || policy.date,
    createdAge: policy.createdAge || policy.age || '',
    updated: policy.updated || policy.date || policy.created,
    updatedAge: policy.updatedAge || policy.age || '',
    fileName: policy.fileName || policy.name,
  }))

  const policyVersions = getSavedArray('policyVersions')

  const basePolicies = [
    ...addedPolicies,
    ...originalPolicies,
  ].filter(
    (policy) =>
      !deletedPolicyIds.some(
        (id) => String(id) === String(policy.id)
      )
  ).filter(
    (policy, index, array) =>
      array.findIndex(
        (item) => String(item.id) === String(policy.id)
      ) === index
  )

  const allPolicies = basePolicies.map((policy) => {
    const matchingVersions = policyVersions.filter(
      (version) =>
        version.originalPolicy === policy.fileName ||
        version.originalPolicy === policy.name
    )

    if (matchingVersions.length === 0) {
      return { ...policy, versionCount: 0 }
    }

    const newestVersion = [...matchingVersions].sort(
      (a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
    )[0]

    const savedDate = new Date(newestVersion.createdAt)

    return {
      ...policy,
      updated: Number.isNaN(savedDate.getTime())
        ? policy.updated
        : savedDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
      updatedAge: '',
      versionCount: matchingVersions.length,
      latestVersion: newestVersion,
    }
  })

  const deletedGuidelineIds = getSavedArray('deletedGuidelineIds')

  const allGuidelines = [
    ...getSavedArray('addedGuidelines'),
    ...originalGuidelines,
  ].filter(
    (guideline) =>
      !deletedGuidelineIds.some(
        (id) => String(id) === String(guideline.id)
      )
  )

  function deletePolicy(id, name) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${name}"?`
    )

    if (!confirmed) return

    const updatedSavedPolicies = getSavedArray(
      'addedPolicies'
    ).filter(
      (policy) => String(policy.id) !== String(id)
    )

    localStorage.setItem(
      'addedPolicies',
      JSON.stringify(updatedSavedPolicies)
    )

    const updatedDeletedIds = [
      ...new Set([...deletedPolicyIds, id]),
    ]

    setDeletedPolicyIds(updatedDeletedIds)

    localStorage.setItem(
      'deletedPolicyIds',
      JSON.stringify(updatedDeletedIds)
    )

    const auditEvents = getSavedArray('auditEvents')

    auditEvents.push({
      id: `policy-delete-${Date.now()}-${id}`,
      date: new Date().toISOString(),
      user: 'Sarah Chen',
      action: 'Policy Deleted',
      category: 'Policy Changes',
      item: name,
      details: `Deleted policy "${name}" from the Policy Database.`,
    })

    localStorage.setItem(
      'auditEvents',
      JSON.stringify(auditEvents)
    )

    setHoveredPolicyId(null)
  }

  const visiblePolicies = allPolicies
    .filter((policy) => {
      const query = search.trim().toLowerCase()

      const matchesSearch =
        (policy.name || '').toLowerCase().includes(query) ||
        (policy.description || '').toLowerCase().includes(query) ||
        (policy.fileName || '').toLowerCase().includes(query)

      const matchesFilter =
        filter === 'All' || policy.status === filter

      return matchesSearch && matchesFilter
    })
    .sort((a, b) => {
      const aDate = new Date(a.created).getTime() || 0
      const bDate = new Date(b.created).getTime() || 0

      return sort === 'Oldest'
        ? aDate - bDate
        : bDate - aDate
    })

  return (
    <div className="app-page ccf-dashboard ccf-policies-page">
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
            aria-label="How to use Policy Database"
            title="How to use Policy Database"
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

        <main className="ccf-policies-content">
          <div className="ccf-policies-heading">
            <h1>Policy Database</h1>
            <p>
              View and manage insurance policies. Hover over a
              policy name to see its associated guidelines.
            </p>
          </div>

          <section className="ccf-policies-panel">
            <div className="ccf-policies-panel-heading">
              <div>
                <h2>All Policies</h2>
                <p>
                  Select a policy name to view its details,
                  associated guidelines, and saved versions.
                </p>
              </div>

              <span className="ccf-policies-count">
                {visiblePolicies.length}{' '}
                {visiblePolicies.length === 1
                  ? 'policy'
                  : 'policies'}
              </span>
            </div>

            <div className="ccf-policies-controls">
              <input
                type="search"
                className="ccf-policies-search"
                placeholder="Search policies..."
                aria-label="Search policies"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />

              <div className="ccf-policies-filters">
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

              <label className="ccf-policies-sort">
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
                  <option value="Oldest">Oldest</option>
                </select>
              </label>
            </div>

            <div className="ccf-policies-table-scroll">
              <table className="ccf-policies-table">
                <thead>
                  <tr>
                    <th>Policy Name</th>
                    <th>Date Created</th>
                    <th>Last Updated</th>
                    <th>Status</th>
                    <th>Saved Versions</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {visiblePolicies.map((policy) => {
                    const associatedGuidelines =
                      getGuidelinesForPolicy(
                        policy,
                        allGuidelines
                      )

                    return (
                      <tr key={policy.id}>
                        <td className="ccf-policy-name-cell">
                          <div
                            className="ccf-policy-name-wrapper"
                            onMouseEnter={() =>
                              setHoveredPolicyId(policy.id)
                            }
                            onMouseLeave={() =>
                              setHoveredPolicyId(null)
                            }
                          >
                            <Link
                              to={`/policies/${policy.id}`}
                              className="ccf-policy-name-link"
                              aria-describedby={
                                hoveredPolicyId === policy.id
                                  ? `policy-guidelines-${policy.id}`
                                  : undefined
                              }
                            >
                              {policy.name || 'Untitled Policy'}
                            </Link>

                            {hoveredPolicyId === policy.id && (
                              <div
                                className="ccf-policy-tooltip"
                                role="tooltip"
                                id={`policy-guidelines-${policy.id}`}
                              >
                                <strong>
                                  Associated Guidelines
                                </strong>

                                {associatedGuidelines.length > 0 ? (
                                  <ul>
                                    {associatedGuidelines.map(
                                      (guideline) => (
                                        <li key={guideline.id}>
                                          {guideline.name}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                ) : (
                                  <p>
                                    No associated guidelines
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          <p className="ccf-policy-description">
                            {policy.description || ''}
                          </p>
                        </td>

                        <td>
                          <span className="ccf-policy-date">
                            {policy.created || 'Not available'}
                          </span>
                        </td>

                        <td>
                          <span className="ccf-policy-date">
                            {policy.updated || 'Not available'}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`ccf-policy-status ${
                              policy.status === 'Completed'
                                ? 'completed'
                                : 'in-review'
                            }`}
                          >
                            {policy.status || 'In Review'}
                          </span>
                        </td>

                        <td>
                          <span className="ccf-policy-version-count">
                            {policy.versionCount}
                          </span>
                          <span className="ccf-policy-version-label">
                            {policy.versionCount === 1
                              ? 'saved version'
                              : 'saved versions'}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="ccf-policy-delete"
                            onClick={() =>
                              deletePolicy(
                                policy.id,
                                policy.name || 'Untitled Policy'
                              )
                            }
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })}

                  {visiblePolicies.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="ccf-policies-empty"
                      >
                        No policies match your search or filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="ccf-policies-bottom">
              <span>
                Showing {visiblePolicies.length} of{' '}
                {allPolicies.length} policies
              </span>

              <button
                type="button"
                className="ccf-policies-upload-button"
                onClick={() => navigate('/policies/new')}
              >
                + Upload Policy
              </button>
            </div>
          </section>
        </main>
      </div>

      {helpOpen && (
        <div
          className="ccf-policies-help-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setHelpOpen(false)
            }
          }}
        >
          <div
            className="ccf-policies-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="policy-help-title"
          >
            <div className="ccf-policies-help-heading">
              <h2 id="policy-help-title">
                How to Use Policy Database
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
              The Policy Database stores insurance policies
              available for review.
            </p>

            <ol>
              <li>
                Use the search bar to find a policy by
                name, description, or file name.
              </li>
              <li>
                Use the status filters to view policies
                that are In Review or Completed.
              </li>
              <li>
                Click a blue policy name to view its
                details and saved versions.
              </li>
              <li>
                Hover over a policy name to see its
                associated guidelines.
              </li>
              <li>
                Click Upload Policy to add a new policy.
              </li>
              <li>
                Use Document Mappings to manage the
                relationships between policies and guidelines.
              </li>
            </ol>

            <Link
              to="/mappings"
              className="ccf-policies-help-link"
              onClick={() => setHelpOpen(false)}
            >
              Open Document Mappings
            </Link>

            <div className="ccf-policies-help-footer">
              <button
                type="button"
                className="ccf-policies-upload-button"
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

export default PoliciesPage
