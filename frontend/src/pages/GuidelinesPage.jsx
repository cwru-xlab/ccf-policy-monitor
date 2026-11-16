
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { deleteGuideline, originalGuidelines } from '../data/guidelines'
import { getPoliciesForGuideline } from '../data/guidelineMappings'
import './DashboardPage.css'
import './GuidelinesPage.css'

function getSavedArray(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

const originalPolicies = [
  { id: 1, name: 'Cardiac Coverage Policy' },
  { id: 2, name: 'Diabetes Treatment Policy' },
  { id: 3, name: 'Oncology Coverage Policy' },
  { id: 4, name: 'Orthopedic Surgery Policy' },
  { id: 5, name: 'Mental Health Coverage Policy' },
]

const navigation = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Review Sessions', path: '/reviews' },
  { label: 'Policy Database', path: '/policies' },
  { label: 'Guideline Database', path: '/guidelines' },
  { label: 'Document Mappings', path: '/mappings' },
  { label: 'Audit Log', path: '/audit-log' },
]

function GuidelinesPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('Most recent')
  const [helpOpen, setHelpOpen] = useState(false)
  const [deletedGuidelineIds, setDeletedGuidelineIds] = useState(() =>
    getSavedArray('deletedGuidelineIds')
  )
  const [deleteError, setDeleteError] = useState('')

  function handleDelete(guideline) {
    if (
      !window.confirm(
        `Are you sure you want to delete "${guideline.name}"?`
      )
    ) {
      return
    }

    try {
      deleteGuideline(guideline)
      setDeleteError('')
    } catch {
      setDeleteError(
        'Could not finish deleting the guideline. Please try again.'
      )
    } finally {
      setDeletedGuidelineIds(getSavedArray('deletedGuidelineIds'))
    }
  }

  const deletedPolicyIds = getSavedArray('deletedPolicyIds')

  const allPolicies = [
    ...getSavedArray('addedPolicies'),
    ...originalPolicies,
  ].filter(
    (policy) =>
      !deletedPolicyIds.some(
        (id) => String(id) === String(policy.id)
      )
  )

  const allGuidelines = [
    ...getSavedArray('addedGuidelines'),
    ...originalGuidelines,
  ].filter(
    (guideline) =>
      !deletedGuidelineIds.some(
        (id) => String(id) === String(guideline.id)
      )
  )

  const visibleGuidelines = allGuidelines
    .filter((guideline) => {
      const associatedPolicies = getPoliciesForGuideline(
        guideline,
        allPolicies
      )

      const searchText = [
        guideline.name || '',
        guideline.description || '',
        guideline.fileName || '',
        ...associatedPolicies.map((policy) => policy.name || ''),
      ]
        .join(' ')
        .toLowerCase()

      const matchesSearch = searchText.includes(
        search.trim().toLowerCase()
      )

      const matchesFilter =
        filter === 'All' || guideline.status === filter

      return matchesSearch && matchesFilter
    })
    .sort((a, b) => {
      const firstDate =
        new Date(a.createdAt || a.created || a.date || 0).getTime() || 0

      const secondDate =
        new Date(b.createdAt || b.created || b.date || 0).getTime() || 0

      return sort === 'Oldest'
        ? firstDate - secondDate
        : secondDate - firstDate
    })

  return (
    <div className="app-page ccf-dashboard ccf-guidelines-page">
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
            aria-label="Help with Guideline Database"
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

        <main className="ccf-guidelines-content">
          <div className="ccf-guidelines-heading">
            <h1>Guideline Database</h1>
            <p>
              View and manage reference guidelines and the policies
              associated with them.
            </p>
          </div>

          <section className="ccf-guidelines-panel">
            <div className="ccf-guidelines-panel-heading">
              <div>
                <h2>All Guidelines</h2>
                <p>
                  Search reference guidelines and view their mapped policies.
                </p>
              </div>

              <span className="ccf-guidelines-count">
                {visibleGuidelines.length}{' '}
                {visibleGuidelines.length === 1
                  ? 'guideline'
                  : 'guidelines'}
              </span>
            </div>

            <div className="ccf-guidelines-controls">
              <input
                type="search"
                className="ccf-guidelines-search"
                aria-label="Search guidelines"
                placeholder="Search guidelines or policies..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              <div className="ccf-guidelines-filters">
                {['All', 'In Review', 'Completed'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={filter === option ? 'selected' : ''}
                    onClick={() => setFilter(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <label className="ccf-guidelines-sort">
                <span>Sort by</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="Most recent">Most recent</option>
                  <option value="Oldest">Oldest</option>
                </select>
              </label>
            </div>

            {deleteError && (
              <div className="ccf-guidelines-error" role="alert">
                {deleteError}
              </div>
            )}

            <div className="ccf-guidelines-table-scroll">
              <table className="ccf-guidelines-table">
                <thead>
                  <tr>
                    <th>Guideline Name</th>
                    <th>Date Created</th>
                    <th>Last Updated</th>
                    <th>Status</th>
                    <th>Associated Policies</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleGuidelines.map((guideline) => {
                    const associatedPolicies = getPoliciesForGuideline(
                      guideline,
                      allPolicies
                    )

                    return (
                      <tr key={guideline.id}>
                        <td>
                          <Link
                            className="ccf-guideline-name"
                            to={`/guidelines/${guideline.id}`}
                          >
                            {guideline.name || 'Untitled Guideline'}
                          </Link>
                          <p className="ccf-guideline-description">
                            {guideline.description || 'Reference guideline'}
                          </p>
                          <button
                            type="button"
                            className="ccf-guideline-delete"
                            aria-label={`Delete ${guideline.name}`}
                            onClick={() => handleDelete(guideline)}
                          >
                            Delete
                          </button>
                        </td>

                        <td>
                          {guideline.created ||
                            guideline.date ||
                            'Recently'}
                        </td>

                        <td>
                          {guideline.updated ||
                            guideline.date ||
                            guideline.created ||
                            'Recently'}
                        </td>

                        <td>
                          <span
                            className={`ccf-guideline-status ${
                              guideline.status === 'Completed'
                                ? 'completed'
                                : 'in-review'
                            }`}
                          >
                            {guideline.status || 'In Review'}
                          </span>
                        </td>

                        <td>
                          {associatedPolicies.length > 0 ? (
                            <div className="ccf-guideline-policy-links">
                              {associatedPolicies.map((policy) => (
                                <Link
                                  key={policy.id}
                                  to={`/policies/${policy.id}`}
                                >
                                  {policy.name || 'Untitled Policy'}
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <span className="ccf-guideline-unmapped">
                              No mapped policies
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}

                  {visibleGuidelines.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="ccf-guidelines-empty"
                      >
                        No guidelines match your search or filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="ccf-guidelines-bottom">
              <span>
                Showing {visibleGuidelines.length} of{' '}
                {allGuidelines.length} guidelines
              </span>

              <Link
                to="/guidelines/new"
                className="ccf-guidelines-primary-button"
              >
                + Upload Guideline
              </Link>
            </div>
          </section>
        </main>
      </div>

      {helpOpen && (
        <div
          className="ccf-guidelines-help-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setHelpOpen(false)
            }
          }}
        >
          <div
            className="ccf-guidelines-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guidelines-help-title"
          >
            <div className="ccf-guidelines-help-heading">
              <h2 id="guidelines-help-title">
                How to Use Guideline Database
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
              The Guideline Database lists reference guidelines
              and their associated insurance policies.
            </p>

            <ol>
              <li>Search for a guideline by name or associated policy.</li>
              <li>Filter guidelines by review status.</li>
              <li>Click a blue policy name to open its details.</li>
              <li>Click a guideline name to open its details.</li>
              <li>Upload a new guideline using the button below the table.</li>
              <li>Delete hides a guideline in this browser and records it in the Audit Log.</li>
              <li>Use Document Mappings to manage guideline associations.</li>
            </ol>

            <p>
              <Link
                to="/mappings"
                onClick={() => setHelpOpen(false)}
              >
                Open Document Mappings
              </Link>
            </p>

            <button
              type="button"
              className="ccf-guidelines-primary-button"
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

export default GuidelinesPage
