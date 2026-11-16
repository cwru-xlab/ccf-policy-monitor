
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
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
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Review Sessions', path: '/reviews' },
  { label: 'Policy Database', path: '/policies' },
  { label: 'Guideline Database', path: '/guidelines' },
  { label: 'Document Mappings', path: '/mappings' },
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

  // Dynamic Mapping
  const [dynamicStep, setDynamicStep] = useState(1)
  const [dynamicPolicyId, setDynamicPolicyId] = useState(null)
  const [dynamicPolicySearch, setDynamicPolicySearch] = useState('')
  const [dynamicGuidelineSearch, setDynamicGuidelineSearch] = useState('')
  const [dynamicSelectedIds, setDynamicSelectedIds] = useState([])
  const [dynamicResults, setDynamicResults] = useState([])
  const [dynamicMessage, setDynamicMessage] = useState('')
  const [previewGuideline, setPreviewGuideline] = useState(null)

  // Refresh mapping counts after changes
  const [, setRevision] = useState(0)

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

  const dynamicPolicy = policies.find(
    (policy) => String(policy.id) === String(dynamicPolicyId)
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

  // Dynamic Mapping functions
  function chooseDynamicPolicy(policyId) {
    setDynamicPolicyId(policyId)
    setDynamicResults([])
    setDynamicSelectedIds([])
    setDynamicGuidelineSearch('')
    setDynamicMessage('')
    setPreviewGuideline(null)
    setDynamicStep(3)
  }

  function startGuidelineSearch() {
    if (!dynamicPolicy) return

    // Prototype: search existing guidelines, not external sources
    setDynamicResults([...guidelines])
    setDynamicSelectedIds([])
    setDynamicMessage('')
    setDynamicGuidelineSearch('')
    setPreviewGuideline(null)
    setDynamicStep(4)
  }

  function toggleDynamicGuideline(guidelineId) {
    const id = String(guidelineId)

    setDynamicSelectedIds((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    )
  }

  function saveDynamicMappings() {
    if (!dynamicPolicy || dynamicSelectedIds.length === 0) {
      setDynamicMessage('Select at least one guideline.')
      return
    }

    let created = 0
    let alreadyMapped = 0

    dynamicResults
      .filter((guideline) =>
        dynamicSelectedIds.includes(String(guideline.id))
      )
      .forEach((guideline) => {
        const currentIds = getGuidelinePolicyIds(guideline).map(String)
        const policyId = String(dynamicPolicy.id)

        if (currentIds.includes(policyId)) {
          alreadyMapped += 1
          return
        }

        saveGuidelinePolicyIds(guideline.id, [
          ...currentIds,
          policyId,
        ])

        recordMappingAudit(
          'Mapping Created',
          dynamicPolicy,
          guideline
        )

        created += 1
      })

    setRevision((previous) => previous + 1)

    setDynamicMessage(
      `${created} new mapping${created === 1 ? '' : 's'} created.` +
        (alreadyMapped > 0
          ? ` ${alreadyMapped} already existed.`
          : '')
    )

    setDynamicStep(5)
  }

  function resetDynamicMapping() {
    setDynamicStep(1)
    setDynamicPolicyId(null)
    setDynamicPolicySearch('')
    setDynamicGuidelineSearch('')
    setDynamicSelectedIds([])
    setDynamicResults([])
    setDynamicMessage('')
    setPreviewGuideline(null)
  }

  const dynamicVisiblePolicies = policies.filter((policy) =>
    String(policy.name || '')
      .toLowerCase()
      .includes(dynamicPolicySearch.toLowerCase())
  )

  const dynamicVisibleGuidelines = dynamicResults.filter(
    (guideline) =>
      String(guideline.name || '')
        .toLowerCase()
        .includes(dynamicGuidelineSearch.toLowerCase())
  )

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
            <section className="ccf-mappings-panel ccf-mappings-dynamic">
              <div className="ccf-mappings-dynamic-header">
                <div>
                  <h2>Dynamic Document Mapping</h2>
                  <p>
                    Select a policy, review guidelines, and
                    create associations.
                  </p>
                </div>
                <span>Step {dynamicStep} of 5</span>
              </div>

              <div className="ccf-mappings-progress">
                {[1, 2, 3, 4, 5].map((step) => (
                  <span
                    key={step}
                    className={
                      step <= dynamicStep ? 'active' : ''
                    }
                  />
                ))}
              </div>

              {/* STEP 1 */}
              {dynamicStep === 1 && (
                <div className="ccf-mappings-dynamic-intro">
                  <h3>Start a New Mapping</h3>
                  <p>
                    Choose an internal policy and review guidelines
                    available in your Guideline Database.
                  </p>

                  <p className="ccf-mappings-muted">
                    This prototype uses existing guidelines.
                    External guideline discovery is not connected yet.
                  </p>

                  <button
                    type="button"
                    className="ccf-mappings-primary-button"
                    onClick={() => setDynamicStep(2)}
                  >
                    Select a Policy
                  </button>
                </div>
              )}

              {/* STEP 2 */}
              {dynamicStep === 2 && (
                <div className="ccf-mappings-step">
                  <h3>Select a Policy</h3>
                  <p className="ccf-mappings-muted">
                    Choose a policy from your Policy Database.
                  </p>

                  <input
                    type="search"
                    className="ccf-mappings-search"
                    placeholder="Search policy database..."
                    aria-label="Search policy database"
                    value={dynamicPolicySearch}
                    onChange={(event) =>
                      setDynamicPolicySearch(event.target.value)
                    }
                  />

                  <div className="ccf-mappings-choice-list">
                    {dynamicVisiblePolicies.map((policy) => (
                      <button
                        key={policy.id}
                        type="button"
                        className="ccf-mappings-choice"
                        onClick={() =>
                          chooseDynamicPolicy(policy.id)
                        }
                      >
                        <strong>{policy.name}</strong>
                        <small>Policy ID: {policy.id}</small>
                      </button>
                    ))}

                    {dynamicVisiblePolicies.length === 0 && (
                      <p>No policies found.</p>
                    )}
                  </div>

                  <div className="ccf-mappings-step-actions">
                    <button
                      type="button"
                      className="ccf-mappings-secondary-button"
                      onClick={() => setDynamicStep(1)}
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {dynamicStep === 3 && (
                <div className="ccf-mappings-step">
                  <h3>Selected Policy</h3>

                  <div className="ccf-mappings-selected-policy">
                    <strong>{dynamicPolicy?.name}</strong>
                    <small>
                      Policy ID: {dynamicPolicy?.id}
                    </small>
                  </div>

                  <p>
                    Start the guideline search for this policy.
                  </p>

                  <p className="ccf-mappings-muted">
                    This search returns records already in the
                    Guideline Database. A backend search can be
                    connected later.
                  </p>

                  <div className="ccf-mappings-step-actions">
                    <button
                      type="button"
                      className="ccf-mappings-secondary-button"
                      onClick={() => setDynamicStep(2)}
                    >
                      Back
                    </button>

                    <button
                      type="button"
                      className="ccf-mappings-primary-button"
                      onClick={startGuidelineSearch}
                    >
                      Start Guideline Search
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4 */}
              {dynamicStep === 4 && (
                <div className="ccf-mappings-step">
                  <h3>Guidelines Found</h3>
                  <p>
                    Select guidelines to map to{' '}
                    <strong>{dynamicPolicy?.name}</strong>.
                  </p>

                  <p className="ccf-mappings-muted">
                    Showing existing Guideline Database records,
                    not external search results.
                  </p>

                  <input
                    type="search"
                    className="ccf-mappings-search"
                    placeholder="Search results by guideline name..."
                    aria-label="Search guideline results"
                    value={dynamicGuidelineSearch}
                    onChange={(event) =>
                      setDynamicGuidelineSearch(event.target.value)
                    }
                  />

                  <div className="ccf-mappings-choice-list">
                    {dynamicVisibleGuidelines.map((guideline) => {
                      const checked =
                        dynamicSelectedIds.includes(
                          String(guideline.id)
                        )

                      const linked =
                        dynamicPolicy &&
                        isMapped(dynamicPolicy, guideline)

                      return (
                        <div
                          key={guideline.id}
                          className={`ccf-mappings-result ${
                            checked ? 'selected' : ''
                          }`}
                        >
                          <label>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleDynamicGuideline(guideline.id)
                              }
                            />

                            <span>
                              <strong>{guideline.name}</strong>
                              {linked && (
                                <small>
                                  Already mapped to this policy
                                </small>
                              )}
                            </span>
                          </label>

                          <button
                            type="button"
                            className="ccf-mappings-secondary-button"
                            onClick={() =>
                              setPreviewGuideline(guideline)
                            }
                          >
                            View Details
                          </button>
                        </div>
                      )
                    })}

                    {dynamicVisibleGuidelines.length === 0 && (
                      <p className="ccf-mappings-empty">
                        No guidelines found.
                      </p>
                    )}
                  </div>

                  {previewGuideline && (
                    <div className="ccf-mappings-preview">
                      <div className="ccf-mappings-preview-heading">
                        <h4>Guideline Details</h4>

                        <button
                          type="button"
                          className="ccf-mappings-secondary-button"
                          onClick={() =>
                            setPreviewGuideline(null)
                          }
                        >
                          Close
                        </button>
                      </div>

                      <strong>{previewGuideline.name}</strong>

                      <p>
                        Guideline ID: {previewGuideline.id}
                      </p>

                      {previewGuideline.description && (
                        <p>{previewGuideline.description}</p>
                      )}

                      {previewGuideline.url &&
                      /^https?:\/\//i.test(
                        previewGuideline.url
                      ) ? (
                        <a
                          href={previewGuideline.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open Guideline Document
                        </a>
                      ) : (
                        <p className="ccf-mappings-muted">
                          No external document link is available
                          for this guideline.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="ccf-mappings-step-actions">
                    <button
                      type="button"
                      className="ccf-mappings-secondary-button"
                      onClick={() => {
                        setPreviewGuideline(null)
                        setDynamicStep(3)
                      }}
                    >
                      Back
                    </button>

                    <button
                      type="button"
                      className="ccf-mappings-primary-button"
                      disabled={
                        dynamicSelectedIds.length === 0
                      }
                      onClick={saveDynamicMappings}
                    >
                      Map to Policy ({dynamicSelectedIds.length})
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5 */}
              {dynamicStep === 5 && (
                <div className="ccf-mappings-dynamic-intro">
                  <div className="ccf-mappings-success-icon">
                    ✓
                  </div>

                  <h3>Mapping Review Complete</h3>

                  <p role="status">{dynamicMessage}</p>

                  <p>
                    Your selected guidelines have been reviewed
                    for association with{' '}
                    <strong>{dynamicPolicy?.name}</strong>.
                  </p>

                  <p className="ccf-mappings-muted">
                    These guidelines were already in the
                    Guideline Database. No external documents
                    were imported.
                  </p>

                  <button
                    type="button"
                    className="ccf-mappings-primary-button"
                    onClick={resetDynamicMapping}
                  >
                    Start Another Mapping
                  </button>
                </div>
              )}
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
              <strong>Dynamic Mapping:</strong> Select a policy,
              search existing guidelines, review details, and
              confirm your selections.
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
