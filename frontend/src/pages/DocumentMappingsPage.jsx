
import { useState } from 'react'
import { Link } from 'react-router-dom'
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
// DYNAMIC MODE STYLING
// ==========================================

const primaryButton = {
  padding: '12px 22px',
  background: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontWeight: 600,
  cursor: 'pointer',
}

const secondaryButton = {
  padding: '12px 22px',
  background: 'white',
  color: '#334155',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  fontWeight: 600,
  cursor: 'pointer',
}

const dynamicCard = {
  background: 'white',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '24px',
}

const actionRow = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  marginTop: '24px',
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

  // DYNAMIC MODE
  const [dynamicStep, setDynamicStep] = useState(1)
  const [dynamicPolicyId, setDynamicPolicyId] = useState(null)
  const [dynamicPolicySearch, setDynamicPolicySearch] = useState('')
  const [dynamicSelectedIds, setDynamicSelectedIds] = useState([])
  const [dynamicResults, setDynamicResults] = useState([])
  const [dynamicMessage, setDynamicMessage] = useState('')
  const [previewGuideline, setPreviewGuideline] = useState(null)

  // Forces the page to refresh after mapping changes
  const [, setRevision] = useState(0)

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

  const dynamicPolicy = policies.find(
    (policy) => String(policy.id) === String(dynamicPolicyId)
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
  // DYNAMIC MODE FUNCTIONS
  // ==========================================

  function chooseDynamicPolicy(policyId) {
    setDynamicPolicyId(policyId)
    setDynamicResults([])
    setDynamicSelectedIds([])
    setDynamicMessage('')
    setPreviewGuideline(null)
    setDynamicStep(3)
  }

  function startGuidelineSearch() {
    if (!dynamicPolicy) return

    // PRELIMINARY SEARCH:
    // Use existing Guideline Database records.
    // Replace this with the backend API later.
    setDynamicResults([...guidelines])
    setDynamicSelectedIds([])
    setDynamicMessage('')
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
        const currentIds =
          getGuidelinePolicyIds(guideline).map(String)

        const policyId = String(dynamicPolicy.id)

        if (currentIds.includes(policyId)) {
          alreadyMapped++
          return
        }

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
    setDynamicSelectedIds([])
    setDynamicResults([])
    setDynamicMessage('')
    setPreviewGuideline(null)
  }

  // ==========================================
  // DYNAMIC POLICY FILTER
  // ==========================================

  const dynamicVisiblePolicies = policies.filter((policy) =>
    String(policy.name || '')
      .toLowerCase()
      .includes(dynamicPolicySearch.toLowerCase())
  )

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

          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginTop: '24px',
              marginBottom: '28px',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => setMappingMode('manual')}
              style={{
                ...primaryButton,
                background:
                  mappingMode === 'manual'
                    ? '#2563eb'
                    : 'white',
                color:
                  mappingMode === 'manual'
                    ? 'white'
                    : '#2563eb',
                border: '1px solid #2563eb',
              }}
            >
              Manual Mapping
            </button>

            <button
              type="button"
              onClick={() => setMappingMode('dynamic')}
              style={{
                ...primaryButton,
                background:
                  mappingMode === 'dynamic'
                    ? '#2563eb'
                    : 'white',
                color:
                  mappingMode === 'dynamic'
                    ? 'white'
                    : '#2563eb',
                border: '1px solid #2563eb',
              }}
            >
              Dynamic Mapping
            </button>
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
              DYNAMIC MAPPING MODE
          ================================== */}

          {mappingMode === 'dynamic' && (
            <section style={dynamicCard}>
              {/* STEP 1: START */}

              {dynamicStep === 1 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '45px 20px',
                  }}
                >
                  <h2>Dynamic Document Mapping</h2>

                  <p style={{ color: '#64748b' }}>
                    Select a policy to find and review
                    guidelines for mapping.
                  </p>

                  <button
                    type="button"
                    style={{
                      ...primaryButton,
                      marginTop: '20px',
                    }}
                    onClick={() => setDynamicStep(2)}
                  >
                    Select a Policy
                  </button>
                </div>
              )}

              {/* STEP 2: POLICY DATABASE */}

              {dynamicStep === 2 && (
                <div>
                  <h2>Select a Policy</h2>

                  <p style={{ color: '#64748b' }}>
                    Choose a policy from your Policy Database.
                  </p>

                  <input
                    className="mapping-search"
                    type="text"
                    placeholder="Search policy database..."
                    value={dynamicPolicySearch}
                    onChange={(event) =>
                      setDynamicPolicySearch(
                        event.target.value
                      )
                    }
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      margin: '16px 0',
                    }}
                  />

                  <div
                    style={{
                      display: 'grid',
                      gap: '10px',
                    }}
                  >
                    {dynamicVisiblePolicies.map((policy) => (
                      <button
                        key={policy.id}
                        type="button"
                        onClick={() =>
                          chooseDynamicPolicy(policy.id)
                        }
                        style={{
                          padding: '16px',
                          textAlign: 'left',
                          background: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          cursor: 'pointer',
                        }}
                      >
                        <strong>{policy.name}</strong>

                        <div
                          style={{
                            fontSize: '12px',
                            color: '#64748b',
                            marginTop: '5px',
                          }}
                        >
                          Policy ID: {policy.id}
                        </div>
                      </button>
                    ))}

                    {dynamicVisiblePolicies.length === 0 && (
                      <p>No policies found.</p>
                    )}
                  </div>

                  <div style={actionRow}>
                    <button
                      type="button"
                      style={secondaryButton}
                      onClick={() => setDynamicStep(1)}
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: SELECTED POLICY */}

              {dynamicStep === 3 && (
                <div>
                  <h2>Selected Policy</h2>

                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '20px',
                      marginTop: '20px',
                    }}
                  >
                    <strong>
                      {dynamicPolicy?.name}
                    </strong>

                    <p
                      style={{
                        color: '#64748b',
                        marginBottom: 0,
                      }}
                    >
                      Policy ID: {dynamicPolicy?.id}
                    </p>
                  </div>

                  <p style={{ marginTop: '20px' }}>
                    Start the guideline search for this policy.
                  </p>

                  <p
                    style={{
                      fontSize: '13px',
                      color: '#64748b',
                    }}
                  >
                    Preliminary version: this searches the
                    existing Guideline Database. External
                    guideline discovery will be connected
                    to the backend later.
                  </p>

                  <div style={actionRow}>
                    <button
                      type="button"
                      style={secondaryButton}
                      onClick={() => setDynamicStep(2)}
                    >
                      Back
                    </button>

                    <button
                      type="button"
                      style={primaryButton}
                      onClick={startGuidelineSearch}
                    >
                      Start Guideline Search
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: GUIDELINE RESULTS */}

              {dynamicStep === 4 && (
                <div>
                  <h2>Guidelines Found</h2>

                  <p style={{ color: '#64748b' }}>
                    Select guidelines to map to{' '}
                    <strong>{dynamicPolicy?.name}</strong>.
                  </p>

                  <p
                    style={{
                      fontSize: '13px',
                      color: '#64748b',
                    }}
                  >
                    Showing existing Guideline Database
                    records, not external backend search
                    results.
                  </p>

                  <div
                    style={{
                      display: 'grid',
                      gap: '12px',
                      marginTop: '20px',
                    }}
                  >
                    {dynamicResults.map((guideline) => {
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
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '16px',
                            padding: '16px',
                            border: checked
                              ? '2px solid #2563eb'
                              : '1px solid #e2e8f0',
                            borderRadius: '8px',
                            background: checked
                              ? '#eff6ff'
                              : 'white',
                            flexWrap: 'wrap',
                          }}
                        >
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleDynamicGuideline(
                                  guideline.id
                                )
                              }
                            />

                            <span>
                              <strong>
                                {guideline.name}
                              </strong>

                              {linked && (
                                <small
                                  style={{
                                    display: 'block',
                                    color: '#64748b',
                                    marginTop: '4px',
                                  }}
                                >
                                  Already mapped to this policy
                                </small>
                              )}
                            </span>
                          </label>

                          <button
                            type="button"
                            style={secondaryButton}
                            onClick={() =>
                              setPreviewGuideline(guideline)
                            }
                          >
                            View Details
                          </button>
                        </div>
                      )
                    })}

                    {dynamicResults.length === 0 && (
                      <p>No guidelines are available.</p>
                    )}
                  </div>

                  {/* GUIDELINE DETAILS */}

                  {previewGuideline && (
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '20px',
                        marginTop: '20px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <h3 style={{ margin: 0 }}>
                          Guideline Details
                        </h3>

                        <button
                          type="button"
                          style={secondaryButton}
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
                        <p>
                          {previewGuideline.description}
                        </p>
                      )}

                      {previewGuideline.url &&
                        /^https?:\/\//i.test(
                          previewGuideline.url
                        ) && (
                          <a
                            href={previewGuideline.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open Guideline Document
                          </a>
                        )}

                      {!previewGuideline.url && (
                        <p
                          style={{
                            fontSize: '13px',
                            color: '#64748b',
                          }}
                        >
                          No external document link is
                          available for this guideline.
                        </p>
                      )}
                    </div>
                  )}

                  <div style={actionRow}>
                    <button
                      type="button"
                      style={secondaryButton}
                      onClick={() => {
                        setPreviewGuideline(null)
                        setDynamicStep(3)
                      }}
                    >
                      Back
                    </button>

                    <button
                      type="button"
                      style={{
                        ...primaryButton,
                        opacity:
                          dynamicSelectedIds.length === 0
                            ? 0.5
                            : 1,
                      }}
                      disabled={
                        dynamicSelectedIds.length === 0
                      }
                      onClick={saveDynamicMappings}
                    >
                      Map to Policy (
                      {dynamicSelectedIds.length})
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5: CONFIRMATION */}

              {dynamicStep === 5 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '45px 20px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '42px',
                      color: '#16a34a',
                    }}
                  >
                    ✓
                  </div>

                  <h2>Guidelines Mapped Successfully</h2>

                  <p role="status">
                    {dynamicMessage}
                  </p>

                  <p style={{ color: '#64748b' }}>
                    Your selected guidelines are now
                    associated with{' '}
                    <strong>{dynamicPolicy?.name}</strong>.
                  </p>

                  <p
                    style={{
                      fontSize: '13px',
                      color: '#64748b',
                    }}
                  >
                    These guidelines were already in the
                    Guideline Database. No new external
                    documents were imported.
                  </p>

                  <button
                    type="button"
                    style={{
                      ...primaryButton,
                      marginTop: '20px',
                    }}
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
    </div>
  )
}

export default DocumentMappingsPage
