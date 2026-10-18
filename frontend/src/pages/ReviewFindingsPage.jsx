
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getGuidelinesForPolicies,
  getGuidelinesForPolicy,
  getPoliciesForGuideline,
} from '../data/guidelineMappings'

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
// Each example belongs to a specific demo policy.
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

function ReviewFindingsPage() {
  const navigate = useNavigate()

  // ==========================================
  // CURRENT REVIEW SESSION
  // ==========================================

  const currentReview = getSavedObject('currentReview')

  const selectedPolicies = Array.isArray(
    currentReview?.selectedPolicies
  )
    ? currentReview.selectedPolicies
    : getSavedArray('selectedPolicies')

  // ==========================================
  // GUIDELINES SAVED WITH THE REVIEW
  // ==========================================

  const savedGuidelines = Array.isArray(
    currentReview?.selectedGuidelines
  )
    ? currentReview.selectedGuidelines
    : getSavedArray('selectedGuidelines')

  // Recalculate associations using the shared mapping
  // logic. The review's saved guidelines are used so
  // historical reviews do not depend on newly added
  // guidelines from other sessions.

  const selectedGuidelines = getGuidelinesForPolicies(
    selectedPolicies,
    savedGuidelines
  )

  const reviewName =
    currentReview?.name ||
    localStorage.getItem('newReviewName') ||
    'Policy Review Session'

  const reviewDescription =
    currentReview?.description || ''

  // ==========================================
  // FILTER
  // ==========================================

  const [activeFilter, setActiveFilter] = useState('All')

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
  // MATCH DEMONSTRATION FINDINGS
  // TO ACTUAL POLICY/GUIDELINE PAIRS
  // ==========================================

  const results = demonstrationFindings
    .map((finding) => {
      const matchingPolicy = selectedPolicies.find(
        (policy) =>
          String(policy.id) === String(finding.policyId)
      )

      const matchingGuideline = selectedGuidelines.find(
        (guideline) =>
          String(guideline.id) ===
          String(finding.guidelineId)
      )

      if (!matchingPolicy || !matchingGuideline) {
        return null
      }

      // Double-check the actual policy-to-guideline
      // relationship before showing the finding.

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
          matchingGuideline.name ||
          'Unnamed Guideline',
      }
    })
    .filter(Boolean)

  // ==========================================
  // COUNTS
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
  // FILTER RESULTS
  // ==========================================

  const visibleResults = results.filter((result) => {
    if (activeFilter === 'All') {
      return true
    }

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

  // ==========================================
  // COMMON STYLES
  // ==========================================

  const summaryCardStyle = {
    background: '#ffffff',
    border: '1px solid #dddddd',
    borderRadius: '6px',
    padding: '18px',
  }

  const summaryLabelStyle = {
    fontSize: '12px',
    color: '#777',
    fontWeight: '700',
    marginBottom: '8px',
  }

  const summaryNumberStyle = {
    fontSize: '27px',
    fontWeight: '700',
  }

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <div className="app-page">
      {/* TOP BAR */}

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

        {/* MAIN CONTENT */}

        <main className="review-findings-content">
          <Link to="/reviews" className="back-link">
            ← Back to Review Sessions
          </Link>

          {/* TITLE */}

          <div className="findings-title-row">
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#0078bf',
                  marginBottom: '6px',
                }}
              >
                REVIEW RESULTS
              </div>

              <h1>{reviewName}</h1>

              <p className="review-findings-subtitle">
                Review the demonstration screening findings
                and take action on suggested policy changes.
              </p>

              {reviewDescription && (
                <p
                  style={{
                    fontSize: '13px',
                    color: '#64748b',
                    marginTop: '8px',
                  }}
                >
                  {reviewDescription}
                </p>
              )}
            </div>

            {currentReview?.status !== 'Completed' && (
              <button
                type="button"
                className="complete-review-button"
                onClick={completeReview}
              >
                Complete Review Session
              </button>
            )}
          </div>

          {/* DEMO NOTICE */}

          <section
            style={{
              padding: '12px 16px',
              marginTop: '20px',
              background: '#f8fafc',
              border: '1px solid #dbe3eb',
              borderLeft: '4px solid #64748b',
              borderRadius: '4px',
              fontSize: '13px',
              lineHeight: '1.6',
              color: '#475569',
            }}
          >
            <strong>Demonstration results:</strong>{' '}
            This page currently uses sample screening
            findings. The policy-to-guideline associations
            are based on the selected review references,
            but no real clinical document comparison has
            been performed.
          </section>

          {/* REVIEW SUMMARY */}

          <section
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '14px',
              margin: '24px 0',
            }}
          >
            <div style={summaryCardStyle}>
              <div style={summaryLabelStyle}>
                POLICIES REVIEWED
              </div>

              <div style={summaryNumberStyle}>
                {selectedPolicies.length}
              </div>
            </div>

            <div
              style={{
                ...summaryCardStyle,
                background: '#fff7f7',
                borderColor: '#e6b7b7',
              }}
            >
              <div
                style={{
                  ...summaryLabelStyle,
                  color: '#8c2d2d',
                }}
              >
                HIGH PRIORITY
              </div>

              <div
                style={{
                  ...summaryNumberStyle,
                  color: '#9f2424',
                }}
              >
                {highPriorityCount}
              </div>
            </div>

            <div
              style={{
                ...summaryCardStyle,
                background: '#fffaf0',
                borderColor: '#e5d2a6',
              }}
            >
              <div
                style={{
                  ...summaryLabelStyle,
                  color: '#8a6418',
                }}
              >
                LOW PRIORITY
              </div>

              <div
                style={{
                  ...summaryNumberStyle,
                  color: '#8a6418',
                }}
              >
                {lowPriorityCount}
              </div>
            </div>

            <div
              style={{
                ...summaryCardStyle,
                background: '#f4faf5',
                borderColor: '#b9d7bd',
              }}
            >
              <div
                style={{
                  ...summaryLabelStyle,
                  color: '#387644',
                }}
              >
                NO CHANGE NEEDED
              </div>

              <div
                style={{
                  ...summaryNumberStyle,
                  color: '#387644',
                }}
              >
                {noChangeCount}
              </div>
            </div>
          </section>

          {/* REVIEW STATUS */}

          {actionCount > 0 ? (
            <section
              style={{
                padding: '14px 18px',
                marginBottom: '20px',
                background: '#fff8e7',
                border: '1px solid #e5cf93',
                borderLeft: '4px solid #c38b13',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '20px',
              }}
            >
              <div>
                <strong>
                  {actionCount}{' '}
                  {actionCount === 1
                    ? 'recommendation requires'
                    : 'recommendations require'}{' '}
                  reviewer attention.
                </strong>

                <div
                  style={{
                    fontSize: '13px',
                    color: '#666',
                    marginTop: '3px',
                  }}
                >
                  Review each suggested change before
                  completing this session.
                </div>
              </div>

              <span
                style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#8a6418',
                  whiteSpace: 'nowrap',
                }}
              >
                ACTION REQUIRED
              </span>
            </section>
          ) : (
            <section
              style={{
                padding: '14px 18px',
                marginBottom: '20px',
                background: '#f4faf5',
                border: '1px solid #b9d7bd',
                borderLeft: '4px solid #4e8b59',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '20px',
              }}
            >
              <div>
                <strong>
                  {totalSuggestedChanges === 0
                    ? 'No demonstration recommendations require a decision.'
                    : 'All demonstration recommendations have been reviewed.'}
                </strong>

                <div
                  style={{
                    fontSize: '13px',
                    color: '#666',
                    marginTop: '3px',
                  }}
                >
                  {results.length === 0
                    ? 'No sample findings are available for these selected policies. This does not indicate clinical approval.'
                    : 'There are no outstanding reviewer decisions for the available demonstration findings.'}
                </div>
              </div>

              <span
                style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#387644',
                  whiteSpace: 'nowrap',
                }}
              >
                NO PENDING ACTIONS
              </span>
            </section>
          )}

          {/* SESSION REFERENCES */}

          <section className="findings-selection-summary">
            <div className="findings-summary-column">
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
                      key={policy.id}
                      style={{
                        marginBottom: '15px',
                      }}
                    >
                      <p
                        style={{
                          fontWeight: '600',
                          marginBottom: '4px',
                        }}
                      >
                        • {policy.name || policy.fileName}
                      </p>

                      <div
                        style={{
                          fontSize: '12px',
                          color: '#64748b',
                          paddingLeft: '14px',
                          lineHeight: '1.6',
                        }}
                      >
                        {associatedGuidelines.length > 0
                          ? `Mapped to: ${associatedGuidelines
                              .map(
                                (guideline) =>
                                  guideline.name
                              )
                              .join(', ')}`
                          : 'No associated guidelines'}
                      </div>
                    </div>
                  )
                })
              ) : (
                <p>• No policies selected</p>
              )}
            </div>

            <div className="findings-summary-divider"></div>

            <div className="findings-summary-column">
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
                      key={guideline.id}
                      style={{
                        marginBottom: '15px',
                      }}
                    >
                      <p
                        style={{
                          fontWeight: '600',
                          marginBottom: '4px',
                        }}
                      >
                        • {guideline.name}
                      </p>

                      <div
                        style={{
                          fontSize: '12px',
                          color: '#64748b',
                          paddingLeft: '14px',
                          lineHeight: '1.6',
                        }}
                      >
                        Applies to:{' '}
                        {associatedPolicies
                          .map((policy) => policy.name)
                          .join(', ')}
                      </div>
                    </div>
                  )
                })
              ) : (
                <p>
                  • No automatically associated guidelines
                </p>
              )}
            </div>
          </section>

          {/* FILTERS */}

          <section
            style={{
              marginTop: '24px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: '13px',
                fontWeight: '700',
                marginRight: '4px',
              }}
            >
              Show:
            </span>

            {[
              {
                name: 'All',
                count: results.length,
              },
              {
                name: 'Needs Attention',
                count: actionCount,
              },
              {
                name: 'Decided',
                count: decidedCount,
              },
              {
                name: 'High Priority',
                count: highPriorityCount,
              },
              {
                name: 'Low Priority',
                count: lowPriorityCount,
              },
              {
                name: 'No Change Needed',
                count: noChangeCount,
              },
            ].map((filter) => (
              <button
                key={filter.name}
                type="button"
                className={
                  activeFilter === filter.name
                    ? 'finding-filter-button active'
                    : 'finding-filter-button'
                }
                onClick={() =>
                  setActiveFilter(filter.name)
                }
              >
                {filter.name} ({filter.count})
              </button>
            ))}
          </section>

          {/* FINDING CARDS */}

          <section
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              paddingBottom: '30px',
            }}
          >
            {visibleResults.map((result) => {
              const highPriority =
                result.priority === 'High'

              const noChange =
                result.status === 'No Change Needed'

              const decision = getDecision(result)

              const isAccepted =
                decision?.decision === 'Accepted' ||
                decision?.decision ===
                  'Accepted with Edits'

              const isRejected =
                decision?.decision === 'Rejected'

              return (
                <div
                  key={result.id}
                  style={{
                    background: '#ffffff',
                    border: decision
                      ? isAccepted
                        ? '1px solid #b9d7bd'
                        : '1px solid #d4d4d4'
                      : noChange
                      ? '1px solid #b9d7bd'
                      : highPriority
                      ? '1px solid #dfb0b0'
                      : '1px solid #e2d0a6',
                    borderLeft: decision
                      ? isAccepted
                        ? '5px solid #4e8b59'
                        : '5px solid #777777'
                      : noChange
                      ? '5px solid #4e8b59'
                      : highPriority
                      ? '5px solid #b53939'
                      : '5px solid #c18a20',
                    borderRadius: '5px',
                    padding: '18px 20px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '24px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        minWidth: '250px',
                      }}
                    >
                      {/* STATUS */}

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexWrap: 'wrap',
                          marginBottom: '9px',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 9px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '700',
                            background: noChange
                              ? '#eaf5ec'
                              : highPriority
                              ? '#f9e5e5'
                              : '#fff2d5',
                            color: noChange
                              ? '#387644'
                              : highPriority
                              ? '#9f2424'
                              : '#8a6418',
                          }}
                        >
                          {result.status}
                        </span>

                        {!noChange && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              color: highPriority
                                ? '#9f2424'
                                : '#8a6418',
                            }}
                          >
                            {result.priority.toUpperCase()}{' '}
                            PRIORITY
                          </span>
                        )}

                        {decision && (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '4px 9px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: isAccepted
                                ? '#eaf5ec'
                                : '#eeeeee',
                              color: isAccepted
                                ? '#387644'
                                : '#555555',
                            }}
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

                      {/* POLICY NAME */}

                      <h2
                        style={{
                          fontSize: '17px',
                          margin: '0 0 5px',
                        }}
                      >
                        {result.policy}
                      </h2>

                      {/* MATCHED GUIDELINE */}

                      <div
                        style={{
                          fontSize: '12px',
                          color: '#777',
                          marginBottom: '12px',
                        }}
                      >
                        {result.category}
                        {'  •  '}
                        Reference: {result.guideline}
                      </div>

                      {/* SUMMARY */}

                      <p
                        style={{
                          margin: '0 0 12px',
                          lineHeight: '1.5',
                          color: '#444',
                        }}
                      >
                        {result.summary}
                      </p>

                      {/* CRITERIA */}

                      <div
                        style={{
                          fontSize: '12px',
                          color: '#777',
                        }}
                      >
                        Policy section:{' '}
                        <strong>
                          {result.policyCriterion}
                        </strong>

                        {'  •  '}

                        Guideline section:{' '}
                        <strong>
                          {result.guidelineCriterion}
                        </strong>
                      </div>
                    </div>

                    {/* ACTION */}

                    <div
                      style={{
                        minWidth: '190px',
                        textAlign: 'right',
                      }}
                    >
                      {noChange ? (
                        <div
                          style={{
                            color: '#387644',
                            fontSize: '13px',
                            fontWeight: '700',
                            paddingTop: '8px',
                          }}
                        >
                          ✓ No action required
                        </div>
                      ) : decision ? (
                        <div>
                          <div
                            style={{
                              fontSize: '13px',
                              fontWeight: '700',
                              color: isAccepted
                                ? '#387644'
                                : '#555555',
                              marginBottom: '9px',
                            }}
                          >
                            {isAccepted
                              ? '✓ Decision recorded'
                              : '✕ Decision recorded'}
                          </div>

                          <button
                            type="button"
                            className="view-edit-report-button"
                            onClick={() =>
                              openRecommendation(result)
                            }
                          >
                            View Recommendation
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="view-edit-report-button"
                          onClick={() =>
                            openRecommendation(result)
                          }
                        >
                          Review Recommendation
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {visibleResults.length === 0 && (
              <div
                style={{
                  padding: '35px',
                  textAlign: 'center',
                  background: '#ffffff',
                  border: '1px solid #dddddd',
                  borderRadius: '5px',
                  color: '#64748b',
                  lineHeight: '1.6',
                }}
              >
                {results.length === 0 ? (
                  <>
                    <strong>
                      No demonstration findings available.
                    </strong>

                    <p style={{ marginTop: '8px' }}>
                      Your selected policies and their mapped
                      guidelines are listed above. The current
                      demo only contains example findings for
                      Cardiac, Diabetes, and Oncology policies.
                      A screening engine would be needed to
                      generate findings for other policies.
                    </p>
                  </>
                ) : (
                  'No results match this filter.'
                )}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

export default ReviewFindingsPage
