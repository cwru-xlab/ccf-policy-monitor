
import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { listGuidelineChanges } from '../api'
import AutomatedMapping from '../components/AutomatedMapping'
import {
  getGuidelinesForPolicy,
  getGuidelinePolicyIds,
  saveGuidelinePolicyIds,
} from '../data/guidelineMappings'
import './DashboardPage.css'
import './DocumentMappingsPage.css'

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

const navigation = [
  { label: 'Home', path: '/dashboard' },
  { label: 'Policy Database', path: '/policies' },
  { label: 'Document Mappings', path: '/mappings' },
  { label: 'Guideline Database', path: '/guidelines' },
  { label: 'Review Sessions', path: '/reviews' },
  { label: 'Audit Log', path: '/audit-log' },
]

function getSavedArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function recordMappingAudit(action, policy, guideline) {
  const events = getSavedArray('auditEvents')
  const now = new Date()

  events.push({
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

  localStorage.setItem('auditEvents', JSON.stringify(events))
}

function DocumentMappingsPage() {
  const navigate = useNavigate()

  const [showNextStep, setShowNextStep] = useState(true)
  const [mappingMode, setMappingMode] = useState('manual')
  const [helpOpen, setHelpOpen] = useState(false)

  // Manual Mapping
  const [policySearch, setPolicySearch] = useState('')
  const [guidelineSearch, setGuidelineSearch] = useState('')
  const [policyFilter, setPolicyFilter] = useState('All')
  const [guidelineFilter, setGuidelineFilter] = useState('All')
  const [selectedPolicyId, setSelectedPolicyId] = useState(null)
  const [selectedGuidelineIds, setSelectedGuidelineIds] = useState([])
  const [message, setMessage] = useState('')

  // Refresh mapping counts after changes
  const [, setRevision] = useState(0)

  const [unreadChanges, setUnreadChanges] = useState(0)

  useEffect(() => {
    listGuidelineChanges(true)
      .then((changes) => setUnreadChanges(changes.length))
      .catch(() => setUnreadChanges(0))
  }, [])

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

  // Load policies and guidelines
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

  const selectedPolicy = policies.find(
    (policy) => String(policy.id) === String(selectedPolicyId)
  )

  const mappedGuidelines = selectedPolicy
    ? getGuidelinesForPolicy(selectedPolicy, guidelines)
    : []

  function isMapped(policy, guideline) {
    return getGuidelinePolicyIds(guideline).some(
      (id) => String(id) === String(policy.id)
    )
  }

  function mappingCountForPolicy(policy) {
    return guidelines.filter((guideline) =>
      isMapped(policy, guideline)
    ).length
  }

  function mappingCountForGuideline(guideline) {
    return policies.filter((policy) =>
      isMapped(policy, guideline)
    ).length
  }

  const totalMappings = guidelines.reduce(
    (total, guideline) =>
      total + mappingCountForGuideline(guideline),
    0
  )

  const mappedDocuments =
    policies.filter((policy) => mappingCountForPolicy(policy) > 0)
      .length +
    guidelines.filter(
      (guideline) => mappingCountForGuideline(guideline) > 0
    ).length

  const unmappedDocuments =
    policies.length + guidelines.length - mappedDocuments

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

  // Manual Mapping functions
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
        const currentIds = getGuidelinePolicyIds(guideline).map(String)
        const policyId = String(selectedPolicy.id)
        const alreadyMapped = currentIds.includes(policyId)

        if (action === 'add' && !alreadyMapped) {
          saveGuidelinePolicyIds(guideline.id, [
            ...currentIds,
            policyId,
          ])

          recordMappingAudit(
            'Mapping Created',
            selectedPolicy,
            guideline
          )

          changed += 1
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

          changed += 1
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
    const currentIds = getGuidelinePolicyIds(guideline).map(String)

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

  return (
    <div className="app-page ccf-dashboard ccf-mappings-page">
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
            aria-label="Help with document mappings"
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
        <main className="ccf-mappings-content">
          <div className="ccf-mappings-heading">
            <h1>Document Mappings</h1>
            <p>
              Manage associations between internal policies
              and external reference guidelines.
            </p>
          </div>

          <div className="ccf-mappings-mode-switch">
            <button
              type="button"
              className={
                mappingMode === 'manual' ? 'selected' : ''
              }
              onClick={() => setMappingMode('manual')}
            >
              Manual Mapping
            </button>

            <button
              type="button"
              className={
                mappingMode === 'dynamic' ? 'selected' : ''
              }
              onClick={() => setMappingMode('dynamic')}
            >
              Dynamic Mapping
            </button>

            <Link
              to="/mappings/automation"
              className="ccf-mappings-automation-link"
            >
              Mapping Automation
              {unreadChanges > 0 && (
                <span className="auto-badge unread">
                  {unreadChanges} update{unreadChanges === 1 ? '' : 's'}
                </span>
              )}
            </Link>
          </div>

          {/* MANUAL MAPPING */}
          {mappingMode === 'manual' && (
            <div className="ccf-mappings-workspace">
              <div className="ccf-mappings-stats">
                <div className="ccf-mappings-stat">
                  <span>Total Mappings</span>
                  <strong>{totalMappings}</strong>
                </div>

                <div className="ccf-mappings-stat">
                  <span>Mapped Documents</span>
                  <strong>{mappedDocuments}</strong>
                </div>

                <div className="ccf-mappings-stat">
                  <span>Unmapped Documents</span>
                  <strong>{unmappedDocuments}</strong>
                </div>
              </div>

              <div className="ccf-mappings-columns">
                {/* POLICY LIST */}
                <section className="ccf-mappings-panel">
                  <div className="ccf-mappings-panel-heading">
                    <h2>Internal Policies</h2>
                    <span>{policies.length} policies</span>
                  </div>

                  <input
                    className="ccf-mappings-search"
                    type="search"
                    placeholder="Search policies..."
                    aria-label="Search policies"
                    value={policySearch}
                    onChange={(event) =>
                      setPolicySearch(event.target.value)
                    }
                  />

                  <div className="ccf-mappings-filters">
                    {['All', 'Mapped', 'Unmapped'].map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={
                          policyFilter === option ? 'selected' : ''
                        }
                        onClick={() => setPolicyFilter(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>

                  <div className="ccf-mappings-list">
                    {visiblePolicies.map((policy) => {
                      const count = mappingCountForPolicy(policy)
                      const selected =
                        String(selectedPolicyId) === String(policy.id)

                      return (
                        <button
                          key={policy.id}
                          type="button"
                          className={`ccf-mappings-document ${
                            selected ? 'selected' : ''
                          }`}
                          onClick={() => selectPolicy(policy.id)}
                        >
                          <strong>{policy.name}</strong>
                          <small>Policy ID: {policy.id}</small>

                          <span
                            className={`ccf-mappings-tag ${
                              count > 0 ? 'mapped' : 'unmapped'
                            }`}
                          >
                            {count > 0
                              ? `${count} mapped`
                              : 'Unmapped'}
                          </span>
                        </button>
                      )
                    })}

                    {visiblePolicies.length === 0 && (
                      <p className="ccf-mappings-empty">
                        No policies found.
                      </p>
                    )}
                  </div>
                </section>

                {/* GUIDELINE LIST */}
                <section className="ccf-mappings-panel">
                  <div className="ccf-mappings-panel-heading">
                    <h2>External Guidelines</h2>
                    <span>{guidelines.length} guidelines</span>
                  </div>

                  <input
                    className="ccf-mappings-search"
                    type="search"
                    placeholder="Search guidelines..."
                    aria-label="Search guidelines"
                    value={guidelineSearch}
                    onChange={(event) =>
                      setGuidelineSearch(event.target.value)
                    }
                  />

                  <div className="ccf-mappings-filters">
                    {['All', 'Mapped', 'Unmapped'].map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={
                          guidelineFilter === option ? 'selected' : ''
                        }
                        onClick={() => setGuidelineFilter(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>

                  <div className="ccf-mappings-list">
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
                          className={`ccf-mappings-document ${
                            checked ? 'selected' : ''
                          }`}
                        >
                          <span className="ccf-mappings-checkbox-row">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleGuideline(guideline.id)
                              }
                            />
                            <strong>{guideline.name}</strong>
                          </span>

                          <small>
                            Guideline ID: {guideline.id}
                          </small>

                          <span
                            className={`ccf-mappings-tag ${
                              count > 0 ? 'mapped' : 'unmapped'
                            }`}
                          >
                            {count > 0
                              ? `${count} mapped`
                              : 'Unmapped'}
                          </span>

                          {linked && (
                            <em className="ccf-mappings-linked">
                              Linked to selected policy
                            </em>
                          )}
                        </label>
                      )
                    })}

                    {visibleGuidelines.length === 0 && (
                      <p className="ccf-mappings-empty">
                        No guidelines found.
                      </p>
                    )}
                  </div>
                </section>
              </div>

              {/* MAPPING ACTIONS */}
              <section className="ccf-mappings-panel ccf-mappings-actions">
                <h2>Mapping Actions</h2>
                <p>
                  Selected policy:{' '}
                  <strong>
                    {selectedPolicy?.name || 'None'}
                  </strong>
                  {' · '}
                  Selected guidelines:{' '}
                  <strong>{selectedGuidelineIds.length}</strong>
                </p>

                <div className="ccf-mappings-action-buttons">
                  <button
                    type="button"
                    className="ccf-mappings-primary-button"
                    onClick={() => updateMappings('add')}
                  >
                    Create Mapping
                  </button>

                  <button
                    type="button"
                    className="ccf-mappings-danger-button"
                    onClick={() => updateMappings('remove')}
                  >
                    Remove Mapping
                  </button>

                  <button
                    type="button"
                    className="ccf-mappings-secondary-button"
                    onClick={clearSelection}
                  >
                    Clear Selection
                  </button>
                </div>

                {message && (
                  <p
                    role="status"
                    className="ccf-mappings-message"
                  >
                    {message}
                  </p>
                )}
              </section>

              {/* ASSOCIATION INSPECTOR */}
              <section className="ccf-mappings-panel ccf-mappings-inspector">
                <h2>Association Inspector</h2>

                {!selectedPolicy ? (
                  <p className="ccf-mappings-muted">
                    Select a policy to view its associated guidelines.
                  </p>
                ) : (
                  <>
                    <h3>
                      <Link to={`/policies/${selectedPolicy.id}`}>
                        {selectedPolicy.name}
                      </Link>
                    </h3>

                    {mappedGuidelines.length === 0 ? (
                      <p className="ccf-mappings-muted">
                        No guidelines currently mapped to this policy.
                      </p>
                    ) : (
                      <div className="ccf-mappings-inspector-list">
                        {mappedGuidelines.map((guideline) => (
                          <div
                            key={guideline.id}
                            className="ccf-mappings-inspector-item"
                          >
                            <span>{guideline.name}</span>

                            <button
                              type="button"
                              className="ccf-mappings-danger-button"
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
            </div>
          )}

          {/* DYNAMIC MAPPING */}
          {mappingMode === 'dynamic' && (
            <AutomatedMapping
              policies={policies}
              onMapped={() =>
                setRevision((previous) => previous + 1)
              }
            />
          )}

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
                  Would you like to go to Guideline Database
                  to view or manage clinical guidelines?
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="ccf-mappings-primary-button"
                  onClick={() => navigate('/guidelines')}
                >
                  Yes
                </button>

                <button
                  type="button"
                  className="ccf-mappings-secondary-button"
                  onClick={() => setShowNextStep(false)}
                >
                  No
                </button>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* HELP DIALOG */}
      {helpOpen && (
        <div
          className="ccf-mappings-help-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setHelpOpen(false)
            }
          }}
        >
          <div
            className="ccf-mappings-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mappings-help-title"
          >
            <div className="ccf-mappings-help-heading">
              <h2 id="mappings-help-title">
                Document Mappings Help
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
              <strong>Manual Mapping:</strong> Select an internal
              policy and one or more guidelines. Create or
              remove their associations.
            </p>

            <p>
              <strong>Dynamic Mapping:</strong> Select a policy and use
              the available mapping tool to review proposed guideline
              associations. Available capabilities depend on the
              connected mapping service.
            </p>

            <p>
              <strong>Mapping Automation:</strong> Set the schedule,
              review guideline updates, and manage tracked sources.
            </p>

            <p>
              Mapping changes are saved in your browser and
              recorded in the Audit Log.
            </p>

            <button
              type="button"
              className="ccf-mappings-primary-button"
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

export default DocumentMappingsPage
