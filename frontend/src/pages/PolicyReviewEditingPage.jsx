
import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import './DashboardPage.css'
import './PolicyReviewEditingPage.css'

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
    const value = JSON.parse(localStorage.getItem(key))
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : null
  } catch {
    return null
  }
}

const navigation = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Review Sessions', path: '/reviews' },
  { label: 'Policy Database', path: '/policies' },
  { label: 'Guideline Database', path: '/guidelines' },
  { label: 'Document Mappings', path: '/mappings' },
  { label: 'Audit Log', path: '/audit-log' },
]

function PolicyReviewEditingPage() {
  const navigate = useNavigate()

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

  const currentReview = getSavedObject('currentReview')
  const reviewName = currentReview?.name || 'Policy Review Session'

  const existingDecision = getSavedArray(
    'recommendationDecisions'
  ).find(
    (item) =>
      String(item.reviewId) ===
        String(currentReview?.id || null) &&
      String(item.findingId) === String(currentFinding.id)
  )

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
  const [helpOpen, setHelpOpen] = useState(false)

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

  // Save the latest reviewer decision
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

    const otherDecisions = existingDecisions.filter(
      (item) =>
        !(
          String(item.reviewId) ===
            String(currentReview?.id || null) &&
          String(item.findingId) === String(currentFinding.id)
        )
    )

    localStorage.setItem(
      'recommendationDecisions',
      JSON.stringify([...otherDecisions, newDecision])
    )

    // Record decision in the Audit Log
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

  // Create a new policy version after accepting a change
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

    localStorage.setItem(
      'policyVersions',
      JSON.stringify([...oldVersions, newVersion])
    )

    localStorage.setItem(
      'latestPolicyVersion',
      JSON.stringify(newVersion)
    )
  }

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

  function cancelEdit() {
    setEditedText(
      currentFinding.suggestedText ||
        currentFinding.guidelineText ||
        currentFinding.policyText ||
        ''
    )
    setIsEditing(false)
  }

  return (
    <div className="app-page ccf-policy-editor-page">
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
            className="ccf-policy-editor-help-button"
            aria-label="Help with reviewing recommendations"
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
        <main className="ccf-policy-editor-content">
          <Link
            to="/reviews/findings"
            className="ccf-policy-editor-back"
          >
            ← Back to Review Results
          </Link>

          {/* TITLE */}
          <div className="ccf-policy-editor-heading">
            <span className="ccf-policy-editor-eyebrow">
              REVIEW RECOMMENDATION
            </span>

            <h1>Inspect Suggested Policy Change</h1>

            <p>
              Review why this change was recommended,
              compare the policy with the reference guideline,
              and decide whether to accept, edit, or reject
              the recommendation.
            </p>
          </div>

          {/* SESSION SUMMARY */}
          <section className="ccf-policy-editor-card">
            <div className="ccf-policy-editor-summary-grid">
              <div>
                <span className="ccf-policy-editor-label">
                  REVIEW SESSION
                </span>
                <strong>{reviewName}</strong>
              </div>

              <div>
                <span className="ccf-policy-editor-label">
                  POLICY
                </span>
                <strong>{currentFinding.policy}</strong>
              </div>

              <div>
                <span className="ccf-policy-editor-label">
                  PRIORITY
                </span>

                <span
                  className={`ccf-policy-editor-priority ${
                    currentFinding.priority === 'High'
                      ? 'high'
                      : 'low'
                  }`}
                >
                  {(currentFinding.priority || 'Low').toUpperCase()}{' '}
                  PRIORITY
                </span>
              </div>
            </div>
          </section>

          {/* WHY THIS WAS FLAGGED */}
          <section
            className={`ccf-policy-editor-flagged ${
              currentFinding.priority === 'High'
                ? 'high'
                : 'low'
            }`}
          >
            <span className="ccf-policy-editor-flagged-label">
              WHY THIS WAS FLAGGED
            </span>

            <h2>
              {currentFinding.summary ||
                'Suggested policy change'}
            </h2>

            <p>
              {currentFinding.rationale ||
                'The selected reference guideline contains language that may require an update to the current policy.'}
            </p>
          </section>

          {/* POLICY VS GUIDELINE */}
          <div className="ccf-policy-editor-comparison">
            <section className="ccf-policy-editor-card ccf-policy-editor-comparison-card">
              <div className="ccf-policy-editor-comparison-heading">
                <span className="ccf-policy-editor-label">
                  CURRENT POLICY LANGUAGE
                </span>
                <strong>{currentFinding.policy}</strong>
              </div>

              <div className="ccf-policy-editor-comparison-body">
                <span>
                  {currentFinding.policyCriterion ||
                    'Policy criterion'}
                </span>

                <p>{currentFinding.policyText}</p>
              </div>
            </section>

            <section className="ccf-policy-editor-card ccf-policy-editor-comparison-card">
              <div className="ccf-policy-editor-comparison-heading guideline">
                <span className="ccf-policy-editor-label">
                  REFERENCE GUIDELINE
                </span>
                <strong>{currentFinding.guideline}</strong>
              </div>

              <div className="ccf-policy-editor-comparison-body">
                <span>
                  {currentFinding.guidelineCriterion ||
                    'Guideline criterion'}
                </span>

                <p>{currentFinding.guidelineText}</p>
              </div>
            </section>
          </div>

          {/* SUGGESTED POLICY LANGUAGE */}
          <section className="ccf-policy-editor-card">
            <div className="ccf-policy-editor-section-heading">
              <div>
                <h2>Suggested Policy Language</h2>
                <p>
                  Review the proposed change before
                  accepting or editing it.
                </p>
              </div>

              {!isEditing && (
                <button
                  type="button"
                  className="ccf-policy-editor-secondary-button"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Suggested Change
                </button>
              )}
            </div>

            <div className="ccf-policy-editor-section-body">
              {isEditing ? (
                <>
                  <label
                    htmlFor="edited-policy-language"
                    className="ccf-policy-editor-label"
                  >
                    EDIT POLICY LANGUAGE
                  </label>

                  <textarea
                    id="edited-policy-language"
                    className="ccf-policy-editor-textarea"
                    value={editedText}
                    onChange={(event) =>
                      setEditedText(event.target.value)
                    }
                  />

                  <div className="ccf-policy-editor-edit-actions">
                    <button
                      type="button"
                      className="ccf-policy-editor-secondary-button"
                      onClick={cancelEdit}
                    >
                      Cancel Edit
                    </button>
                  </div>
                </>
              ) : (
                <div className="ccf-policy-editor-suggested-text">
                  {currentFinding.suggestedText ||
                    currentFinding.guidelineText}
                </div>
              )}
            </div>
          </section>

          {/* DECISION RATIONALE */}
          <section className="ccf-policy-editor-card ccf-policy-editor-rationale-card">
            <div className="ccf-policy-editor-rationale-heading">
              <h2>Decision Rationale</h2>
              <span>Required</span>
            </div>

            <p className="ccf-policy-editor-muted">
              Explain why you are accepting, rejecting,
              or editing this recommendation. Your explanation
              will be saved with your decision and recorded
              in the Audit Log.
            </p>

            <label
              htmlFor="decision-rationale"
              className="ccf-policy-editor-label"
            >
              REVIEWER'S EXPLANATION
            </label>

            <textarea
              id="decision-rationale"
              className={`ccf-policy-editor-textarea ${
                rationaleError ? 'error' : ''
              }`}
              value={decisionRationale}
              onChange={(event) => {
                setDecisionRationale(event.target.value)
                setRationaleError(false)
              }}
              placeholder="Explain the reason for your decision. For example: The proposed change better aligns the policy with the selected clinical guideline..."
            />

            {rationaleError && (
              <p
                className="ccf-policy-editor-error"
                role="alert"
              >
                Please provide a rationale before
                saving your decision.
              </p>
            )}

            <div className="ccf-policy-editor-transparency">
              <strong>Transparency:</strong> This rationale
              will be associated with the selected
              recommendation, your decision, and the
              review session.
            </div>
          </section>

          {/* REVIEWER DECISION */}
          <section className="ccf-policy-editor-decision-card">
            <div>
              <h2>Reviewer Decision</h2>

              <p>
                {isEditing
                  ? 'Save your edited policy language and rationale.'
                  : 'Accept the suggested change, edit it first, or reject the recommendation.'}
              </p>
            </div>

            <div className="ccf-policy-editor-decision-actions">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    className="ccf-policy-editor-secondary-button"
                    onClick={cancelEdit}
                  >
                    Cancel Edit
                  </button>

                  <button
                    type="button"
                    className="ccf-policy-editor-primary-button"
                    onClick={saveEditedRecommendation}
                  >
                    Save Edited Change
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="ccf-policy-editor-reject-button"
                    onClick={rejectRecommendation}
                  >
                    Reject Recommendation
                  </button>

                  <button
                    type="button"
                    className="ccf-policy-editor-secondary-button"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Suggested Change
                  </button>

                  <button
                    type="button"
                    className="ccf-policy-editor-primary-button"
                    onClick={acceptRecommendation}
                  >
                    Accept Suggested Change
                  </button>
                </>
              )}
            </div>
          </section>
        </main>
      </div>

      {/* HELP DIALOG */}
      {helpOpen && (
        <div
          className="ccf-policy-editor-help-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setHelpOpen(false)
            }
          }}
        >
          <div
            className="ccf-policy-editor-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="policy-editor-help-title"
          >
            <div className="ccf-policy-editor-help-heading">
              <h2 id="policy-editor-help-title">
                Reviewing a Recommendation
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
              Compare the current policy language with
              the reference guideline and proposed change.
            </p>

            <p>
              Enter a required rationale explaining your
              decision. You can accept the suggested
              language, edit it, or reject the recommendation.
            </p>

            <p>
              Accepted changes create a new policy version.
              All reviewer decisions are recorded in the
              Audit Log.
            </p>

            <button
              type="button"
              className="ccf-policy-editor-primary-button"
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

export default PolicyReviewEditingPage
