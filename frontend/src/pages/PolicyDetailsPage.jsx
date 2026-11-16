
import { useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import PolicyDocumentViewer from '../components/PolicyDocumentViewer'
import { originalGuidelines } from '../data/guidelines'
import { getGuidelinesForPolicy } from '../data/guidelineMappings'
import './DashboardPage.css'
import './PolicyDetailsPage.css'

function getSavedArray(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

const originalPolicies = [
  {
    id: 1,
    name: 'Cardiac Coverage Policy',
    fileName: 'Cardiac_Coverage_Policy_v4.pdf',
    description: 'Policy review for cardiac procedures and treatments.',
    created: 'Sep 23, 2026',
    status: 'In Review',
  },
  {
    id: 2,
    name: 'Diabetes Treatment Policy',
    fileName: 'Diabetes_Treatment_Policy_v3.pdf',
    description: 'Policy review for diabetes management and treatment.',
    created: 'Sep 18, 2026',
    status: 'Completed',
  },
  {
    id: 3,
    name: 'Oncology Coverage Policy',
    fileName: 'Oncology_Policy_v2.pdf',
    description: 'Policy review for oncology services and treatments.',
    created: 'Sep 10, 2026',
    status: 'Completed',
  },
  {
    id: 4,
    name: 'Orthopedic Surgery Policy',
    fileName: 'Ortho_Surgery_Policy_v5.pdf',
    description: 'Policy review for orthopedic procedures and rehab.',
    created: 'Sep 5, 2026',
    status: 'In Review',
  },
  {
    id: 5,
    name: 'Mental Health Coverage Policy',
    fileName: 'Mental_Health_Policy_v3.pdf',
    description: 'Policy review for mental health services and treatment.',
    created: 'Aug 28, 2026',
    status: 'Completed',
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

function formatDate(value) {
  if (!value) return 'Date unavailable'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getDecisionRationale(version) {
  const possibleFields = [
    version.decisionRationale,
    version.rationale,
    version.reason,
    version.reasoning,
    version.explanation,
    version.justification,
  ]

  return possibleFields.find(
    (value) => typeof value === 'string' && value.trim()
  ) || null
}

function WorkspaceLayout({ children }) {
  const [helpOpen, setHelpOpen] = useState(false)

  return (
    <div className="app-page ccf-dashboard ccf-policy-details-page">
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
            aria-label="Help with policy details"
            title="Help with policy details"
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

        <main className="ccf-policy-details-content">
          {children}
        </main>
      </div>

      {helpOpen && (
        <div
          className="ccf-policy-details-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setHelpOpen(false)
            }
          }}
        >
          <div
            className="ccf-policy-details-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="policy-details-help-title"
          >
            <div className="ccf-policy-details-dialog-header">
              <h2 id="policy-details-help-title">
                Understanding Policy Details
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
              This page displays information about an insurance
              policy, its associated guidelines, and its saved
              edited versions.
            </p>

            <ol>
              <li>
                <strong>Policy Information:</strong> View the
                original file name, creation date, and number
                of saved versions.
              </li>
              <li>
                <strong>Associated Guidelines:</strong> See
                the guidelines currently mapped to this policy.
              </li>
              <li>
                <strong>Version History:</strong> View policy
                edits saved during review sessions.
              </li>
              <li>
                <strong>Decision Rationale:</strong> Read the
                reason for a change when it was recorded.
              </li>
            </ol>

            <p>
              To change guideline associations, visit{' '}
              <Link
                to="/mappings"
                onClick={() => setHelpOpen(false)}
              >
                Document Mappings
              </Link>.
            </p>

            <button
              type="button"
              className="ccf-policy-details-primary-button"
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

function PolicyDetailsPage() {
  const { policyId } = useParams()

  const uploadedPolicies = getSavedArray('addedPolicies').map(
    (policy) => ({
      ...policy,
      fileName: policy.fileName || policy.name,
      created: policy.created || policy.date,
      status: policy.status || 'In Review',
    })
  )

  const deletedPolicyIds = getSavedArray('deletedPolicyIds')

  const allPolicies = [
    ...uploadedPolicies,
    ...originalPolicies,
  ].filter(
    (policy) =>
      !deletedPolicyIds.some(
        (id) => String(id) === String(policy.id)
      )
  )

  const policy = allPolicies.find(
    (item) => String(item.id) === String(policyId)
  )

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

  const associatedGuidelines = policy
    ? getGuidelinesForPolicy(policy, allGuidelines)
    : []

  const versions = policy
    ? getSavedArray('policyVersions')
        .filter(
          (version) =>
            version.originalPolicy === policy.fileName ||
            version.originalPolicy === policy.name
        )
        .sort(
          (a, b) =>
            (new Date(b.createdAt).getTime() || 0) -
            (new Date(a.createdAt).getTime() || 0)
        )
    : []

  if (!policy) {
    return (
      <WorkspaceLayout>
        <Link to="/policies" className="ccf-policy-details-back">
          ← Back to Policy Database
        </Link>

        <section className="ccf-policy-details-card">
          <h1>Policy Not Found</h1>
          <p>
            This policy could not be found. It may have been
            deleted or its link may be incorrect.
          </p>

          <Link to="/policies" className="ccf-policy-details-link">
            Return to Policy Database
          </Link>
        </section>
      </WorkspaceLayout>
    )
  }

  return (
    <WorkspaceLayout>
      <Link to="/policies" className="ccf-policy-details-back">
        ← Back to Policy Database
      </Link>

      <div className="ccf-policy-details-heading">
        <div>
          <h1>{policy.name}</h1>
          <p>
            {policy.description ||
              'Insurance policy information and review history.'}
          </p>
        </div>

        <span
          className={`ccf-policy-details-status ${
            policy.status === 'Completed'
              ? 'completed'
              : 'in-review'
          }`}
        >
          {policy.status}
        </span>
      </div>

      {/* POLICY INFORMATION */}

      <section className="ccf-policy-details-card">
        <div className="ccf-policy-details-section-heading">
          <div>
            <h2>Policy Information</h2>
            <p>
              General information about this policy record.
            </p>
          </div>
        </div>

        <div className="ccf-policy-details-info-grid">
          <div>
            <span>POLICY FILE</span>
            <strong>
              {policy.fileName || 'Not available'}
            </strong>
            <small>
              Original document filename
            </small>
          </div>

          <div>
            <span>DATE CREATED</span>
            <strong>
              {policy.created || 'Not available'}
            </strong>
          </div>

          <div>
            <span>SAVED VERSIONS</span>
            <strong>{versions.length}</strong>
            <small>
              Edited versions saved during reviews
            </small>
          </div>
        </div>

        <PolicyDocumentViewer
          key={policy.id}
          documentId={policy.documentId}
          fileName={policy.fileName}
        />
      </section>

      {/* ASSOCIATED GUIDELINES */}

      <section className="ccf-policy-details-card">
        <div className="ccf-policy-details-section-heading">
          <div>
            <h2>Associated Guidelines</h2>
            <p>
              These guidelines are mapped to this policy
              and can be used during review sessions.
            </p>
          </div>

          <span className="ccf-policy-details-count">
            {associatedGuidelines.length}{' '}
            {associatedGuidelines.length === 1
              ? 'guideline'
              : 'guidelines'}
          </span>
        </div>

        {associatedGuidelines.length === 0 ? (
          <div className="ccf-policy-details-empty">
            <strong>No associated guidelines</strong>
            <p>
              No guidelines are currently mapped to this policy.
              Use Document Mappings to add an association.
            </p>
          </div>
        ) : (
          <div className="ccf-policy-details-guidelines">
            {associatedGuidelines.map((guideline) => (
              <div
                key={guideline.id}
                className="ccf-policy-details-guideline"
              >
                <div>
                  <h3>{guideline.name}</h3>

                  <p>
                    {guideline.description ||
                      'Reference guideline associated with this policy.'}
                  </p>

                  <small>
                    Added:{' '}
                    {guideline.created ||
                      guideline.date ||
                      'Date unavailable'}
                  </small>
                </div>

                <span className="ccf-policy-details-associated">
                  Associated
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="ccf-policy-details-card-footer">
          <Link
            to="/mappings"
            className="ccf-policy-details-secondary-button"
          >
            Manage Guideline Mappings
          </Link>
        </div>
      </section>

      {/* VERSION HISTORY */}

      <section className="ccf-policy-details-card">
        <div className="ccf-policy-details-section-heading">
          <div>
            <h2>Version History</h2>
            <p>
              View policy edits saved during review sessions,
              including the associated guideline and recorded
              decision rationale.
            </p>
          </div>

          <span className="ccf-policy-details-count">
            {versions.length}{' '}
            {versions.length === 1 ? 'version' : 'versions'}
          </span>
        </div>

        {versions.length === 0 ? (
          <div className="ccf-policy-details-empty">
            <strong>No edited versions yet</strong>
            <p>
              Edited versions will appear here after changes
              are saved during a policy review.
            </p>
          </div>
        ) : (
          <div className="ccf-policy-details-versions">
            {versions.map((version, index) => {
              const versionNumber = versions.length - index
              const rationale = getDecisionRationale(version)

              return (
                <article
                  className="ccf-policy-details-version"
                  key={version.id || index}
                >
                  <div className="ccf-policy-details-version-heading">
                    <div>
                      <h3>Version {versionNumber}</h3>
                      <p>
                        Saved {formatDate(version.createdAt)}
                      </p>
                    </div>

                    {index === 0 && (
                      <span className="ccf-policy-details-latest">
                        Latest
                      </span>
                    )}
                  </div>

                  <div className="ccf-policy-details-version-meta">
                    {version.guideline && (
                      <div>
                        <span>REFERENCE GUIDELINE</span>
                        <strong>{version.guideline}</strong>
                      </div>
                    )}

                    {version.criterion && (
                      <div>
                        <span>POLICY CRITERION</span>
                        <strong>{version.criterion}</strong>
                      </div>
                    )}

                    {version.priority && (
                      <div>
                        <span>PRIORITY</span>
                        <strong>{version.priority}</strong>
                      </div>
                    )}
                  </div>

                  <div className="ccf-policy-details-rationale">
                    <h4>Decision Rationale</h4>

                    {rationale ? (
                      <p>{rationale}</p>
                    ) : (
                      <p className="ccf-policy-details-muted">
                        No decision rationale was recorded
                        for this version.
                      </p>
                    )}
                  </div>

                  <div className="ccf-policy-details-version-content">
                    <h4>Saved Policy Content</h4>
                    <pre>
                      {version.content ||
                        'No saved content available.'}
                    </pre>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </WorkspaceLayout>
  )
}

export default PolicyDetailsPage
