
import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  getGuidelinesForPolicies,
  getGuidelinesForPolicy,
  getPoliciesForGuideline,
} from '../data/guidelineMappings'

import './DashboardPage.css'
import './ReviewFindingsPage.css'

// ==========================================
// READ LOCAL STORAGE SAFELY
// ==========================================

function getSavedArray(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function getSavedObject(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key))
    return data && typeof data === 'object' && !Array.isArray(data)
      ? data
      : null
  } catch {
    return null
  }
}

// ==========================================
// DEMONSTRATION FINDINGS
// These are examples, not actual AI results.
// ==========================================

const demonstrationFindings = [
  {
    id: 1,
    policyId: 1,
    guidelineId: 1,
    status: 'Suggested Change',
    priority: 'High',
    category: 'Coverage Criteria',
    policyCriterion: 'Criterion 4.2.1',
    guidelineCriterion: 'Criterion 4.2.1',
    summary:
      'Current policy criteria may be narrower than the selected reference guideline.',
    rationale:
      'The reference guideline includes an additional qualifying clinical pathway that is not clearly represented in the current policy language.',
    policyText:
      'Coverage is permitted for patients with symptomatic coronary artery disease who meet criteria A and B, including documented ischemia.',
    guidelineText:
      'Coverage is permitted for patients with symptomatic coronary artery disease who meet criteria A, B, and C, including documented ischemia or significant anatomical findings.',
    suggestedText:
      'Coverage is permitted for patients with symptomatic coronary artery disease who meet criteria A, B, or C, including documented ischemia or significant anatomical findings.',
  },
  {
    id: 2,
    policyId: 2,
    guidelineId: 2,
    status: 'Suggested Change',
    priority: 'Low',
    category: 'Prior Authorization',
    policyCriterion: 'Prior Authorization',
    guidelineCriterion: 'Criterion 7.1.2',
    summary:
      'Prior authorization wording should be clarified to better match the selected guideline.',
    rationale:
      'The policy and guideline are generally aligned, but the guideline provides clearer language regarding exceptions to prior authorization requirements.',
    policyText:
      'Prior authorization is required for advanced diabetes therapies, including GLP-1 agonists, except in certain cases.',
    guidelineText:
      'Prior authorization is required for advanced diabetes therapies, including GLP-1 agonists, with exceptions for patients meeting established continuation-of-therapy criteria.',
    suggestedText:
      'Prior authorization is required for advanced diabetes therapies, including GLP-1 agonists, except for patients who meet established continuation-of-therapy criteria.',
  },
  {
    id: 3,
    policyId: 3,
    guidelineId: 3,
    status: 'No Change Needed',
    priority: 'None',
    category: 'Clinical Eligibility',
    policyCriterion: 'Eligibility Criteria',
    guidelineCriterion: 'Clinical Eligibility',
    summary:
      'The reviewed policy language is consistent with the selected reference guideline.',
    rationale:
      'The demonstration screening did not identify a meaningful difference between the example policy criteria and example reference guideline.',
    policyText:
      'Coverage is available when clinical eligibility requirements and documented treatment criteria are satisfied.',
    guidelineText:
      'Coverage is appropriate when established clinical eligibility and treatment criteria are satisfied.',
    suggestedText: '',
  },
]

const navigation = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Review Sessions', path: '/reviews' },
  { label: 'Policy Database', path: '/policies' },
  { label: 'Guideline Database', path: '/guidelines' },
  { label: 'Document Mappings', path: '/mappings' },
  { label: 'Audit Log', path: '/audit-log' },
]

