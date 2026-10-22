
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getGuidelinesForPolicies,
  getPoliciesForGuideline,
} from '../data/guidelineMappings'

function GuidelineSelectionPage() {
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

  const reviewName =
    localStorage.getItem('newReviewName') ||
    'New Review Session'

  const reviewDescription =
    localStorage.getItem('newReviewDescription') || ''

  const savedSelectedPolicies =
    getSavedArray('selectedPolicies')

  // ==========================================
  // POLICY DATABASE
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

  // Only use policies still in the database.
  const selectedPolicies = databasePolicies.filter(
    (policy) =>
      savedSelectedPolicies.some(
        (selectedPolicy) =>
          String(selectedPolicy.id) === String(policy.id)
      )
  )

  // ==========================================
  // GUIDELINE DATABASE
  // ==========================================

  // The mappings are now handled entirely by
  // guidelineMappings.js, not this page.

  const originalGuidelines = [
    {
      id: 1,
      name: 'Cardiac Coverage Guideline',
      description:
        'Clinical guidance for cardiac procedures, diagnostic testing, and treatment.',
      source: 'Clinical Reference',
      updated: 'Sep 23, 2026',
      updatedAge: '2 days ago',
      status: 'Active',
      version: '2026',
    },
    {
      id: 2,
      name: 'Diabetes Treatment Guideline',
      description:
        'Clinical guidance for diabetes management, medications, and treatment.',
      source: 'Clinical Reference',
      updated: 'Sep 18, 2026',
      updatedAge: '6 days ago',
      status: 'Active',
      version: '2026',
    },
    {
      id: 3,
      name: 'Oncology Coverage Guideline',
      description:
        'Clinical guidance for oncology services, testing, and treatments.',
      source: 'Clinical Reference',
      updated: 'Sep 10, 2026',
      updatedAge: '14 days ago',
      status: 'Active',
      version: '2026',
    },
    {
      id: 4,
      name: 'Orthopedic Surgery Guideline',
      description:
        'Clinical guidance for orthopedic procedures and rehabilitation.',
      source: 'Clinical Reference',
      updated: 'Sep 5, 2026',
      updatedAge: '19 days ago',
      status: 'Active',
      version: '2026',
    },
    {
      id: 5,
      name: 'Mental Health Guideline',
      description:
        'Clinical guidance for mental health services and treatment.',
      source: 'Clinical Reference',
      updated: 'Aug 28, 2026',
      updatedAge: '27 days ago',
      status: 'Active',
      version: '2026',
    },
  ]

  const addedGuidelines = getSavedArray(
    'addedGuidelines'
  ).map((guideline) => ({
    ...guideline,
    updated:
      guideline.updated ||
      guideline.date ||
      guideline.created ||
      'Recently',
    updatedAge: guideline.updatedAge || '',
    status: guideline.status || 'Active',
    version: guideline.version || 'Current',
    source: guideline.source || 'Reference',
  }))

  const deletedGuidelineIds =
    getSavedArray('deletedGuidelineIds')

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

  const mappedGuidelines = getGuidelinesForPolicies(
    selectedPolicies,
    allGuidelines
  )

  // ==========================================
  // POLICIES WITHOUT GUIDELINES
  // ==========================================

  const policiesWithoutGuidelines =
    selectedPolicies.filter(
      (policy) =>
        !mappedGuidelines.some((guideline) =>
          getPoliciesForGuideline(
            guideline,
            [policy]
          ).length > 0
        )
    )

  // ==========================================
  // SEARCH MAPPED GUIDELINES
  // ==========================================

  const [search, setSearch] = useState('')

  const visibleGuidelines =
    mappedGuidelines.filter((guideline) => {
      const matchingPolicies =
        getPoliciesForGuideline(
          guideline,
          selectedPolicies
        )

      const searchableText = [
        guideline.name,
        guideline.description || '',
        ...matchingPolicies.map(
          (policy) => policy.name
        ),
      ]
        .join(' ')
        .toLowerCase()

      return searchableText.includes(
        search.toLowerCase()
      )
    })

  // ==========================================
  // START REVIEW
  // ==========================================

  function startReview() {
    if (selectedPolicies.length === 0) {
      alert(
        'This review session does not have any valid policies selected.'
      )

      navigate('/reviews/new')
      return
    }

    if (mappedGuidelines.length === 0) {
      alert(
        'None of the selected policies have associated guidelines. Please select a policy with a mapped guideline before starting the review.'
      )
      return
    }

    // Save automatic guideline associations.
    localStorage.setItem(
      'selectedGuidelines',
      JSON.stringify(mappedGuidelines)
    )

    localStorage.setItem(
      'selectedPolicies',
      JSON.stringify(selectedPolicies)
    )

    localStorage.setItem(
      'guidelineMode',
      'automatic'
    )

    // ========================================
    // CREATE REVIEW SESSION
    // ========================================

    const newReview = {
      id: Date.now(),
      name: reviewName,
      description: reviewDescription,
      policies: selectedPolicies.length,
      selectedPolicies: selectedPolicies,
      guidelines: mappedGuidelines.length,
      selectedGuidelines: mappedGuidelines,
      guideline:
        mappedGuidelines.length === 1
          ? mappedGuidelines[0].name
          : `${mappedGuidelines.length} reference guidelines`,
      date: new Date().toLocaleDateString(
        'en-US',
        {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }
      ),
      age: 'Just now',
      status: 'In Review',
      findings: 3,
      reviewer: 'Sarah Chen',
    }

    // ========================================
    // SAVE REVIEW SESSION
    // ========================================

    const existingReviews =
      getSavedArray('createdReviews')

    const updatedReviews = [
      newReview,
      ...existingReviews,
    ]

    localStorage.setItem(
      'createdReviews',
      JSON.stringify(updatedReviews)
    )

    localStorage.setItem(
      'currentReview',
      JSON.stringify(newReview)
    )

    // Open review results.
    navigate('/reviews/findings')
  }

  // ==========================================
  // GO BACK
  // ==========================================

  function goBack() {
    localStorage.setItem(
      'selectedGuidelines',
      JSON.stringify(mappedGuidelines)
    )

    navigate('/reviews/new')
  }

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <div className="policy-selection-page">
      {/* BACKGROUND PAGE */}

      <div className="selection-background">
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
              <div className="user-avatar">
                SC
              </div>
              <span>Sarah Chen</span>
            </div>
          </div>
        </header>

        <div className="app-body">
          {/* SIDEBAR */}

          <aside className="sidebar">
            <Link
              to="/dashboard"
              className="nav-item"
            >
              Dashboard
            </Link>

            <Link
              to="/reviews"
              className="nav-item active"
            >
              Review Sessions
            </Link>

            <Link
              to="/policies"
              className="nav-item"
            >
              Policy Database
            </Link>

            <Link
              to="/guidelines"
              className="nav-item"
            >
              Guideline Database
            </Link>

            <Link
              to="/audit-log"
              className="nav-item"
            >
              Audit Log
            </Link>
          </aside>

          <main className="selection-background-content">
            <span>
              ← Back to Review Session
            </span>

            <h1>{reviewName}</h1>

            <p>
              Review the guidelines automatically
              associated with your selected policies.
            </p>

            <div className="background-card">
              <h2>Session Details</h2>
              <p>{reviewDescription}</p>
            </div>

            <div className="background-card">
              <h2>Policies</h2>

              <p>
                {selectedPolicies.length}{' '}
                {selectedPolicies.length === 1
                  ? 'policy selected'
                  : 'policies selected'}
              </p>
            </div>

            <div className="background-card">
              <h2>Reference Guidelines</h2>

              <p>
                {mappedGuidelines.length}{' '}
                automatically associated
              </p>
            </div>
          </main>
        </div>
      </div>

      {/* OVERLAY */}

      <div
        className="selection-overlay"
        onClick={goBack}
      ></div>

      {/* READ-ONLY GUIDELINE MODAL */}

      <div className="policy-selection-modal">
        {/* MODAL HEADER */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '20px',
            marginBottom: '8px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: '700',
                color: '#0078bf',
                marginBottom: '7px',
              }}
            >
              STEP 2 OF 3
            </div>

            <h1 style={{ marginBottom: '7px' }}>
              Reference Guidelines
            </h1>

            <p
              className="selection-subtitle"
              style={{ margin: 0 }}
            >
              These guidelines are automatically mapped
              to your selected policies. Review the
              associations before starting.
            </p>
          </div>

          <button
            type="button"
            onClick={goBack}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '22px',
              cursor: 'pointer',
              color: '#666',
            }}
            aria-label="Close guideline reference"
          >
            ×
          </button>
        </div>

        {/* SESSION SUMMARY */}

        <div
          style={{
            display: 'flex',
            gap: '24px',
            padding: '14px 16px',
            margin: '20px 0',
            background: '#f5f7f8',
            border: '1px solid #e1e4e6',
            borderRadius: '5px',
            fontSize: '13px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <span
              style={{
                color: '#777',
                display: 'block',
                marginBottom: '3px',
              }}
            >
              REVIEW SESSION
            </span>

            <strong>{reviewName}</strong>
          </div>

          <div>
            <span
              style={{
                color: '#777',
                display: 'block',
                marginBottom: '3px',
              }}
            >
              POLICIES
            </span>

            <strong>
              {selectedPolicies.length} selected
            </strong>
          </div>

          <div>
            <span
              style={{
                color: '#777',
                display: 'block',
                marginBottom: '3px',
              }}
            >
              GUIDELINES
            </span>

            <strong>
              {mappedGuidelines.length} automatically mapped
            </strong>
          </div>
        </div>

        {/* SEARCH + COUNT */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '18px',
          }}
        >
          <input
            type="text"
            placeholder="⌕   Search mapped guidelines..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            style={{
              flex: 1,
              minWidth: 0,
              padding: '10px 12px',
              border: '1px solid #cfcfcf',
              borderRadius: '4px',
              fontFamily: 'inherit',
            }}
          />

          <span
            style={{
              fontSize: '13px',
              fontWeight: '700',
              color: '#0078bf',
              whiteSpace: 'nowrap',
            }}
          >
            {mappedGuidelines.length}{' '}
            {mappedGuidelines.length === 1
              ? 'guideline mapped'
              : 'guidelines mapped'}
          </span>
        </div>

        {/* GUIDELINE TABLE */}

        <div className="selection-table">
          <div className="selection-table-header">
            <div></div>
            <div>GUIDELINE NAME</div>
            <div>VERSION</div>
            <div>LAST UPDATED</div>
            <div>STATUS</div>
          </div>

          {visibleGuidelines.map((guideline) => {
            const matchingPolicies =
              getPoliciesForGuideline(
                guideline,
                selectedPolicies
              )

            return (
              <div
                className="selection-table-row"
                key={guideline.id}
                style={{
                  cursor: 'default',
                }}
              >
                {/* AUTOMATICALLY INCLUDED */}

                <div className="selection-checkbox-cell">
                  <span
                    title="Automatically included"
                    style={{
                      color: '#0078bf',
                      fontWeight: 700,
                      fontSize: '18px',
                    }}
                  >
                    ✓
                  </span>
                </div>

                {/* GUIDELINE NAME + POLICIES */}

                <div className="selection-policy-name">
                  <strong>{guideline.name}</strong>

                  <p>{guideline.description}</p>

                  <div
                    style={{
                      marginTop: '8px',
                      fontSize: '12px',
                      color: '#475569',
                    }}
                  >
                    <strong>Applies to:</strong>{' '}
                    {matchingPolicies
                      .map((policy) => policy.name)
                      .join(', ')}
                  </div>
                </div>

                {/* VERSION */}

                <div className="selection-date">
                  <span>
                    {guideline.version || 'Current'}
                  </span>

                  <small>
                    {guideline.source || 'Reference'}
                  </small>
                </div>

                {/* LAST UPDATED */}

                <div className="selection-date">
                  <span>
                    {guideline.updated || 'Recently'}
                  </span>

                  <small>
                    {guideline.updatedAge || ''}
                  </small>
                </div>

                {/* STATUS */}

                <div>
                  <span className="status completed">
                    {guideline.status || 'Active'}
                  </span>
                </div>
              </div>
            )
          })}

          {visibleGuidelines.length === 0 && (
            <div
              style={{
                padding: '30px',
                textAlign: 'center',
                color: '#777',
              }}
            >
              {mappedGuidelines.length === 0
                ? 'No guidelines are mapped to the selected policies.'
                : 'No mapped guidelines match your search.'}
            </div>
          )}
        </div>

        {/* UNMAPPED POLICY WARNING */}

        {policiesWithoutGuidelines.length > 0 && (
          <div
            style={{
              marginTop: '18px',
              padding: '12px 14px',
              background: '#fff8e7',
              borderLeft: '3px solid #d97706',
              fontSize: '13px',
              lineHeight: '1.6',
              color: '#854d0e',
            }}
          >
            <strong>
              Policies without associated guidelines:
            </strong>

            <div style={{ marginTop: '6px' }}>
              {policiesWithoutGuidelines
                .map((policy) => policy.name)
                .join(', ')}
            </div>

            <div style={{ marginTop: '6px' }}>
              These policies currently have no mapped
              reference guideline.
            </div>
          </div>
        )}

        {/* EXPLANATION */}

        <div
          style={{
            marginTop: '18px',
            padding: '12px 14px',
            background: '#f8f8f8',
            borderLeft: '3px solid #0078bf',
            fontSize: '13px',
            lineHeight: '1.5',
            color: '#555',
          }}
        >
          <strong>
            How reference guidelines are used:
          </strong>{' '}
          The guidelines shown above are automatically
          associated with the selected policies.
          They will serve as reference material when
          the system screens the policies for potential
          changes. Guidelines cannot be manually
          changed during a review session.
        </div>

        {/* BOTTOM ACTIONS */}

        <div
          className="selection-confirm-row"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            className="cancel-review-button"
            onClick={goBack}
          >
            ← Back
          </button>

          <button
            type="button"
            className="confirm-selection-button"
            onClick={startReview}
            disabled={
              selectedPolicies.length === 0 ||
              mappedGuidelines.length === 0
            }
            style={{
              opacity:
                selectedPolicies.length === 0 ||
                mappedGuidelines.length === 0
                  ? 0.5
                  : 1,
              cursor:
                selectedPolicies.length === 0 ||
                mappedGuidelines.length === 0
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            Start Review →
          </button>
        </div>
      </div>
    </div>
  )
}

export default GuidelineSelectionPage
