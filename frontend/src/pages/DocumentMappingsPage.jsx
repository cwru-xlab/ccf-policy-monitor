
import { useState } from 'react'
import { NavLink } from 'react-router-dom'

import {
  getGuidelinesForPolicy,
  getGuidelinePolicyIds,
  saveGuidelinePolicyIds,
} from '../data/guidelineMappings'

import './DashboardPage.css'
import './DocumentMappingsPage.css'

const navigation = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Review Sessions', path: '/reviews' },
  { label: 'Policy Database', path: '/policies' },
  { label: 'Guideline Database', path: '/guidelines' },
  { label: 'Document Mappings', path: '/mappings' },
  { label: 'Audit Log', path: '/audit-log' },
]

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
    id: `mapping-${now.getTime()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: now.toISOString(),
    user: 'Sarah Chen',
    action,
    category: 'Document Mappings',
    item: policy.name,
    details: `${action}: "${policy.name}" and "${guideline.name}"`,
    policyId: policy.id,
    guidelineId: guideline.id,
  })

  localStorage.setItem(
    'auditEvents',
    JSON.stringify(auditEvents)
  )
}

function DocumentMappingsPage() {
  // =========================================
  // GENERAL STATE
  // =========================================

  const [mappingMode, setMappingMode] = useState('manual')
  const [helpOpen, setHelpOpen] = useState(false)
  const [, setRevision] = useState(0)

  // =========================================
  // MANUAL MAPPING STATE
  // =========================================

  const [policySearch, setPolicySearch] = useState('')
  const [guidelineSearch, setGuidelineSearch] = useState('')

  const [policyFilter, setPolicyFilter] = useState('All')
  const [guidelineFilter, setGuidelineFilter] = useState('All')

  const [selectedPolicyId, setSelectedPolicyId] = useState(null)
  const [selectedGuidelineIds, setSelectedGuidelineIds] = useState([])

  const [message, setMessage] = useState('')

  // =========================================
  // DYNAMIC MAPPING STATE
  // =========================================

  const [dynamicStep, setDynamicStep] = useState(1)
  const [dynamicPolicyId, setDynamicPolicyId] = useState(null)

  const [dynamicPolicySearch, setDynamicPolicySearch] = useState('')
  const [dynamicGuidelineSearch, setDynamicGuidelineSearch] = useState('')

  const [dynamicGuidelineFilter, setDynamicGuidelineFilter] = useState('All')
  const [dynamicSelectedIds, setDynamicSelectedIds] = useState([])

  const [dynamicMessage, setDynamicMessage] = useState('')
  const [previewGuideline, setPreviewGuideline] = useState(null)

  // =========================================
  // LOAD POLICIES AND GUIDELINES
  // =========================================

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

  // =========================================
  // SHARED MAPPING HELPERS
  // =========================================

  const isMapped = (policy, guideline) =>
    getGuidelinePolicyIds(guideline).some(
      (id) => String(id) === String(policy.id)
    )

  const mappingCountForPolicy = (policy) =>
    guidelines.filter(
      (guideline) => isMapped(policy, guideline)
    ).length

  const mappingCountForGuideline = (guideline) =>
    policies.filter(
      (policy) => isMapped(policy, guideline)
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

  const mappedGuidelines = selectedPolicy
    ? getGuidelinesForPolicy(selectedPolicy, guidelines)
    : []

  // =========================================
  // MANUAL MAPPING FILTERS
  // =========================================

  const visiblePolicies = policies.filter((policy) => {
    const count = mappingCountForPolicy(policy)

    const matchesSearch = String(policy.name || '')
      .toLowerCase()
      .includes(policySearch.toLowerCase())

    const matchesFilter =
      policyFilter === 'All' ||
      (policyFilter === 'Mapped' && count > 0) ||
      (policyFilter === 'Unmapped' && count === 0)

    return matchesSearch && matchesFilter
  })

  const visibleGuidelines = guidelines.filter((guideline) => {
    const count = mappingCountForGuideline(guideline)

    const matchesSearch = String(guideline.name || '')
      .toLowerCase()
      .includes(guidelineSearch.toLowerCase())

    const matchesFilter =
      guidelineFilter === 'All' ||
      (guidelineFilter === 'Mapped' && count > 0) ||
      (guidelineFilter === 'Unmapped' && count === 0)

    return matchesSearch && matchesFilter
  })

  // =========================================
  // MANUAL MAPPING FUNCTIONS
  // =========================================

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
    const currentIds = getGuidelinePolicyIds(guideline).map(String)

    if (!currentIds.includes(policyId)) {
      setMessage('This mapping no longer exists.')
      return
    }

    if (
      !window.confirm(
        `Remove the association between "${selectedPolicy.name}" and "${guideline.name}"?`
      )
    ) {
      return
    }

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

  // =========================================
  // DYNAMIC MAPPING FILTERS
  // =========================================

  const dynamicVisiblePolicies = policies.filter((policy) =>
    String(policy.name || '')
      .toLowerCase()
      .includes(dynamicPolicySearch.toLowerCase())
  )

  const dynamicVisibleGuidelines = guidelines.filter((guideline) => {
    const id = String(guideline.id)

    const linked = dynamicSelectedIds.includes(id)

    const matchesSearch = String(guideline.name || '')
      .toLowerCase()
      .includes(dynamicGuidelineSearch.toLowerCase())

    const matchesFilter =
      dynamicGuidelineFilter === 'All' ||
      (dynamicGuidelineFilter === 'Linked' && linked) ||
      (dynamicGuidelineFilter === 'Unlinked' && !linked)

    return matchesSearch && matchesFilter
  })

  const savedLinkedGuidelines = dynamicPolicy
    ? getGuidelinesForPolicy(dynamicPolicy, guidelines)
    : []

  // =========================================
  // DYNAMIC MAPPING FUNCTIONS
  // =========================================

  function chooseDynamicPolicy(policyId) {
    const policy = policies.find(
      (item) => String(item.id) === String(policyId)
    )

    if (!policy) return

    // Load existing associations into checkboxes.
    const existingLinkedIds = getGuidelinesForPolicy(
      policy,
      guidelines
    ).map((guideline) => String(guideline.id))

    setDynamicPolicyId(policy.id)
    setDynamicSelectedIds(existingLinkedIds)

    setDynamicGuidelineSearch('')
    setDynamicGuidelineFilter('All')
    setDynamicMessage('')
    setPreviewGuideline(null)

    setDynamicStep(2)
  }

  function toggleDynamicGuideline(guidelineId) {
    const id = String(guidelineId)

    setDynamicSelectedIds((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    )

    setDynamicMessage('')
  }

  function saveDynamicMappings() {
    if (!dynamicPolicy) return

    const policyId = String(dynamicPolicy.id)

    let created = 0
    let removed = 0

    guidelines.forEach((guideline) => {
      const guidelineId = String(guideline.id)

      const currentIds = getGuidelinePolicyIds(guideline).map(String)

      const wasLinked = currentIds.includes(policyId)

      const shouldBeLinked =
        dynamicSelectedIds.includes(guidelineId)

      if (shouldBeLinked && !wasLinked) {
        saveGuidelinePolicyIds(
          guideline.id,
          [...currentIds, policyId]
        )

        recordMappingAudit(
          'Mapping Created',
          dynamicPolicy,
          guideline
        )

        created++
      }

      if (!shouldBeLinked && wasLinked) {
        saveGuidelinePolicyIds(
          guideline.id,
          currentIds.filter((id) => id !== policyId)
        )

        recordMappingAudit(
          'Mapping Removed',
          dynamicPolicy,
          guideline
        )

        removed++
      }
    })

    setRevision((previous) => previous + 1)

    setDynamicMessage(
      `Changes saved. ${created} mapping${
        created === 1 ? '' : 's'
      } created and ${removed} mapping${
        removed === 1 ? '' : 's'
      } removed.`
    )

    setPreviewGuideline(null)
    setDynamicStep(3)
  }

  function resetDynamicMapping() {
    setDynamicStep(1)
    setDynamicPolicyId(null)
    setDynamicPolicySearch('')
    setDynamicGuidelineSearch('')
    setDynamicGuidelineFilter('All')
    setDynamicSelectedIds([])
    setDynamicMessage('')
    setPreviewGuideline(null)
  }

  // =========================================
  // PAGE
  // =========================================

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

        <main className="ccf-mappings-content">

          {/* PAGE TITLE */}

          <div className="ccf-mappings-heading">
            <h1>Document Mappings</h1>
            <p>
              Manage associations between internal policies
              and external guidelines.
            </p>
          </div>

          {/* MAPPING MODES */}

          <div
            className="ccf-mappings-mode-switch"
            role="group"
            aria-label="Mapping mode"
          >
            <button
              type="button"
              className={mappingMode === 'manual' ? 'active' : ''}
              onClick={() => setMappingMode('manual')}
            >
              Manual Mapping
            </button>

            <button
              type="button"
              className={mappingMode === 'dynamic' ? 'active' : ''}
              onClick={() => setMappingMode('dynamic')}
            >
              Dynamic Mapping
            </button>
          </div>

          {/* =====================================
              MANUAL MAPPING
              ===================================== */}

          {mappingMode === 'manual' && (
            <>

              {/* SUMMARY CARDS */}

              <div className="ccf-mappings-stats">
                <div className="ccf-mappings-stat">
                  <span>TOTAL MAPPINGS</span>
                  <strong>{totalMappings}</strong>
                  <small>Active policy-guideline associations</small>
                </div>

                <div className="ccf-mappings-stat">
                  <span>MAPPED DOCUMENTS</span>
                  <strong>{mappedDocuments}</strong>
                  <small>Documents with active associations</small>
                </div>

                <div className="ccf-mappings-stat">
                  <span>UNMAPPED DOCUMENTS</span>
                  <strong>{unmappedDocuments}</strong>
                  <small>Documents without associations</small>
                </div>
              </div>

              <div className="ccf-mappings-columns">

                {/* INTERNAL POLICIES */}

                <section className="ccf-mappings-panel">
                  <div className="ccf-mappings-panel-title">
                    <h2>Internal Policies</h2>
                    <span>{visiblePolicies.length} policies</span>
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
                              count ? 'mapped' : 'unmapped'
                            }`}
                          >
                            {count ? `${count} mapped` : 'Unmapped'}
                          </span>
                        </button>
                      )
                    })}

                    {visiblePolicies.length === 0 && (
                      <p className="ccf-mappings-empty">
                        No matching policies.
                      </p>
                    )}
                  </div>
                </section>

                {/* EXTERNAL GUIDELINES */}

                <section className="ccf-mappings-panel">
                  <div className="ccf-mappings-panel-title">
                    <h2>External Guidelines</h2>
                    <span>{visibleGuidelines.length} guidelines</span>
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
                          <span className="ccf-mappings-checkbox-line">
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
                              count ? 'mapped' : 'unmapped'
                            }`}
                          >
                            {count ? `${count} mapped` : 'Unmapped'}
                          </span>

                          {linked && (
                            <em>Linked to selected policy</em>
                          )}
                        </label>
                      )
                    })}

                    {visibleGuidelines.length === 0 && (
                      <p className="ccf-mappings-empty">
                        No matching guidelines.
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
                  <strong>{selectedPolicy?.name || 'None'}</strong>
                  {' · '}
                  Selected guidelines:{' '}
                  <strong>{selectedGuidelineIds.length}</strong>
                </p>

                <div className="ccf-mappings-buttons">
                  <button
                    type="button"
                    className="ccf-mappings-primary"
                    onClick={() => updateMappings('add')}
                  >
                    + Create Mapping
                  </button>

                  <button
                    type="button"
                    className="ccf-mappings-danger"
                    onClick={() => updateMappings('remove')}
                  >
                    Remove Mapping
                  </button>

                  <button
                    type="button"
                    className="ccf-mappings-secondary"
                    onClick={clearSelection}
                  >
                    Clear Selection
                  </button>
                </div>

                {message && (
                  <p role="status" className="ccf-mappings-message">
                    {message}
                  </p>
                )}
              </section>

              {/* ASSOCIATION INSPECTOR */}

              <section className="ccf-mappings-panel ccf-mappings-inspector">
                <h2>Association Inspector</h2>

                {!selectedPolicy ? (
                  <p>
                    Select a policy to view its associated guidelines.
                  </p>
                ) : (
                  <>
                    <h3>{selectedPolicy.name}</h3>

                    {mappedGuidelines.length === 0 ? (
                      <p>
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
                              className="ccf-mappings-secondary"
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

          {/* =====================================
              DYNAMIC MAPPING
              ===================================== */}

          {mappingMode === 'dynamic' && (
            <section className="ccf-mappings-panel ccf-mappings-dynamic">

              <div className="ccf-mappings-step-label">
                Step {dynamicStep} of 3
              </div>

              {/* =====================================
                  STEP 1 — SELECT POLICY
                  ===================================== */}

              {dynamicStep === 1 && (
                <>
                  <h2>Select a Policy</h2>

                  <p>
                    Choose a policy to manage its guideline associations.
                  </p>

                  <p className="ccf-mappings-muted">
                    Guidelines will be loaded from your existing
                    Guideline Database.
                  </p>

                  <input
                    className="ccf-mappings-search"
                    type="search"
                    placeholder="Search policy database..."
                    aria-label="Search policy database"
                    value={dynamicPolicySearch}
                    onChange={(event) =>
                      setDynamicPolicySearch(event.target.value)
                    }
                  />

                  <div className="ccf-mappings-dynamic-list">
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
                      <p className="ccf-mappings-empty">
                        No policies found.
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* =====================================
                  STEP 2 — GUIDELINES FOUND
                  ===================================== */}

              {dynamicStep === 2 && (
                <>
                  <h2>Guidelines Found</h2>

                  <div className="ccf-mappings-highlight">
                    <strong>{dynamicPolicy?.name}</strong>
                    <small>Policy ID: {dynamicPolicy?.id}</small>
                  </div>

                  <p>
                    Check a guideline to link it to this policy.
                    Uncheck it to unlink it.
                  </p>

                  <p className="ccf-mappings-muted">
                    Linked and Unlinked labels update immediately.
                    Your changes are saved only when you click Save.
                  </p>

                  {/* SEARCH GUIDELINES */}

                  <input
                    className="ccf-mappings-search"
                    type="search"
                    placeholder="Search guidelines..."
                    aria-label="Search guidelines"
                    value={dynamicGuidelineSearch}
                    onChange={(event) =>
                      setDynamicGuidelineSearch(event.target.value)
                    }
                  />

                  {/* FILTERS — DIRECTLY BELOW SEARCH */}

                  <div className="ccf-mappings-filters">
                    {['All', 'Linked', 'Unlinked'].map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={
                          dynamicGuidelineFilter === option
                            ? 'selected'
                            : ''
                        }
                        onClick={() =>
                          setDynamicGuidelineFilter(option)
                        }
                      >
                        {option}
                      </button>
                    ))}
                  </div>

                  {/* GUIDELINE LIST */}

                  <div className="ccf-mappings-dynamic-list">
                    {dynamicVisibleGuidelines.map((guideline) => {
                      const checked =
                        dynamicSelectedIds.includes(
                          String(guideline.id)
                        )

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
                              <small>
                                Guideline ID: {guideline.id}
                              </small>
                            </span>
                          </label>

                          <span
                            className={`ccf-mappings-tag ${
                              checked ? 'mapped' : 'unmapped'
                            }`}
                          >
                            {checked ? 'Linked' : 'Unlinked'}
                          </span>

                          <button
                            type="button"
                            className="ccf-mappings-secondary"
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
                        No guidelines match your search or filter.
                      </p>
                    )}
                  </div>

                  {/* GUIDELINE DETAILS */}

                  {previewGuideline && (
                    <div className="ccf-mappings-preview">
                      <div className="ccf-mappings-preview-heading">
                        <h4>Guideline Details</h4>

                        <button
                          type="button"
                          className="ccf-mappings-secondary"
                          onClick={() =>
                            setPreviewGuideline(null)
                          }
                        >
                          Close
                        </button>
                      </div>

                      <h4>{previewGuideline.name}</h4>

                      <p>
                        Guideline ID: {previewGuideline.id}
                      </p>

                      {previewGuideline.description && (
                        <p>{previewGuideline.description}</p>
                      )}

                      {typeof previewGuideline.url === 'string' &&
                      /^https?:\/\//i.test(previewGuideline.url) ? (
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

                  {/* COUNT */}

                  <p className="ccf-mappings-muted">
                    {dynamicSelectedIds.length} of {guidelines.length}
                    {' '}guidelines linked.
                  </p>

                  {/* BACK AND SAVE */}

                  <div className="ccf-mappings-step-actions">
                    <button
                      type="button"
                      className="ccf-mappings-secondary"
                      onClick={() => {
                        setPreviewGuideline(null)
                        setDynamicStep(1)
                      }}
                    >
                      Back
                    </button>

                    <button
                      type="button"
                      className="ccf-mappings-primary"
                      onClick={saveDynamicMappings}
                    >
                      Save
                    </button>
                  </div>
                </>
              )}

              {/* =====================================
                  STEP 3 — SAVED LINKED GUIDELINES
                  ===================================== */}

              {dynamicStep === 3 && (
                <>
                  <h2>Linked Guidelines</h2>

                  <div className="ccf-mappings-highlight">
                    <strong>{dynamicPolicy?.name}</strong>
                    <small>Policy ID: {dynamicPolicy?.id}</small>
                  </div>

                  <p
                    role="status"
                    className="ccf-mappings-message"
                  >
                    {dynamicMessage}
                  </p>

                  <p>
                    These guidelines are currently linked to
                    your selected policy.
                  </p>

                  <div className="ccf-mappings-dynamic-list">
                    {savedLinkedGuidelines.map((guideline) => (
                      <div
                        key={guideline.id}
                        className="ccf-mappings-result selected"
                      >
                        <div>
                          <strong>{guideline.name}</strong>
                          <small>
                            Guideline ID: {guideline.id}
                          </small>
                        </div>

                        <span className="ccf-mappings-tag mapped">
                          Linked
                        </span>

                        <button
                          type="button"
                          className="ccf-mappings-secondary"
                          onClick={() =>
                            setPreviewGuideline(guideline)
                          }
                        >
                          View Details
                        </button>
                      </div>
                    ))}

                    {savedLinkedGuidelines.length === 0 && (
                      <p className="ccf-mappings-empty">
                        No guidelines are linked to this policy.
                      </p>
                    )}
                  </div>

                  {/* DETAILS ON FINAL STEP */}

                  {previewGuideline && (
                    <div className="ccf-mappings-preview">
                      <div className="ccf-mappings-preview-heading">
                        <h4>Guideline Details</h4>

                        <button
                          type="button"
                          className="ccf-mappings-secondary"
                          onClick={() =>
                            setPreviewGuideline(null)
                          }
                        >
                          Close
                        </button>
                      </div>

                      <h4>{previewGuideline.name}</h4>

                      <p>
                        Guideline ID: {previewGuideline.id}
                      </p>

                      {previewGuideline.description && (
                        <p>{previewGuideline.description}</p>
                      )}

                      {typeof previewGuideline.url === 'string' &&
                      /^https?:\/\//i.test(previewGuideline.url) ? (
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

                  <p className="ccf-mappings-muted">
                    {savedLinkedGuidelines.length} linked guideline
                    {savedLinkedGuidelines.length === 1 ? '' : 's'}.
                  </p>

                  {/* BACK AND END */}

                  <div className="ccf-mappings-step-actions">
                    <button
                      type="button"
                      className="ccf-mappings-secondary"
                      onClick={() => {
                        setPreviewGuideline(null)
                        setDynamicStep(2)
                      }}
                    >
                      Back to Guidelines
                    </button>

                    <button
                      type="button"
                      className="ccf-mappings-primary"
                      onClick={resetDynamicMapping}
                    >
                      End
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
        </main>
      </div>

      {/* =====================================
          HELP DIALOG
          ===================================== */}

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
            aria-labelledby="ccf-mappings-help-title"
          >
            <div className="ccf-mappings-help-heading">
              <h2 id="ccf-mappings-help-title">
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
              <strong>Manual Mapping:</strong> Select a policy
              and one or more guidelines. Create or remove
              associations using the Mapping Actions section.
            </p>

            <p>
              <strong>Dynamic Mapping:</strong> Select a policy,
              review all guidelines, use the Linked and Unlinked
              filters, and check or uncheck guidelines to change
              their associations.
            </p>

            <p>
              Click Save to apply your changes. The next step
              displays only the linked guidelines.
            </p>

            <p>
              Mapping changes are saved in your browser and
              recorded in the Audit Log.
            </p>

            <button
              type="button"
              className="ccf-mappings-primary"
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
