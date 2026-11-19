
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getGuidelinesForPolicies,
  getPoliciesForGuideline,
} from '../data/guidelineMappings'

import './DashboardPage.css'
import './GuidelineSelectionPage.css'

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
// ORIGINAL POLICY DATABASE
// ==========================================

const originalPolicies = [
  { id: 1, name: 'Cardiac Coverage Policy' },
  { id: 2, name: 'Diabetes Treatment Policy' },
  { id: 3, name: 'Oncology Coverage Policy' },
  { id: 4, name: 'Orthopedic Surgery Policy' },
  { id: 5, name: 'Mental Health Coverage Policy' },
]

// ==========================================
// ORIGINAL GUIDELINE DATABASE
// ==========================================

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

function GuidelineSelectionPage() {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')

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

  const addedPolicies = getSavedArray('addedPolicies')
  const deletedPolicyIds = getSavedArray('deletedPolicyIds')

  const databasePolicies = [
    ...addedPolicies,
    ...originalPolicies,
  ]
    .filter(
      (policy) =>
        !deletedPolicyIds.some(
          (id) => String(id) === String(policy.id)
        )
    )
    .filter(
      (policy, index, array) =>
        array.findIndex(
          (item) => String(item.id) === String(policy.id)
        ) === index
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

  const deletedGuidelineIds = getSavedArray(
    'deletedGuidelineIds'
  )

  const allGuidelines = [
    ...addedGuidelines,
    ...originalGuidelines,
  ]
    .filter(
      (guideline) =>
        !deletedGuidelineIds.some(
          (id) => String(id) === String(guideline.id)
        )
    )
    .filter(
      (guideline, index, array) =>
        array.findIndex(
          (item) => String(item.id) === String(guideline.id)
        ) === index
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
        !mappedGuidelines.some(
          (guideline) =>
            getPoliciesForGuideline(
              guideline,
              [policy]
            ).length > 0
        )
    )

  // ==========================================
  // SEARCH MAPPED GUIDELINES
  // ==========================================

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
        search.toLowerCase().trim()
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

    localStorage.setItem(
      'createdReviews',
      JSON.stringify([
        newReview,
        ...existingReviews,
      ])
    )

    localStorage.setItem(
      'currentReview',
      JSON.stringify(newReview)
    )

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

  return (
    <div className="app-page ccf-dashboard ccf-guideline-selection-page">
      {/* GREEN HEADER */}
      <header className="top-bar">
        <div className="brand-area">
          <span className="brand-name">CCF</span>
          <span className="brand-divider" />
          <span className="workspace-name">
            Insurance Policy Review Workspace
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

          <Link to="/reviews" className="nav-item active">
            Review Sessions
          </Link>

          <Link to="/policies" className="nav-item">
            Policy Database
          </Link>

          <Link to="/guidelines" className="nav-item">
            Guideline Database
          </Link>

          <Link to="/mappings" className="nav-item">
            Document Mappings
          </Link>

          <Link to="/audit-log" className="nav-item">
            Audit Log
          </Link>
        </aside>

        {/* MAIN CONTENT */}
        <main className="ccf-guideline-selection-content">
          <button
            type="button"
            className="ccf-guideline-selection-back-link"
            onClick={goBack}
          >
            ← Back to Review Session
          </button>

          {/* PAGE TITLE */}
          <div className="ccf-guideline-selection-heading">
            <span className="ccf-guideline-selection-eyebrow">
              STEP 2 OF 3
            </span>

            <h1>Reference Guidelines</h1>

            <p>
              These guidelines are automatically mapped
              to your selected policies. Review the
              associations before starting your review.
            </p>
          </div>

          {/* SESSION SUMMARY */}
          <section className="ccf-guideline-selection-summary">
            <div>
              <span>REVIEW SESSION</span>
              <strong>{reviewName}</strong>
            </div>

            <div>
              <span>POLICIES</span>
              <strong>
                {selectedPolicies.length} selected
              </strong>
            </div>

            <div>
              <span>GUIDELINES</span>
              <strong>
                {mappedGuidelines.length} automatically mapped
              </strong>
            </div>
          </section>

          {/* REVIEW DESCRIPTION */}
          {reviewDescription && (
            <section className="ccf-guideline-selection-description">
              <strong>Session Description</strong>
              <p>{reviewDescription}</p>
            </section>
          )}

          {/* GUIDELINE TABLE CARD */}
          <section className="ccf-guideline-selection-card">
            <div className="ccf-guideline-selection-card-heading">
              <div>
                <h2>Automatically Mapped Guidelines</h2>

                <p>
                  Guidelines are associated using your
                  existing Document Mappings.
                </p>
              </div>

              <span className="ccf-guideline-selection-count">
                {mappedGuidelines.length}{' '}
                {mappedGuidelines.length === 1
                  ? 'guideline mapped'
                  : 'guidelines mapped'}
              </span>
            </div>

            {/* SEARCH */}
            <div className="ccf-guideline-selection-toolbar">
              <div className="ccf-guideline-selection-search">
                <span aria-hidden="true">⌕</span>

                <input
                  type="search"
                  placeholder="Search mapped guidelines..."
                  aria-label="Search mapped guidelines"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />
              </div>

              <span className="ccf-guideline-selection-readonly">
                <span aria-hidden="true">✓</span>
                Automatically selected
              </span>
            </div>

            {/* GUIDELINE TABLE */}
            <div className="ccf-guideline-selection-table-wrapper">
              <table className="ccf-guideline-selection-table">
                <thead>
                  <tr>
                    <th aria-label="Automatically included" />
                    <th>GUIDELINE NAME</th>
                    <th>VERSION</th>
                    <th>LAST UPDATED</th>
                    <th>STATUS</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleGuidelines.map((guideline) => {
                    const matchingPolicies =
                      getPoliciesForGuideline(
                        guideline,
                        selectedPolicies
                      )

                    return (
                      <tr key={guideline.id}>
                        <td>
                          <span
                            className="ccf-guideline-selection-check"
                            title="Automatically included"
                            aria-label="Automatically included"
                          >
                            ✓
                          </span>
                        </td>

                        <td>
                          <strong>
                            {guideline.name}
                          </strong>

                          <p>
                            {guideline.description || ''}
                          </p>

                          <div className="ccf-guideline-selection-applies">
                            <strong>Applies to:</strong>{' '}
                            {matchingPolicies
                              .map(
                                (policy) => policy.name
                              )
                              .join(', ')}
                          </div>
                        </td>

                        <td>
                          <strong className="ccf-guideline-selection-table-value">
                            {guideline.version || 'Current'}
                          </strong>

                          <small>
                            {guideline.source || 'Reference'}
                          </small>
                        </td>

                        <td>
                          <span>
                            {guideline.updated || 'Recently'}
                          </span>

                          {guideline.updatedAge && (
                            <small>
                              {guideline.updatedAge}
                            </small>
                          )}
                        </td>

                        <td>
                          <span className="ccf-guideline-selection-status">
                            {guideline.status || 'Active'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {visibleGuidelines.length === 0 && (
                <div className="ccf-guideline-selection-empty">
                  <strong>
                    {mappedGuidelines.length === 0
                      ? 'No mapped guidelines found'
                      : 'No matching guidelines'}
                  </strong>

                  <p>
                    {mappedGuidelines.length === 0
                      ? 'No guidelines are mapped to the selected policies. Check Document Mappings before starting the review.'
                      : 'Try searching for a different guideline or policy name.'}
                  </p>
                </div>
              )}
            </div>

            {/* UNMAPPED POLICY WARNING */}
            {policiesWithoutGuidelines.length > 0 && (
              <div className="ccf-guideline-selection-warning">
                <strong>
                  Policies without associated guidelines:
                </strong>

                <p>
                  {policiesWithoutGuidelines
                    .map((policy) => policy.name)
                    .join(', ')}
                </p>

                <p>
                  These policies currently have no
                  mapped reference guideline.
                </p>
              </div>
            )}

            {/* EXPLANATION */}
            <div className="ccf-guideline-selection-info">
              <strong>
                How reference guidelines are used:
              </strong>{' '}
              The guidelines shown above are automatically
              associated with the selected policies.
              They will serve as reference material for
              the policy review workflow. Guidelines cannot
              be manually changed during a review session.
            </div>

            {/* BOTTOM ACTIONS */}
            <div className="ccf-guideline-selection-actions">
              <button
                type="button"
                className="ccf-guideline-selection-cancel"
                onClick={goBack}
              >
                ← Back
              </button>

              <button
                type="button"
                className="ccf-guideline-selection-confirm"
                onClick={startReview}
                disabled={
                  selectedPolicies.length === 0 ||
                  mappedGuidelines.length === 0
                }
              >
                Start Review →
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default GuidelineSelectionPage
