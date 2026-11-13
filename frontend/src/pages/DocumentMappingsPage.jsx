import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listGuidelineChanges } from '../api'
import AutomatedMapping from '../components/AutomatedMapping'
import {
  getGuidelinesForPolicy,
  getGuidelinePolicyIds,
  saveGuidelinePolicyIds,
} from '../data/guidelineMappings'
import './DocumentMappingsPage.css'

// ==========================================
// ORIGINAL POLICIES AND GUIDELINES
// ==========================================

const originalPolicies = [
  { id: 1, name: 'Cardiac Coverage Policy' },
  { id: 2, name: 'Diabetes Treatment Policy' },
  { id: 3, name: 'Oncology Coverage Policy' },
  { id: 4, name: 'Orthopedic Surgery Policy' },
  { id: 5, name: 'Mental Health Coverage Policy' },
]

const originalGuidelines = [
  { id: 1, name: 'Cardiac Coverage Guideline' },
  { id: 2, name: 'Diabetes Treatment Guideline' },
  { id: 3, name: 'Oncology Coverage Guideline' },
  { id: 4, name: 'Orthopedic Surgery Guideline' },
  { id: 5, name: 'Mental Health Guideline' },
]

// ==========================================
// HELPERS
// ==========================================

function getSavedArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function recordMappingAudit(action, policy, guideline) {
  const auditEvents = getSavedArray('auditEvents')
  const now = new Date()

  auditEvents.push({
    id: `mapping-${now.getTime()}-${Math.random()
      .toString(36)
      .slice(2, 9)}`,
    timestamp: now.toISOString(),
    user: 'Sarah Chen',
    action,
    category: 'Document Mappings',
    item: policy.name,
    details: `${action}: "${policy.name}" and "${guideline.name}"`,
    policyId: policy.id,
    guidelineId: guideline.id,
  })

  localStorage.setItem('auditEvents', JSON.stringify(auditEvents))
}

// ==========================================
// DOCUMENT MAPPINGS PAGE
// ==========================================