function ReviewFindingsPage() {
  const navigate = useNavigate()

  const [activeFilter, setActiveFilter] = useState('All')
  const [helpOpen, setHelpOpen] = useState(false)

  // ==========================================
  // CURRENT REVIEW SESSION
  // ==========================================

  const currentReview = getSavedObject('currentReview')

  const selectedPolicies = Array.isArray(
    currentReview?.selectedPolicies
  )
    ? currentReview.selectedPolicies
    : getSavedArray('selectedPolicies')

  const savedGuidelines = Array.isArray(
    currentReview?.selectedGuidelines
  )
    ? currentReview.selectedGuidelines
    : getSavedArray('selectedGuidelines')

  // Preserve the existing mapping behavior
  const selectedGuidelines = getGuidelinesForPolicies(
    selectedPolicies,
    savedGuidelines
  )

  const reviewName =
    currentReview?.name ||
    localStorage.getItem('newReviewName') ||
    'Policy Review Session'

  const reviewDescription = currentReview?.description || ''

  // ==========================================
  // SAVED REVIEWER DECISIONS
  // ==========================================

  const recommendationDecisions = getSavedArray(
    'recommendationDecisions'
  )

  function getDecision(result) {
    return recommendationDecisions.find(
      (decision) =>
        String(decision.reviewId) ===
          String(currentReview?.id ?? null) &&
        String(decision.findingId) === String(result.id)
    )
  }

  // ==========================================
  // MATCH FINDINGS TO SELECTED REFERENCES
  // ==========================================

  const results = demonstrationFindings
    .map((finding) => {
      const matchingPolicy = selectedPolicies.find(
        (policy) =>
          String(policy.id) === String(finding.policyId)
      )

      const matchingGuideline = selectedGuidelines.find(
        (guideline) =>
          String(guideline.id) === String(finding.guidelineId)
      )

      if (!matchingPolicy || !matchingGuideline) {
        return null
      }

      const associatedGuidelines = getGuidelinesForPolicy(
        matchingPolicy,
        selectedGuidelines
      )

      const isMapped = associatedGuidelines.some(
        (guideline) =>
          String(guideline.id) ===
          String(matchingGuideline.id)
      )

      if (!isMapped) {
        return null
      }

      return {
        ...finding,
        policy:
          matchingPolicy.name ||
          matchingPolicy.fileName ||
          'Unnamed Policy',
        guideline:
          matchingGuideline.name || 'Unnamed Guideline',
      }
    })
    .filter(Boolean)

  // ==========================================
  // SUMMARY COUNTS
  // ==========================================

  const highPriorityCount = results.filter(
    (result) =>
      result.status === 'Suggested Change' &&
      result.priority === 'High'
  ).length

  const lowPriorityCount = results.filter(
    (result) =>
      result.status === 'Suggested Change' &&
      result.priority === 'Low'
  ).length

  const noChangeCount = results.filter(
    (result) => result.status === 'No Change Needed'
  ).length

  const actionCount = results.filter(
    (result) =>
      result.status === 'Suggested Change' &&
      !getDecision(result)
  ).length

  const decidedCount = results.filter(
    (result) =>
      result.status === 'Suggested Change' &&
      Boolean(getDecision(result))
  ).length

  const totalSuggestedChanges =
    highPriorityCount + lowPriorityCount

  // ==========================================
  // FILTER FINDINGS
  // ==========================================

  const visibleResults = results.filter((result) => {
    if (activeFilter === 'All') return true

    if (activeFilter === 'Needs Attention') {
      return (
        result.status === 'Suggested Change' &&
        !getDecision(result)
      )
    }

    if (activeFilter === 'Decided') {
      return Boolean(getDecision(result))
    }

    if (activeFilter === 'High Priority') {
      return (
        result.status === 'Suggested Change' &&
        result.priority === 'High'
      )
    }

    if (activeFilter === 'Low Priority') {
      return (
        result.status === 'Suggested Change' &&
        result.priority === 'Low'
      )
    }

    if (activeFilter === 'No Change Needed') {
      return result.status === 'No Change Needed'
    }

    return true
  })

  // ==========================================
  // OPEN RECOMMENDATION EDITOR
  // ==========================================

  function openRecommendation(result) {
    localStorage.setItem(
      'currentFinding',
      JSON.stringify(result)
    )

    navigate(`/reviews/findings/${result.id}/edit`)
  }

  // ==========================================
  // COMPLETE REVIEW SESSION
  // ==========================================

  function completeReview() {
    if (!currentReview) {
      navigate('/reviews')
      return
    }

    if (results.length === 0) {
      const confirmed = window.confirm(
        'No demonstration findings were generated for these policies. This does not mean the policies have been clinically screened. Complete the review session anyway?'
      )

      if (!confirmed) return
    } else if (actionCount > 0) {
      const continueAnyway = window.confirm(
        `${actionCount} ${
          actionCount === 1
            ? 'recommendation still requires'
            : 'recommendations still require'
        } a reviewer decision. Complete this review session anyway?`
      )

      if (!continueAnyway) return
    } else {
      const confirmed = window.confirm(
        'All demonstration recommendations have been reviewed. Mark this review session as completed?'
      )

      if (!confirmed) return
    }

    const completedReview = {
      ...currentReview,
      status: 'Completed',
      findings: results.length,
    }

    const savedReviews = getSavedArray('createdReviews')

    const updatedReviews = savedReviews.map((review) => {
      if (String(review.id) === String(currentReview.id)) {
        return {
          ...review,
          status: 'Completed',
          findings: results.length,
        }
      }

      return review
    })

    localStorage.setItem(
      'createdReviews',
      JSON.stringify(updatedReviews)
    )

    localStorage.setItem(
      'currentReview',
      JSON.stringify(completedReview)
    )

    navigate('/reviews')
  }

  const filters = [
    { name: 'All', count: results.length },
    { name: 'Needs Attention', count: actionCount },
    { name: 'Decided', count: decidedCount },
    { name: 'High Priority', count: highPriorityCount },
    { name: 'Low Priority', count: lowPriorityCount },
    { name: 'No Change Needed', count: noChangeCount },
  ]

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <div className="app-page ccf-review-findings-page">
      {/* GREEN CCF HEADER */}
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
            className="ccf-findings-help-button"
            aria-label="Help with review findings"
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
        <aside className="sidebar">
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={() =>
                `nav-item${
                  item.path === '/reviews' ? ' active' : ''
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </aside>

        {/* MAIN CONTENT */}
        <main className="review-findings-content">
          <Link
            to="/reviews"
            className="ccf-findings-back-link"
          >
            ← Back to Review Sessions
          </Link>

          {/* PAGE HEADING */}
          <div className="ccf-findings-title-row">
            <div>
              <div className="ccf-findings-eyebrow">
                REVIEW RESULTS
              </div>

              <h1>{reviewName}</h1>

              <p className="ccf-findings-subtitle">
                Review the demonstration screening findings
                and take action on suggested policy changes.
              </p>

              {reviewDescription && (
                <p className="ccf-findings-description">
                  {reviewDescription}
                </p>
              )}
            </div>

            {currentReview?.status !== 'Completed' && (
              <button
                type="button"
                className="ccf-findings-primary-button"
                onClick={completeReview}
              >
                Complete Review Session
              </button>
            )}
          </div>

          {/* DEMONSTRATION NOTICE */}
          <section className="ccf-findings-demo-notice">
            <strong>Demonstration results:</strong>{' '}
            This page currently uses sample screening
            findings. The policy-to-guideline associations
            are based on the selected review references,
            but no real clinical document comparison has
            been performed.
          </section>

          {/* SUMMARY CARDS */}
          <section className="ccf-findings-stats">
            <div className="ccf-findings-stat-card">
              <span>POLICIES REVIEWED</span>
              <strong>{selectedPolicies.length}</strong>
            </div>

            <div className="ccf-findings-stat-card high">
              <span>HIGH PRIORITY</span>
              <strong>{highPriorityCount}</strong>
            </div>

            <div className="ccf-findings-stat-card low">
              <span>LOW PRIORITY</span>
              <strong>{lowPriorityCount}</strong>
            </div>

            <div className="ccf-findings-stat-card no-change">
              <span>NO CHANGE NEEDED</span>
              <strong>{noChangeCount}</strong>
            </div>
          </section>

          {/* REVIEW STATUS */}
          {actionCount > 0 ? (
            <section className="ccf-findings-status warning">
              <div>
                <strong>
                  {actionCount}{' '}
                  {actionCount === 1
                    ? 'recommendation requires'
                    : 'recommendations require'}{' '}
                  reviewer attention.
                </strong>

                <p>
                  Review each suggested change before
                  completing this session.
                </p>
              </div>

              <span>ACTION REQUIRED</span>
            </section>
          ) : (
            <section className="ccf-findings-status success">
              <div>
                <strong>
                  {totalSuggestedChanges === 0
                    ? 'No demonstration recommendations require a decision.'
                    : 'All demonstration recommendations have been reviewed.'}
                </strong>

                <p>
                  {results.length === 0
                    ? 'No sample findings are available for these selected policies. This does not indicate clinical approval.'
                    : 'There are no outstanding reviewer decisions for the available demonstration findings.'}
                </p>
              </div>

              <span>NO PENDING ACTIONS</span>
            </section>
          )}

          {/* POLICIES AND GUIDELINES */}
          <section className="ccf-findings-references">
            <div>
              <h3>Policies Reviewed</h3>

              {selectedPolicies.length > 0 ? (
                selectedPolicies.map((policy) => {
                  const associatedGuidelines =
                    getGuidelinesForPolicy(
                      policy,
                      selectedGuidelines
                    )

                  return (
                    <div
                      className="ccf-findings-reference-item"
                      key={policy.id}
                    >
                      <strong>
                        • {policy.name || policy.fileName}
                      </strong>

                      <p>
                        {associatedGuidelines.length > 0
                          ? `Mapped to: ${associatedGuidelines
                              .map(
                                (guideline) => guideline.name
                              )
                              .join(', ')}`
                          : 'No associated guidelines'}
                      </p>
                    </div>
                  )
                })
              ) : (
                <p>No policies selected.</p>
              )}
            </div>

            <div>
              <h3>Reference Guidelines</h3>

              {selectedGuidelines.length > 0 ? (
                selectedGuidelines.map((guideline) => {
                  const associatedPolicies =
                    getPoliciesForGuideline(
                      guideline,
                      selectedPolicies
                    )

                  return (
                    <div
                      className="ccf-findings-reference-item"
                      key={guideline.id}
                    >
                      <strong>• {guideline.name}</strong>

                      <p>
                        Applies to:{' '}
                        {associatedPolicies
                          .map((policy) => policy.name)
                          .join(', ')}
                      </p>
                    </div>
                  )
                })
              ) : (
                <p>
                  No automatically associated guidelines.
                </p>
              )}
            </div>
          </section>

          {/* FILTER BUTTONS */}
          <section className="ccf-findings-filters">
            <strong>Show:</strong>

            {filters.map((filter) => (
              <button
                key={filter.name}
                type="button"
                className={`ccf-findings-filter-button${
                  activeFilter === filter.name
                    ? ' active'
                    : ''
                }`}
                onClick={() =>
                  setActiveFilter(filter.name)
                }
              >
                {filter.name} ({filter.count})
              </button>
            ))}
          </section>

          {/* FINDING CARDS */}
          <section className="ccf-findings-results">
            {visibleResults.map((result) => {
              const highPriority =
                result.priority === 'High'

              const noChange =
                result.status === 'No Change Needed'

              const decision = getDecision(result)

              const isAccepted =
                decision?.decision === 'Accepted' ||
                decision?.decision === 'Accepted with Edits'

              const isRejected =
                decision?.decision === 'Rejected'

              let cardType = highPriority ? 'high' : 'low'

              if (noChange || isAccepted) {
                cardType = 'success'
              } else if (decision) {
                cardType = 'decided'
              }

              return (
                <article
                  key={result.id}
                  className={`ccf-findings-result-card ${cardType}`}
                >
                  <div className="ccf-findings-result-content">
                    <div className="ccf-findings-result-main">
                      <div className="ccf-findings-badges">
                        <span
                          className={`ccf-findings-badge ${
                            noChange
                              ? 'success'
                              : highPriority
                                ? 'high'
                                : 'low'
                          }`}
                        >
                          {result.status}
                        </span>

                        {!noChange && (
                          <span
                            className={`ccf-findings-priority ${
                              highPriority ? 'high' : 'low'
                            }`}
                          >
                            {result.priority.toUpperCase()}{' '}
                            PRIORITY
                          </span>
                        )}

                        {decision && (
                          <span
                            className={`ccf-findings-badge ${
                              isAccepted
                                ? 'success'
                                : 'decided'
                            }`}
                          >
                            {isAccepted
                              ? '✓ '
                              : isRejected
                                ? '✕ '
                                : ''}
                            {decision.decision}
                          </span>
                        )}
                      </div>

                      <h2>{result.policy}</h2>

                      <p className="ccf-findings-result-meta">
                        {result.category}
                        {' • '}
                        Reference: {result.guideline}
                      </p>

                      <p className="ccf-findings-result-summary">
                        {result.summary}
                      </p>

                      <p className="ccf-findings-result-criteria">
                        Policy section:{' '}
                        <strong>
                          {result.policyCriterion}
                        </strong>
                        {' • '}
                        Guideline section:{' '}
                        <strong>
                          {result.guidelineCriterion}
                        </strong>
                      </p>
                    </div>

                    <div className="ccf-findings-result-action">
                      {noChange ? (
                        <strong className="ccf-findings-no-action">
                          ✓ No action required
                        </strong>
                      ) : (
                        <>
                          {decision && (
                            <strong className="ccf-findings-decided-label">
                              {isAccepted ? '✓' : '✕'}{' '}
                              Decision recorded
                            </strong>
                          )}

                          <button
                            type="button"
                            className="ccf-findings-outline-button"
                            onClick={() =>
                              openRecommendation(result)
                            }
                          >
                            {decision
                              ? 'View Recommendation'
                              : 'Review Recommendation'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}

            {visibleResults.length === 0 && (
              <div className="ccf-findings-empty">
                {results.length === 0 ? (
                  <>
                    <strong>
                      No demonstration findings available.
                    </strong>

                    <p>
                      Your selected policies and their mapped
                      guidelines are listed above. The current
                      demo only contains example findings for
                      Cardiac, Diabetes, and Oncology policies.
                      A screening engine would be needed to
                      generate findings for other policies.
                    </p>
                  </>
                ) : (
                  <p>No results match this filter.</p>
                )}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* HELP DIALOG */}
      {helpOpen && (
        <div
          className="ccf-findings-help-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setHelpOpen(false)
            }
          }}
        >
          <div
            className="ccf-findings-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="findings-help-title"
          >
            <div className="ccf-findings-help-heading">
              <h2 id="findings-help-title">
                Understanding Review Findings
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
              This page displays demonstration findings
              associated with the selected policy and
              its mapped guidelines.
            </p>

            <p>
              Use the filters to view findings by priority
              or reviewer decision status.
            </p>

            <p>
              Click Review Recommendation to record a
              decision. You can complete the review session
              once you are ready.
            </p>

            <button
              type="button"
              className="ccf-findings-primary-button"
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

export default ReviewFindingsPage
