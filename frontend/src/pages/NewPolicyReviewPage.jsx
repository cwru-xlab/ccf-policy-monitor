
import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  getGuidelinesForPolicies,
} from '../data/guidelineMappings'

function NewPolicyReviewPage() {
  const navigate = useNavigate()

  // ==========================================
  // READ SAVED DATA SAFELY
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
  // REVIEW SESSION INFORMATION
  // ==========================================

  const [reviewName, setReviewName] = useState(() => {
    return localStorage.getItem('newReviewName') || ''
  })

  const [reviewDescription, setReviewDescription] = useState(() => {
    return localStorage.getItem('newReviewDescription') || ''
  })

  // ==========================================
  // ORIGINAL POLICY DATABASE
  // ==========================================

  const originalPolicies = [
    { id: 1, name: 'Cardiac Coverage Policy' },
    { id: 2, name: 'Diabetes Treatment Policy' },
    { id: 3, name: 'Oncology Coverage Policy' },
    { id: 4, name: 'Orthopedic Surgery Policy' },
    { id: 5, name: 'Mental Health Coverage Policy' },
  ]

  const addedPolicies = getSavedArray('addedPolicies')
  const deletedPolicyIds = getSavedArray('deletedPolicyIds')

  const databasePolicies = [
    ...addedPolicies,
    ...originalPolicies,
  ].filter(
    (policy) =>
      !deletedPolicyIds.some(
        (id) => String(id) === String(policy.id)
      )
  )

  // ==========================================
  // SELECTED POLICIES
  // ==========================================

  const [selectedPolicies, setSelectedPolicies] = useState(() => {
    const savedPolicies = getSavedArray('selectedPolicies')

    return savedPolicies.filter((selectedPolicy) =>
      databasePolicies.some(
        (policy) =>
          String(policy.id) === String(selectedPolicy.id)
      )
    )
  })

  // ==========================================
  // ORIGINAL GUIDELINES
  // ==========================================

  // Policy mappings are no longer defined here.
  // They are supplied by guidelineMappings.js.

  const originalGuidelines = [
    {
      id: 1,
      name: 'Cardiac Coverage Guideline',
      description:
        'Clinical guidance for cardiac procedures, diagnostic testing, and treatment.',
    },
    {
      id: 2,
      name: 'Diabetes Treatment Guideline',
      description:
        'Clinical guidance for diabetes management, medications, and treatment.',
    },
    {
      id: 3,
      name: 'Oncology Coverage Guideline',
      description:
        'Clinical guidance for oncology services, testing, and treatments.',
    },
    {
      id: 4,
      name: 'Orthopedic Surgery Guideline',
      description:
        'Clinical guidance for orthopedic procedures and rehabilitation.',
    },
    {
      id: 5,
      name: 'Mental Health Guideline',
      description:
        'Clinical guidance for mental health services and treatment.',
    },
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
  // AUTOMATIC GUIDELINE MATCHING
  // ==========================================

  const associatedGuidelines = getGuidelinesForPolicies(
    selectedPolicies,
    allGuidelines
  )

  // ==========================================
  // REMOVE POLICY
  // ==========================================

  function removePolicy(id) {
    const updatedPolicies = selectedPolicies.filter(
      (policy) => String(policy.id) !== String(id)
    )

    setSelectedPolicies(updatedPolicies)

    localStorage.setItem(
      'selectedPolicies',
      JSON.stringify(updatedPolicies)
    )

    // Old guideline selections are no longer valid.
    localStorage.removeItem('selectedGuidelines')
  }

  // ==========================================
  // CONTINUE TO REFERENCE GUIDELINES
  // ==========================================

  function continueToGuidelines() {
    if (reviewName.trim() === '') {
      alert('Please enter a review session name.')
      return
    }

    if (reviewDescription.trim() === '') {
      alert('Please enter a short description.')
      return
    }

    // Recheck policies against the current database.
    const currentAddedPolicies =
      getSavedArray('addedPolicies')

    const currentDeletedPolicyIds =
      getSavedArray('deletedPolicyIds')

    const currentDatabasePolicies = [
      ...currentAddedPolicies,
      ...originalPolicies,
    ].filter(
      (policy) =>
        !currentDeletedPolicyIds.some(
          (id) => String(id) === String(policy.id)
        )
    )

    const validSelectedPolicies =
      currentDatabasePolicies.filter((policy) =>
        selectedPolicies.some(
          (selectedPolicy) =>
            String(selectedPolicy.id) === String(policy.id)
        )
      )

    if (validSelectedPolicies.length === 0) {
      alert(
        'Please select at least one policy from the Policy Database.'
      )
      return
    }

    // Use the shared mapping function.
    const mappedGuidelines = getGuidelinesForPolicies(
      validSelectedPolicies,
      allGuidelines
    )

    // Save session information.
    localStorage.setItem(
      'newReviewName',
      reviewName.trim()
    )

    localStorage.setItem(
      'newReviewDescription',
      reviewDescription.trim()
    )

    localStorage.setItem(
      'selectedPolicies',
      JSON.stringify(validSelectedPolicies)
    )

    localStorage.setItem(
      'selectedGuidelines',
      JSON.stringify(mappedGuidelines)
    )

    localStorage.setItem(
      'guidelineMode',
      'automatic'
    )

    navigate('/reviews/new/select-guidelines')
  }

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <div className="app-page">
      {/* TOP HEADER */}

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

          <Link
            to="/reviews"
            className="nav-item active"
          >
            Review Sessions
          </Link>

          <Link to="/policies" className="nav-item">
            Policy Database
          </Link>

          <Link to="/guidelines" className="nav-item">
            Guideline Database
          </Link>

          <Link to="/audit-log" className="nav-item">
            Audit Log
          </Link>
        </aside>

        {/* PAGE CONTENT */}

        <main className="new-review-content">
          <Link to="/reviews" className="back-link">
            ← Back to Review Sessions
          </Link>

          {/* PAGE HEADER */}

          <div style={{ marginBottom: '26px' }}>
            <h1>Start a Review Session</h1>

            <p className="new-review-subtitle">
              Create a review session and select existing
              policies from the Policy Database. Their
              associated guidelines will be added automatically.
            </p>
          </div>

          {/* WORKFLOW STEPS */}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '28px',
              fontSize: '13px',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                background: '#0078bf',
                color: 'white',
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
              }}
            >
              1
            </span>

            <strong>Session Details</strong>

            <span style={{ color: '#aaa' }}>→</span>

            <span
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                border: '1px solid #bbb',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#777',
                fontWeight: '700',
              }}
            >
              2
            </span>

            <span style={{ color: '#777' }}>
              Reference Guidelines
            </span>

            <span style={{ color: '#aaa' }}>→</span>

            <span
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                border: '1px solid #bbb',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#777',
                fontWeight: '700',
              }}
            >
              3
            </span>

            <span style={{ color: '#777' }}>
              Start Review
            </span>
          </div>

          {/* SESSION INFORMATION */}

          <section className="new-review-card">
            <h2>Review Session Details</h2>

            <p
              style={{
                marginTop: '4px',
                marginBottom: '22px',
                color: '#666',
              }}
            >
              Give this review session a clear name and
              description so it can be identified later.
            </p>

            <label className="new-review-label">
              Review Session Name
            </label>

            <input
              className="review-name-input"
              type="text"
              placeholder="Example: 2026 Cardiac Policy Review"
              value={reviewName}
              onChange={(event) => {
                setReviewName(event.target.value)

                localStorage.setItem(
                  'newReviewName',
                  event.target.value
                )
              }}
            />

            <label
              className="new-review-label"
              style={{
                display: 'block',
                marginTop: '22px',
              }}
            >
              Description
            </label>

            <textarea
              className="review-name-input"
              placeholder="Briefly describe the purpose of this review session..."
              value={reviewDescription}
              onChange={(event) => {
                setReviewDescription(event.target.value)

                localStorage.setItem(
                  'newReviewDescription',
                  event.target.value
                )
              }}
              rows="4"
              style={{
                resize: 'vertical',
                minHeight: '90px',
                fontFamily: 'inherit',
              }}
            />
          </section>

          {/* POLICY SELECTION */}

          <section className="new-review-card policy-document-section">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '20px',
              }}
            >
              <div>
                <h2>Policies in this Review Session</h2>

                <p>
                  Select one or more existing policies from
                  the Policy Database to include in this review.
                </p>
              </div>

              {selectedPolicies.length > 0 && (
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    background: '#e7f3fb',
                    color: '#0078bf',
                    padding: '6px 10px',
                    borderRadius: '14px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedPolicies.length}{' '}
                  {selectedPolicies.length === 1
                    ? 'policy selected'
                    : 'policies selected'}
                </span>
              )}
            </div>

            {/* SELECT FROM POLICY DATABASE */}

            <div
              style={{
                marginTop: '22px',
                marginBottom: '22px',
              }}
            >
              <button
                type="button"
                className="outline-action-button"
                onClick={() =>
                  navigate('/reviews/new/select-policies')
                }
              >
                Select from Policy Database
              </button>
            </div>

            {/* SELECTED POLICIES */}

            {selectedPolicies.length > 0 ? (
              <div className="selected-policies-list">
                {selectedPolicies.map((policy) => (
                  <div
                    className="selected-policy-file"
                    key={policy.id}
                  >
                    <div>
                      <strong>
                        {policy.name || policy.fileName}
                      </strong>

                      <small>
                        {policy.description ||
                          'Policy selected for review'}
                      </small>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removePolicy(policy.id)
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  border: '1px dashed #bbb',
                  borderRadius: '6px',
                  padding: '24px',
                  textAlign: 'center',
                  color: '#777',
                  marginBottom: '22px',
                }}
              >
                No policies have been selected yet.
              </div>
            )}

            {/* DATABASE-ONLY NOTICE */}

            <p
              style={{
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid #e2e2e2',
                fontSize: '13px',
                color: '#64748b',
              }}
            >
              Policies must be uploaded to the Policy Database
              before they can be included in a review session.
            </p>
          </section>

          {/* AUTOMATIC GUIDELINE PREVIEW */}

          {selectedPolicies.length > 0 && (
            <section className="new-review-card">
              <h2>Automatically Associated Guidelines</h2>

              <p
                style={{
                  color: '#666',
                  marginTop: '4px',
                  marginBottom: '18px',
                }}
              >
                These guidelines are already mapped to your
                selected policies. They will be used
                automatically during the review.
              </p>

              {associatedGuidelines.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  {associatedGuidelines.map((guideline) => (
                    <div
                      key={guideline.id}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '7px',
                        padding: '12px 16px',
                        background: '#f8fafc',
                      }}
                    >
                      <strong
                        style={{
                          fontSize: '14px',
                          color: '#334155',
                        }}
                      >
                        {guideline.name}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p
                  style={{
                    fontSize: '13px',
                    color: '#64748b',
                  }}
                >
                  No guidelines are currently mapped to
                  these policies.
                </p>
              )}
            </section>
          )}

          {/* BOTTOM ACTIONS */}

          <div className="new-review-actions">
            <button
              type="button"
              className="cancel-review-button"
              onClick={() => navigate('/reviews')}
            >
              Cancel
            </button>

            <button
              type="button"
              className="start-review-button"
              onClick={continueToGuidelines}
            >
              Continue to Reference Guidelines →
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}

export default NewPolicyReviewPage
