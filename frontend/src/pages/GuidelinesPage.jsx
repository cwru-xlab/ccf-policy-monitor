
import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
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
  { label: 'Home', path: '/dashboard' },
  { label: 'Policy Database', path: '/policies' },
  { label: 'Document Mappings', path: '/mappings' },
  { label: 'Guideline Database', path: '/guidelines' },
  { label: 'Review Sessions', path: '/reviews' },
  { label: 'Audit Log', path: '/audit-log' },
]

function GuidelinesPage() {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('Most recent')
  const [helpOpen, setHelpOpen] = useState(false)
  const [showNextStep, setShowNextStep] = useState(true)

  const [deletedGuidelineIds, setDeletedGuidelineIds] = useState(() =>
    getSavedArray('deletedGuidelineIds')
  )

  const [deleteError, setDeleteError] = useState('')

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

      return searchText.includes(search.trim().toLowerCase())
    })
    .sort((a, b) => {
      const firstDate =
        new Date(
          a.createdAt || a.created || a.date || 0
        ).getTime() || 0

      const secondDate =
        new Date(
          b.createdAt || b.created || b.date || 0
        ).getTime() || 0

      return sort === 'Oldest'
        ? firstDate - secondDate
        : secondDate - firstDate
    })

  return (
    <div className="app-page ccf-dashboard ccf-guidelines-page">
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

        {/* MAIN CONTENT */}
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
                  Search reference guidelines and view their
                  mapped policies.
                </p>
              </div>

              <span className="ccf-guidelines-count">
                {visibleGuidelines.length}{' '}
                {visibleGuidelines.length === 1
                  ? 'guideline'
                  : 'guidelines'}
              </span>
            </div>

            {/* SEARCH AND SORT */}
            <div className="ccf-guidelines-controls">
              <input
                type="search"
                className="ccf-guidelines-search"
                aria-label="Search guidelines"
                placeholder="Search guidelines or policies..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

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

            {/* DELETE ERROR */}
            {deleteError && (
              <div className="ccf-guidelines-error" role="alert">
                {deleteError}
              </div>
            )}

            {/* GUIDELINE TABLE */}
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
                    const associatedPolicies =
                      getPoliciesForGuideline(
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
                            {guideline.description ||
                              'Reference guideline'}
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
                            {guideline.status || 'Not assigned'}
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
                        No guidelines match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* UPLOAD GUIDELINE */}
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
                  Would you like to go to Review Sessions
                  to create or continue an insurance policy review?
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="ccf-guidelines-primary-button"
                  onClick={() => navigate('/reviews')}
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

      {/* HELP WINDOW */}
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
              <li>
                Search for a guideline by name or associated policy.
              </li>
              <li>
                Use the sort menu to change the guideline order.
              </li>
              <li>
                Click a blue policy name to open its details.
              </li>
              <li>
                Click a guideline name to open its details.
              </li>
              <li>
                Upload a new guideline using the button below
                the table.
              </li>
              <li>
                Delete hides a guideline in this browser and
                records it in the Audit Log.
              </li>
              <li>
                Use Document Mappings to manage guideline
                associations.
              </li>
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
