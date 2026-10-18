import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'

function getSavedArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function getSavedObject(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || null
  } catch {
    return null
  }
}

function PolicyReviewEditingPage() {
  const navigate = useNavigate()

  // ==========================================
  // CURRENT FINDING
  // ==========================================

  const currentFinding = getSavedObject('currentFinding') || {
    id: 1,
    policy: 'Cardiac Coverage Policy',
    policyCriterion: 'Criterion 4.2.1',
    guideline: '2026 Cardiac Coverage Guideline',
    guidelineCriterion: 'Criterion 4.2.1',
    status: 'Suggested Change',
    priority: 'High',
    category: 'Coverage Criteria',
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
  }

  // ==========================================
  // REVIEW SESSION
  // ==========================================

  const currentReview = getSavedObject('currentReview')

  const reviewName =
    currentReview?.name || 'Policy Review Session'

  // ==========================================
  // EXISTING DECISION
  // ==========================================

  const existingDecision = getSavedArray(
    'recommendationDecisions'
  ).find(
    (item) =>
      String(item.reviewId) ===
        String(currentReview?.id || null) &&
      String(item.findingId) ===
        String(currentFinding.id)
  )

  // ==========================================
  // PAGE STATE
  // ==========================================

  const [isEditing, setIsEditing] = useState(false)

  const [editedText, setEditedText] = useState(
    existingDecision?.decision === 'Accepted with Edits'
      ? existingDecision.finalText
      : currentFinding.suggestedText ||
          currentFinding.guidelineText ||
          currentFinding.policyText ||
          ''
  )

  const [decisionRationale, setDecisionRationale] = useState(
    existingDecision?.decisionRationale || ''
  )

  const [rationaleError, setRationaleError] = useState(false)

  // ==========================================
  // VALIDATE RATIONALE
  // ==========================================

  function validateRationale() {
    if (!decisionRationale.trim()) {
      setRationaleError(true)

      alert(
        'Please enter a decision rationale before saving your decision.'
      )

      return false
    }

    setRationaleError(false)
    return true
  }

  // ==========================================
  // SAVE RECOMMENDATION DECISION
  // ==========================================

  function saveDecision(decision, finalText = '') {
    const existingDecisions = getSavedArray(
      'recommendationDecisions'
    )

    const timestamp = new Date().toISOString()

    const newDecision = {
      id: Date.now(),
      reviewId: currentReview?.id || null,
      reviewName,
      findingId: currentFinding.id,
      policy: currentFinding.policy,
      policyCriterion: currentFinding.policyCriterion,
      guideline: currentFinding.guideline,
      priority: currentFinding.priority,
      decision,
      decisionRationale: decisionRationale.trim(),
      finalText,
      decidedAt: timestamp,
      reviewer: 'Sarah Chen',
    }

    // Keep only the latest decision for this
    // recommendation in the review results.

    const otherDecisions = existingDecisions.filter(
      (item) =>
        !(
          String(item.reviewId) ===
            String(currentReview?.id || null) &&
          String(item.findingId) ===
            String(currentFinding.id)
        )
    )

    localStorage.setItem(
      'recommendationDecisions',
      JSON.stringify([...otherDecisions, newDecision])
    )

    // ==========================================
    // RECORD DECISION IN AUDIT LOG
    // ==========================================

    const existingEvents = getSavedArray('auditEvents')

    const auditEvent = {
      id: `decision-${Date.now()}`,
      type: 'Recommendation Decision',
      action: decision,
      description: `${decision} recommendation for ${currentFinding.policy}`,
      policy: currentFinding.policy,
      guideline: currentFinding.guideline,
      reviewId: currentReview?.id || null,
      reviewName,
      findingId: currentFinding.id,
      decision,
      decisionRationale: decisionRationale.trim(),
      rationale: decisionRationale.trim(),
      reviewer: 'Sarah Chen',
      user: 'Sarah Chen',
      timestamp,
      createdAt: timestamp,
    }

    localStorage.setItem(
      'auditEvents',
      JSON.stringify([...existingEvents, auditEvent])
    )
  }

  // ==========================================
  // CREATE POLICY VERSION
  // ==========================================

  function createPolicyVersion(content, decision) {
    const oldVersions = getSavedArray('policyVersions')

    const newVersion = {
      id: Date.now(),
      originalPolicy: currentFinding.policy,
      content,
      createdAt: new Date().toISOString(),
      sourceFinding: currentFinding.id,
      reviewId: currentReview?.id || null,
      reviewName,
      guideline: currentFinding.guideline,
      criterion: currentFinding.policyCriterion,
      type: 'Change',
      priority: currentFinding.priority,
      decision,
      decisionRationale: decisionRationale.trim(),
      reviewer: 'Sarah Chen',
    }

    const updatedVersions = [...oldVersions, newVersion]

    localStorage.setItem(
      'policyVersions',
      JSON.stringify(updatedVersions)
    )

    localStorage.setItem(
      'latestPolicyVersion',
      JSON.stringify(newVersion)
    )
  }

  // ==========================================
  // ACCEPT SUGGESTED CHANGE
  // ==========================================

  function acceptRecommendation() {
    if (!validateRationale()) return

    const acceptedText =
      currentFinding.suggestedText ||
      currentFinding.guidelineText ||
      ''

    const confirmed = window.confirm(
      'Accept this suggested change and save it as a new policy version?'
    )

    if (!confirmed) return

    saveDecision('Accepted', acceptedText)

    createPolicyVersion(acceptedText, 'Accepted')

    navigate('/reviews/findings')
  }

  // ==========================================
  // SAVE EDITED CHANGE
  // ==========================================

  function saveEditedRecommendation() {
    if (!editedText.trim()) {
      alert('The edited policy language cannot be empty.')
      return
    }

    if (!validateRationale()) return

    const confirmed = window.confirm(
      'Save your edited policy language as a new policy version?'
    )

    if (!confirmed) return

    saveDecision('Accepted with Edits', editedText.trim())

    createPolicyVersion(
      editedText.trim(),
      'Accepted with Edits'
    )

    navigate('/reviews/findings')
  }

  // ==========================================
  // REJECT RECOMMENDATION
  // ==========================================

  function rejectRecommendation() {
    if (!validateRationale()) return

    const confirmed = window.confirm(
      'Reject this recommendation? The current policy language will remain unchanged.'
    )

    if (!confirmed) return

    saveDecision(
      'Rejected',
      currentFinding.policyText || ''
    )

    navigate('/reviews/findings')
  }

  // ==========================================
  // SHARED STYLES
  // ==========================================

  const cardStyle = {
    background: '#ffffff',
    border: '1px solid #dddddd',
    borderRadius: '6px',
    marginBottom: '20px',
    overflow: 'hidden',
  }

  const labelStyle = {
    fontSize: '11px',
    color: '#777',
    fontWeight: '700',
    marginBottom: '5px',
  }

  const textareaStyle = {
    width: '100%',
    minHeight: '145px',
    boxSizing: 'border-box',
    padding: '14px',
    border: '1px solid #aaaaaa',
    borderRadius: '4px',
    fontFamily: 'inherit',
    fontSize: '14px',
    lineHeight: '1.6',
    resize: 'vertical',
  }

  const secondaryButtonStyle = {
    padding: '10px 16px',
    border: '1px solid #777',
    borderRadius: '4px',
    background: '#ffffff',
    color: '#333',
    cursor: 'pointer',
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

          <Link to="/reviews" className="nav-item active">
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

        <main className="policy-editor-content">
          <Link
            to="/reviews/findings"
            className="back-link"
          >
            ← Back to Review Results
          </Link>

          {/* PAGE TITLE */}

          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: '700',
                color: '#0078bf',
                marginBottom: '6px',
              }}
            >
              REVIEW RECOMMENDATION
            </div>

            <h1 style={{ marginBottom: '7px' }}>
              Inspect Suggested Policy Change
            </h1>

            <p className="policy-editor-subtitle">
              Review why this change was recommended,
              compare the policy with the reference
              guideline, and decide whether to accept,
              edit, or reject the recommendation.
            </p>
          </div>

          {/* SESSION / POLICY SUMMARY */}

          <section
            style={{
              ...cardStyle,
              padding: '18px 20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '25px',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={labelStyle}>
                  REVIEW SESSION
                </div>
                <strong>{reviewName}</strong>
              </div>

              <div style={{ flex: 1 }}>
                <div style={labelStyle}>POLICY</div>
                <strong>{currentFinding.policy}</strong>
              </div>

              <div>
                <div style={labelStyle}>PRIORITY</div>

                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 9px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '700',
                    background:
                      currentFinding.priority === 'High'
                        ? '#f9e5e5'
                        : '#fff2d5',
                    color:
                      currentFinding.priority === 'High'
                        ? '#9f2424'
                        : '#8a6418',
                  }}
                >
                  {(currentFinding.priority || 'Low').toUpperCase()}{' '}
                  PRIORITY
                </span>
              </div>
            </div>
          </section>

          {/* WHY THIS WAS FLAGGED */}

          <section
            style={{
              background:
                currentFinding.priority === 'High'
                  ? '#fff7f7'
                  : '#fffaf0',
              border:
                currentFinding.priority === 'High'
                  ? '1px solid #e4b8b8'
                  : '1px solid #e5d2a6',
              borderLeft:
                currentFinding.priority === 'High'
                  ? '5px solid #b53939'
                  : '5px solid #c18a20',
              borderRadius: '5px',
              padding: '18px 20px',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: '700',
                color:
                  currentFinding.priority === 'High'
                    ? '#9f2424'
                    : '#8a6418',
                marginBottom: '7px',
              }}
            >
              WHY THIS WAS FLAGGED
            </div>

            <h2
              style={{
                fontSize: '17px',
                margin: '0 0 8px',
              }}
            >
              {currentFinding.summary ||
                'Suggested policy change'}
            </h2>

            <p
              style={{
                margin: 0,
                lineHeight: '1.6',
                color: '#444',
              }}
            >
              {currentFinding.rationale ||
                'The selected reference guideline contains language that may require an update to the current policy.'}
            </p>
          </section>

          {/* POLICY VS GUIDELINE */}

          <section
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
              marginBottom: '20px',
            }}
          >
            {/* CURRENT POLICY */}

            <div style={cardStyle}>
              <div
                style={{
                  padding: '13px 16px',
                  background: '#f5f6f7',
                  borderBottom: '1px solid #dddddd',
                }}
              >
                <div style={labelStyle}>
                  CURRENT POLICY LANGUAGE
                </div>

                <strong>{currentFinding.policy}</strong>
              </div>

              <div style={{ padding: '18px' }}>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#777',
                    marginBottom: '10px',
                  }}
                >
                  {currentFinding.policyCriterion ||
                    'Policy criterion'}
                </div>

                <p
                  style={{
                    margin: 0,
                    lineHeight: '1.7',
                    color: '#333',
                  }}
                >
                  {currentFinding.policyText}
                </p>
              </div>
            </div>

            {/* REFERENCE GUIDELINE */}

            <div
              style={{
                ...cardStyle,
                border: '1px solid #b8d3e3',
              }}
            >
              <div
                style={{
                  padding: '13px 16px',
                  background: '#f0f7fb',
                  borderBottom: '1px solid #b8d3e3',
                }}
              >
                <div
                  style={{
                    ...labelStyle,
                    color: '#557b91',
                  }}
                >
                  REFERENCE GUIDELINE
                </div>

                <strong>{currentFinding.guideline}</strong>
              </div>

              <div style={{ padding: '18px' }}>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#777',
                    marginBottom: '10px',
                  }}
                >
                  {currentFinding.guidelineCriterion ||
                    'Guideline criterion'}
                </div>

                <p
                  style={{
                    margin: 0,
                    lineHeight: '1.7',
                    color: '#333',
                  }}
                >
                  {currentFinding.guidelineText}
                </p>
              </div>
            </div>
          </section>

          {/* SUGGESTED POLICY LANGUAGE */}

          <section style={cardStyle}>
            <div
              style={{
                padding: '15px 18px',
                borderBottom: '1px solid #dddddd',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '20px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: '17px',
                    margin: '0 0 4px',
                  }}
                >
                  Suggested Policy Language
                </h2>

                <div
                  style={{
                    fontSize: '13px',
                    color: '#666',
                  }}
                >
                  Review the proposed change before
                  accepting or editing it.
                </div>
              </div>

              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  style={secondaryButtonStyle}
                >
                  Edit Suggested Change
                </button>
              )}
            </div>

            <div style={{ padding: '18px' }}>
              {isEditing ? (
                <>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#555',
                      marginBottom: '8px',
                    }}
                  >
                    EDIT POLICY LANGUAGE
                  </div>

                  <textarea
                    value={editedText}
                    onChange={(event) =>
                      setEditedText(event.target.value)
                    }
                    style={textareaStyle}
                  />

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '10px',
                      marginTop: '12px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setEditedText(
                          currentFinding.suggestedText ||
                            currentFinding.guidelineText ||
                            currentFinding.policyText ||
                            ''
                        )
                        setIsEditing(false)
                      }}
                      style={secondaryButtonStyle}
                    >
                      Cancel Edit
                    </button>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    padding: '16px',
                    background: '#f5faf6',
                    border: '1px solid #c9dfcd',
                    borderLeft: '4px solid #4e8b59',
                    borderRadius: '4px',
                    lineHeight: '1.7',
                    color: '#333',
                  }}
                >
                  {currentFinding.suggestedText ||
                    currentFinding.guidelineText}
                </div>
              )}
            </div>
          </section>

          {/* ==================================
              NEW: DECISION RATIONALE
          ================================== */}

          <section
            style={{
              ...cardStyle,
              padding: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '8px',
              }}
            >
              <h2
                style={{
                  fontSize: '17px',
                  margin: 0,
                }}
              >
                Decision Rationale
              </h2>

              <span
                style={{
                  fontSize: '12px',
                  color: '#a83b3b',
                  fontWeight: '700',
                }}
              >
                Required
              </span>
            </div>

            <p
              style={{
                fontSize: '13px',
                color: '#666',
                lineHeight: '1.6',
                margin: '0 0 14px',
              }}
            >
              Explain why you are accepting, rejecting,
              or editing this recommendation. Your
              explanation will be saved with your
              decision and recorded in the Audit Log.
            </p>

            <label
              htmlFor="decision-rationale"
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '700',
                color: '#555',
                marginBottom: '8px',
              }}
            >
              REVIEWER'S EXPLANATION
            </label>

            <textarea
              id="decision-rationale"
              value={decisionRationale}
              onChange={(event) => {
                setDecisionRationale(event.target.value)
                setRationaleError(false)
              }}
              placeholder="Explain the reason for your decision. For example: The proposed change better aligns the policy with the selected clinical guideline..."
              style={{
                ...textareaStyle,
                border: rationaleError
                  ? '2px solid #b53939'
                  : '1px solid #aaaaaa',
              }}
            />

            {rationaleError && (
              <p
                style={{
                  color: '#b53939',
                  fontSize: '12px',
                  margin: '8px 0 0',
                }}
              >
                Please provide a rationale before
                saving your decision.
              </p>
            )}

            <div
              style={{
                marginTop: '12px',
                padding: '11px 13px',
                background: '#f0f7fb',
                border: '1px solid #c8dce9',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#45677d',
                lineHeight: '1.6',
              }}
            >
              <strong>Transparency:</strong> This
              rationale will be associated with the
              selected recommendation, your decision,
              and the review session.
            </div>
          </section>

          {/* ==================================
              REVIEWER DECISION
          ================================== */}

          <section
            style={{
              background: '#f7f8f8',
              border: '1px solid #dddddd',
              borderRadius: '6px',
              padding: '18px 20px',
              marginBottom: '30px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '25px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: '16px',
                    margin: '0 0 5px',
                  }}
                >
                  Reviewer Decision
                </h2>

                <p
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    color: '#666',
                    lineHeight: '1.6',
                  }}
                >
                  {isEditing
                    ? 'Save your edited policy language and rationale.'
                    : 'Accept the suggested change, edit it first, or reject the recommendation.'}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                }}
              >
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      style={secondaryButtonStyle}
                    >
                      Cancel Edit
                    </button>

                    <button
                      type="button"
                      className="start-review-button"
                      onClick={saveEditedRecommendation}
                    >
                      Save Edited Change
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={rejectRecommendation}
                      style={{
                        ...secondaryButtonStyle,
                        border: '1px solid #a83b3b',
                        color: '#9f2424',
                      }}
                    >
                      Reject Recommendation
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      style={secondaryButtonStyle}
                    >
                      Edit Suggested Change
                    </button>

                    <button
                      type="button"
                      className="start-review-button"
                      onClick={acceptRecommendation}
                    >
                      Accept Suggested Change
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default PolicyReviewEditingPage