function DocumentMappingsPage() {
  // MANUAL MODE
  const [mappingMode, setMappingMode] = useState('manual')
  const [policySearch, setPolicySearch] = useState('')
  const [guidelineSearch, setGuidelineSearch] = useState('')
  const [policyFilter, setPolicyFilter] = useState('All')
  const [guidelineFilter, setGuidelineFilter] = useState('All')

  const [selectedPolicyId, setSelectedPolicyId] = useState(null)
  const [selectedGuidelineIds, setSelectedGuidelineIds] = useState([])
  const [message, setMessage] = useState('')

  // Forces the page to refresh after mapping changes
  const [, setRevision] = useState(0)

  // Unread guideline-update notifications from the mapping engine
  const [unreadChanges, setUnreadChanges] = useState(0)

  useEffect(() => {
    listGuidelineChanges(true)
      .then((changes) => setUnreadChanges(changes.length))
      .catch(() => setUnreadChanges(0))
  }, [])

  // ==========================================
  // LOAD DOCUMENT DATABASES
  // ==========================================

  const deletedPolicyIds = getSavedArray('deletedPolicyIds')
  const deletedGuidelineIds = getSavedArray('deletedGuidelineIds')

  const policies = [
    ...getSavedArray('addedPolicies'),
    ...originalPolicies,
  ].filter(
    (policy) =>
      !deletedPolicyIds.some(
        (id) => String(id) === String(policy.id)
      )
  )

  const guidelines = [
    ...getSavedArray('addedGuidelines'),
    ...originalGuidelines,
  ].filter(
    (guideline) =>
      !deletedGuidelineIds.some(
        (id) => String(id) === String(guideline.id)
      )
  )

  // ==========================================
  // SELECTED DOCUMENTS
  // ==========================================

  const selectedPolicy = policies.find(
    (policy) => String(policy.id) === String(selectedPolicyId)
  )

  const mappedGuidelines = selectedPolicy
    ? getGuidelinesForPolicy(selectedPolicy, guidelines)
    : []

  const isMapped = (policy, guideline) =>
    getGuidelinePolicyIds(guideline).some(
      (id) => String(id) === String(policy.id)
    )

  // ==========================================
  // MAPPING STATISTICS
  // ==========================================

  const mappingCountForPolicy = (policy) =>
    guidelines.filter((guideline) =>
      isMapped(policy, guideline)
    ).length

  const mappingCountForGuideline = (guideline) =>
    policies.filter((policy) =>
      isMapped(policy, guideline)
    ).length

  const totalMappings = guidelines.reduce(
    (count, guideline) =>
      count + mappingCountForGuideline(guideline),
    0
  )

  const mappedDocuments =
    policies.filter(
      (policy) => mappingCountForPolicy(policy) > 0
    ).length +
    guidelines.filter(
      (guideline) => mappingCountForGuideline(guideline) > 0
    ).length

  const unmappedDocuments =
    policies.length + guidelines.length - mappedDocuments

  // ==========================================
  // MANUAL MODE FILTERS
  // ==========================================

  const visiblePolicies = policies.filter((policy) => {
    const matchesSearch = String(policy.name || '')
      .toLowerCase()
      .includes(policySearch.toLowerCase())

    const count = mappingCountForPolicy(policy)

    return (
      matchesSearch &&
      (policyFilter === 'All' ||
        (policyFilter === 'Mapped' && count > 0) ||
        (policyFilter === 'Unmapped' && count === 0))
    )
  })

  const visibleGuidelines = guidelines.filter((guideline) => {
    const matchesSearch = String(guideline.name || '')
      .toLowerCase()
      .includes(guidelineSearch.toLowerCase())

    const count = mappingCountForGuideline(guideline)

    return (
      matchesSearch &&
      (guidelineFilter === 'All' ||
        (guidelineFilter === 'Mapped' && count > 0) ||
        (guidelineFilter === 'Unmapped' && count === 0))
    )
  })

  // ==========================================
  // MANUAL MODE FUNCTIONS
  // ==========================================

  function selectPolicy(policyId) {
    setSelectedPolicyId(policyId)
    setSelectedGuidelineIds([])
    setMessage('')
  }

  function toggleGuideline(guidelineId) {
    const id = String(guidelineId)

    setSelectedGuidelineIds((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    )

    setMessage('')
  }

  function updateMappings(action) {
    if (!selectedPolicy || selectedGuidelineIds.length === 0) {
      setMessage('Select a policy and at least one guideline.')
      return
    }

    let changed = 0

    guidelines
      .filter((guideline) =>
        selectedGuidelineIds.includes(String(guideline.id))
      )
      .forEach((guideline) => {
        const currentIds =
          getGuidelinePolicyIds(guideline).map(String)

        const policyId = String(selectedPolicy.id)
        const alreadyMapped = currentIds.includes(policyId)

        if (action === 'add' && !alreadyMapped) {
          saveGuidelinePolicyIds(
            guideline.id,
            [...currentIds, policyId]
          )

          recordMappingAudit(
            'Mapping Created',
            selectedPolicy,
            guideline
          )

          changed++
        }

        if (action === 'remove' && alreadyMapped) {
          saveGuidelinePolicyIds(
            guideline.id,
            currentIds.filter((id) => id !== policyId)
          )

          recordMappingAudit(
            'Mapping Removed',
            selectedPolicy,
            guideline
          )

          changed++
        }
      })

    setRevision((previous) => previous + 1)
    setSelectedGuidelineIds([])

    setMessage(
      changed === 0
        ? 'No mappings needed to be changed.'
        : `${changed} mapping${changed === 1 ? '' : 's'} ${
            action === 'add' ? 'created' : 'removed'
          }.`
    )
  }

  function removeSingleMapping(guideline) {
    if (!selectedPolicy) return

    const policyId = String(selectedPolicy.id)
    const currentIds =
      getGuidelinePolicyIds(guideline).map(String)

    if (!currentIds.includes(policyId)) {
      setMessage('This mapping no longer exists.')
      return
    }

    const confirmed = window.confirm(
      `Remove the association between "${selectedPolicy.name}" and "${guideline.name}"?`
    )

    if (!confirmed) return

    saveGuidelinePolicyIds(
      guideline.id,
      currentIds.filter((id) => id !== policyId)
    )

    recordMappingAudit(
      'Mapping Removed',
      selectedPolicy,
      guideline
    )

    setRevision((previous) => previous + 1)
    setMessage('Mapping removed.')
  }

  function clearSelection() {
    setSelectedPolicyId(null)
    setSelectedGuidelineIds([])
    setMessage('')
  }

  // ==========================================
  // PAGE LAYOUT
  // ==========================================

  return (
    <div className="app-page">
      <header className="top-bar">
        <div className="brand-area">
          <span className="brand-name">
            Policy Review
          </span>

          <span className="brand-divider" />

          <span className="workspace-name">
            Policy Review Workspace
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

          <Link to="/reviews" className="nav-item">
            Review Sessions
          </Link>

          <Link to="/policies" className="nav-item">
            Policy Database
          </Link>

          <Link to="/guidelines" className="nav-item">
            Guideline Database
          </Link>

          <Link to="/mappings" className="nav-item active">
            Document Mappings
          </Link>

          <Link to="/audit-log" className="nav-item">
            Audit Log
          </Link>
        </aside>

        {/* MAIN CONTENT */}

        <main className="mapping-content">
          <div className="mapping-heading">
            <h1>Document Mappings</h1>
            <p>
              Manage associations between internal policies
              and external guidelines.
            </p>
          </div>

          {/* MODE SWITCH */}

          <div className="mapping-mode-switch">
            <button
              type="button"
              className={mappingMode === 'manual' ? 'selected' : ''}
              onClick={() => setMappingMode('manual')}
            >
              Manual Mapping
            </button>

            <button
              type="button"
              className={mappingMode === 'dynamic' ? 'selected' : ''}
              onClick={() => setMappingMode('dynamic')}
            >
              Dynamic Mapping
            </button>

            <Link to="/mappings/automation" className="mapping-automation-link">
              Mapping Automation
              {unreadChanges > 0 && (
                <span className="auto-badge unread" style={{ marginLeft: 8 }}>
                  {unreadChanges} update{unreadChanges === 1 ? '' : 's'}
                </span>
              )}
            </Link>
          </div>

          {/* ==================================
              MANUAL MAPPING MODE
          ================================== */}

          {mappingMode === 'manual' && (
            <>
              {/* SUMMARY COUNTS */}

              <div className="mapping-stats">
                <div className="mapping-stat">
                  <span>Total Mappings</span>
                  <strong>{totalMappings}</strong>
                </div>

                <div className="mapping-stat">
                  <span>Mapped Documents</span>
                  <strong>{mappedDocuments}</strong>
                </div>

                <div className="mapping-stat">
                  <span>Unmapped Documents</span>
                  <strong>{unmappedDocuments}</strong>
                </div>
              </div>

              {/* DOCUMENT LISTS */}

              <div className="mapping-columns">
                {/* POLICIES */}

                <section className="mapping-panel">
                  <h2>Internal Policies</h2>

                  <input
                    className="mapping-search"
                    type="text"
                    placeholder="Search policies..."
                    value={policySearch}
                    onChange={(event) =>
                      setPolicySearch(event.target.value)
                    }
                  />

                  <div className="mapping-filters">
                    {['All', 'Mapped', 'Unmapped'].map(
                      (option) => (
                        <button
                          key={option}
                          type="button"
                          className={
                            policyFilter === option
                              ? 'selected'
                              : ''
                          }
                          onClick={() =>
                            setPolicyFilter(option)
                          }
                        >
                          {option}
                        </button>
                      )
                    )}
                  </div>

                  <div className="mapping-list">
                    {visiblePolicies.map((policy) => {
                      const count =
                        mappingCountForPolicy(policy)

                      const selected =
                        String(selectedPolicyId) ===
                        String(policy.id)

                      return (
                        <button
                          key={policy.id}
                          type="button"
                          className={`mapping-document ${
                            selected ? 'selected' : ''
                          }`}
                          onClick={() =>
                            selectPolicy(policy.id)
                          }
                        >
                          <strong>{policy.name}</strong>

                          <small>
                            Policy ID: {policy.id}
                          </small>

                          <span
                            className={
                              count ? 'mapped' : 'unmapped'
                            }
                          >
                            {count
                              ? `${count} mapped`
                              : 'Unmapped'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>

                {/* GUIDELINES */}

                <section className="mapping-panel">
                  <h2>External Guidelines</h2>

                  <input
                    className="mapping-search"
                    type="text"
                    placeholder="Search guidelines..."
                    value={guidelineSearch}
                    onChange={(event) =>
                      setGuidelineSearch(event.target.value)
                    }
                  />

                  <div className="mapping-filters">
                    {['All', 'Mapped', 'Unmapped'].map(
                      (option) => (
                        <button
                          key={option}
                          type="button"
                          className={
                            guidelineFilter === option
                              ? 'selected'
                              : ''
                          }
                          onClick={() =>
                            setGuidelineFilter(option)
                          }
                        >
                          {option}
                        </button>
                      )
                    )}
                  </div>

                  <div className="mapping-list">
                    {visibleGuidelines.map((guideline) => {
                      const count =
                        mappingCountForGuideline(guideline)

                      const checked =
                        selectedGuidelineIds.includes(
                          String(guideline.id)
                        )

                      const linked =
                        selectedPolicy &&
                        isMapped(selectedPolicy, guideline)

                      return (
                        <label
                          key={guideline.id}
                          className={`mapping-document ${
                            checked ? 'selected' : ''
                          }`}
                        >
                          <div className="mapping-checkbox-row">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleGuideline(guideline.id)
                              }
                            />

                            <strong>
                              {guideline.name}
                            </strong>
                          </div>

                          <small>
                            Guideline ID: {guideline.id}
                          </small>

                          <span
                            className={
                              count ? 'mapped' : 'unmapped'
                            }
                          >
                            {count
                              ? `${count} mapped`
                              : 'Unmapped'}
                          </span>

                          {linked && (
                            <em>
                              Linked to selected policy
                            </em>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </section>
              </div>

              {/* MAPPING ACTIONS */}

              <section className="mapping-actions">
                <h2>Mapping Actions</h2>

                <p>
                  Selected policy:{' '}
                  <strong>
                    {selectedPolicy?.name || 'None'}
                  </strong>
                  {' | '}
                  Selected guidelines:{' '}
                  <strong>
                    {selectedGuidelineIds.length}
                  </strong>
                </p>

                <div className="mapping-action-buttons">
                  <button
                    type="button"
                    onClick={() => updateMappings('add')}
                  >
                    Create Mapping
                  </button>

                  <button
                    type="button"
                    onClick={() => updateMappings('remove')}
                  >
                    Remove Mapping
                  </button>

                  <button
                    type="button"
                    onClick={clearSelection}
                  >
                    Clear Selection
                  </button>
                </div>

                {message && (
                  <p
                    role="status"
                    className="mapping-message"
                  >
                    {message}
                  </p>
                )}
              </section>

              {/* ASSOCIATION INSPECTOR */}

              <section className="mapping-inspector">
                <h2>Association Inspector</h2>

                {!selectedPolicy ? (
                  <p>
                    Select a policy to view its associated
                    guidelines.
                  </p>
                ) : (
                  <>
                    <h3>{selectedPolicy.name}</h3>

                    {mappedGuidelines.length === 0 ? (
                      <p>
                        No guidelines currently mapped to
                        this policy.
                      </p>
                    ) : (
                      <div className="mapping-inspector-list">
                        {mappedGuidelines.map((guideline) => (
                          <div
                            key={guideline.id}
                            className="mapping-inspector-item"
                          >
                            <span>
                              {guideline.name}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                removeSingleMapping(guideline)
                              }
                            >
                              Unlink
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            </>
          )}

          {/* ==================================
              DYNAMIC MAPPING MODE (mapping engine)
          ================================== */}

          {mappingMode === 'dynamic' && (
            <AutomatedMapping
              policies={policies}
              onMapped={() => setRevision((previous) => previous + 1)}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default DocumentMappingsPage
