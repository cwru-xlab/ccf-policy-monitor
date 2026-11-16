
import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { getGuidelinesForPolicies } from '../data/guidelineMappings'
import './DashboardPage.css'
import './NewPolicyReviewPage.css'

function getSavedArray(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

const originalPolicies = [
  { id: 1, name: 'Cardiac Coverage Policy' },
  { id: 2, name: 'Diabetes Treatment Policy' },
  { id: 3, name: 'Oncology Coverage Policy' },
  { id: 4, name: 'Orthopedic Surgery Policy' },
  { id: 5, name: 'Mental Health Coverage Policy' },
]

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

const navigation = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Review Sessions', path: '/reviews' },
  { label: 'Policy Database', path: '/policies' },
  { label: 'Guideline Database', path: '/guidelines' },
  { label: 'Document Mappings', path: '/mappings' },
  { label: 'Audit Log', path: '/audit-log' },
]

function NewPolicyReviewPage() {
  const navigate = useNavigate()

  const [reviewName, setReviewName] = useState(
    () => localStorage.getItem('newReviewName') || ''
  )

  const [reviewDescription, setReviewDescription] = useState(
    () => localStorage.getItem('newReviewDescription') || ''
  )

  const [selectedPolicies, setSelectedPolicies] = useState(
    () => getSavedArray('selectedPolicies').slice(0, 1)
  )

  const [error, setError] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)

  // Get available policies from the database
  const deletedPolicyIds = getSavedArray('deletedPolicyIds')

  const databasePolicies = [
    ...getSavedArray('addedPolicies'),
    ...originalPolicies,
  ].filter(
    (policy) =>
      !deletedPolicyIds.some(
        (id) => String(id) === String(policy.id)
      )
  )

  const selectedPolicy = selectedPolicies.find((selected) =>
    databasePolicies.some(
      (policy) => String(policy.id) === String(selected.id)
    )
  )

  // Get available guidelines
  const deletedGuidelineIds = getSavedArray('deletedGuidelineIds')

  const allGuidelines = [
    ...getSavedArray('addedGuidelines'),
    ...originalGuidelines,
  ].filter(
    (guideline) =>
      !deletedGuidelineIds.some(
        (id) => String(id) === String(guideline.id)
      )
  )

  // Find guidelines mapped to the selected policy
  const mappedGuidelines = selectedPolicy
    ? getGuidelinesForPolicies([selectedPolicy], allGuidelines)
    : []

  function removePolicy() {
    setSelectedPolicies([])
    localStorage.removeItem('selectedPolicies')
    localStorage.removeItem('selectedGuidelines')
    setError('')
  }

  function startReview() {
    setError('')

    if (!reviewName.trim()) {
      setError('Please enter a review session name.')
      return
    }

    if (!reviewDescription.trim()) {
      setError('Please enter a short description.')
      return
    }

    const currentPolicies = [
      ...getSavedArray('addedPolicies'),
      ...originalPolicies,
    ].filter(
      (policy) =>
        !getSavedArray('deletedPolicyIds').some(
          (id) => String(id) === String(policy.id)
        )
    )

    const validPolicy = currentPolicies.find(
      (policy) =>
        String(policy.id) === String(selectedPolicy?.id)
    )

    if (!validPolicy) {
      setError(
        'Please select a policy from the Policy Database.'
      )
      return
    }

    const currentGuidelines = [
      ...getSavedArray('addedGuidelines'),
      ...originalGuidelines,
    ].filter(
      (guideline) =>
        !getSavedArray('deletedGuidelineIds').some(
          (id) => String(id) === String(guideline.id)
        )
    )

    const guidelines = getGuidelinesForPolicies(
      [validPolicy],
      currentGuidelines
    )

    if (guidelines.length === 0) {
      setError(
        'This policy has no mapped guidelines. Please map a guideline to the policy in Document Mappings before starting a review.'
      )
      return
    }

    const newReview = {
      id: Date.now(),
      name: reviewName.trim(),
      description: reviewDescription.trim(),
      policies: 1,
      selectedPolicies: [validPolicy],
      guidelines: guidelines.length,
      selectedGuidelines: guidelines,
      guideline:
        guidelines.length === 1
          ? guidelines[0].name
          : `${guidelines.length} reference guidelines`,
      date: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      age: 'Just now',
      status: 'In Review',
      findings: 3,
      reviewer: 'Sarah Chen',
    }

    localStorage.setItem(
      'selectedPolicies',
      JSON.stringify([validPolicy])
    )

    localStorage.setItem(
      'selectedGuidelines',
      JSON.stringify(guidelines)
    )

    localStorage.setItem('guidelineMode', 'automatic')
    localStorage.setItem('newReviewName', newReview.name)
    localStorage.setItem(
      'newReviewDescription',
      newReview.description
    )

    localStorage.setItem(
      'createdReviews',
      JSON.stringify([
        newReview,
        ...getSavedArray('createdReviews'),
      ])
    )

    localStorage.setItem(
      'currentReview',
      JSON.stringify(newReview)
    )

    navigate('/reviews/findings')
  }

  return (
    <div className="app-page ccf-new-review-page">
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
            className="ccf-new-review-help-button"
            aria-label="Help with creating a review"
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
              className={({ isActive }) =>
                `nav-item${
                  isActive ||
                  (item.path === '/reviews' &&
                    window.location.pathname.startsWith('/reviews'))
                    ? ' active'
                    : ''
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </aside>

        {/* MAIN CONTENT */}
        <main className="ccf-new-review-content">
          <Link
            to="/reviews"
            className="ccf-new-review-back"
          >
            ← Back to Review Sessions
          </Link>

          <div className="ccf-new-review-heading">
            <h1>Start a Review Session</h1>
            <p>
              Create a review session for one policy and
              automatically include its mapped guidelines.
            </p>
          </div>

          {/* PROGRESS INDICATOR */}
          <div className="ccf-new-review-progress">
            <div className="ccf-new-review-step active">
              <span className="ccf-new-review-step-number">
                1
              </span>
              <strong>Session Details & Policy</strong>
            </div>

            <span className="ccf-new-review-step-arrow">
              →
            </span>

            <div className="ccf-new-review-step">
              <span className="ccf-new-review-step-number">
                2
              </span>
              <span>Review Findings</span>
            </div>
          </div>

          {/* REVIEW SESSION DETAILS */}
          <section className="ccf-new-review-card">
            <div className="ccf-new-review-card-heading">
              <h2>Review Session Details</h2>
              <p>
                Enter a name and description for this review.
              </p>
            </div>

            <div className="ccf-new-review-field">
              <label htmlFor="review-name">
                Review Session Name
              </label>

              <input
                id="review-name"
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
            </div>

            <div className="ccf-new-review-field">
              <label htmlFor="review-description">
                Description
              </label>

              <textarea
                id="review-description"
                rows={4}
                placeholder="Briefly describe the purpose of this review..."
                value={reviewDescription}
                onChange={(event) => {
                  setReviewDescription(event.target.value)
                  localStorage.setItem(
                    'newReviewDescription',
                    event.target.value
                  )
                }}
              />
            </div>
          </section>

          {/* POLICY SELECTION */}
          <section className="ccf-new-review-card">
            <div className="ccf-new-review-card-heading">
              <h2>Policy for Review</h2>
              <p>
                Choose one policy from the Policy Database.
              </p>
            </div>

            <button
              type="button"
              className="ccf-new-review-secondary-button"
              onClick={() =>
                navigate('/reviews/new/select-policies')
              }
            >
              {selectedPolicy
                ? 'Change Selected Policy'
                : 'Select from Policy Database'}
            </button>

            {selectedPolicy ? (
              <div className="ccf-new-review-selected-policy">
                <div>
                  <strong>
                    {selectedPolicy.name ||
                      selectedPolicy.fileName ||
                      'Selected Policy'}
                  </strong>

                  <p>
                    {selectedPolicy.description ||
                      'Selected from Policy Database'}
                  </p>
                </div>

                <button
                  type="button"
                  className="ccf-new-review-remove-button"
                  onClick={removePolicy}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="ccf-new-review-empty">
                No policy selected yet.
              </div>
            )}
          </section>

          {/* ASSOCIATED GUIDELINES */}
          {selectedPolicy && (
            <section className="ccf-new-review-card">
              <div className="ccf-new-review-card-heading">
                <h2>Associated Guidelines</h2>
                <p>
                  These guidelines are mapped to the selected
                  policy and will be included automatically.
                </p>
              </div>

              {mappedGuidelines.length > 0 ? (
                <div className="ccf-new-review-guidelines">
                  {mappedGuidelines.map((guideline) => (
                    <div
                      className="ccf-new-review-guideline"
                      key={guideline.id}
                    >
                      <div className="ccf-new-review-guideline-title">
                        <span>✓</span>
                        <strong>{guideline.name}</strong>
                      </div>

                      {guideline.description && (
                        <p>{guideline.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ccf-new-review-warning">
                  No guidelines are currently mapped to this
                  policy. Add a mapping in{' '}
                  <Link to="/mappings">
                    Document Mappings
                  </Link>{' '}
                  before starting the review.
                </div>
              )}
            </section>
          )}

          {/* ERROR MESSAGE */}
          {error && (
            <div
              className="ccf-new-review-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div className="ccf-new-review-actions">
            <button
              type="button"
              className="ccf-new-review-secondary-button"
              onClick={() => navigate('/reviews')}
            >
              Cancel
            </button>

            <button
              type="button"
              className="ccf-new-review-primary-button"
              onClick={startReview}
              disabled={
                !selectedPolicy ||
                mappedGuidelines.length === 0
              }
            >
              Start Review →
            </button>
          </div>
        </main>
      </div>

      {/* HELP DIALOG */}
      {helpOpen && (
        <div
          className="ccf-new-review-help-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setHelpOpen(false)
            }
          }}
        >
          <div
            className="ccf-new-review-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-review-help-title"
          >
            <div className="ccf-new-review-help-heading">
              <h2 id="new-review-help-title">
                Creating a Review Session
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
              Enter a review session name and description,
              then select one policy from the Policy Database.
            </p>

            <p>
              Guidelines mapped to that policy are included
              automatically. If none are mapped, use Document
              Mappings before starting the review.
            </p>

            <p>
              Select Start Review to save the session and
              continue to Review Findings.
            </p>

            <button
              type="button"
              className="ccf-new-review-primary-button"
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

export default NewPolicyReviewPage
