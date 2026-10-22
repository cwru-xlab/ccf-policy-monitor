
import { Link, useParams } from 'react-router-dom'
import { getGuidelinesForPolicy } from '../data/guidelineMappings'

function getSavedArray(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function PolicyDetailsPage() {
  const { policyId } = useParams()

  // ==========================================
  // ORIGINAL POLICIES
  // ==========================================

  const originalPolicies = [
    {
      id: 1,
      name: 'Cardiac Coverage Policy',
      fileName: 'Cardiac_Coverage_Policy_v4.pdf',
      description:
        'Policy review for cardiac procedures and treatments.',
      created: 'Sep 23, 2026',
      status: 'In Review',
    },
    {
      id: 2,
      name: 'Diabetes Treatment Policy',
      fileName: 'Diabetes_Treatment_Policy_v3.pdf',
      description:
        'Policy review for diabetes management and treatment.',
      created: 'Sep 18, 2026',
      status: 'Completed',
    },
    {
      id: 3,
      name: 'Oncology Coverage Policy',
      fileName: 'Oncology_Policy_v2.pdf',
      description:
        'Policy review for oncology services and treatments.',
      created: 'Sep 10, 2026',
      status: 'Completed',
    },
    {
      id: 4,
      name: 'Orthopedic Surgery Policy',
      fileName: 'Ortho_Surgery_Policy_v5.pdf',
      description:
        'Policy review for orthopedic procedures and rehab.',
      created: 'Sep 5, 2026',
      status: 'In Review',
    },
    {
      id: 5,
      name: 'Mental Health Coverage Policy',
      fileName: 'Mental_Health_Policy_v3.pdf',
      description:
        'Policy review for mental health services and treatment.',
      created: 'Aug 28, 2026',
      status: 'Completed',
    },
  ]

  // ==========================================
  // ORIGINAL GUIDELINES
  // ==========================================

  // These match the original guideline records
  // used by GuidelinesPage.jsx.

  const originalGuidelines = [
    {
      id: 1,
      name: 'Cardiac Coverage Guideline',
      description:
        'Policy review for cardiac procedures and treatments.',
      created: 'Sep 23, 2026',
      status: 'In Review',
    },
    {
      id: 2,
      name: 'Diabetes Treatment Guideline',
      description:
        'Policy review for diabetes management and treatment.',
      created: 'Sep 18, 2026',
      status: 'Completed',
    },
    {
      id: 3,
      name: 'Oncology Coverage Guideline',
      description:
        'Policy review for oncology services and treatments.',
      created: 'Sep 10, 2026',
      status: 'Completed',
    },
    {
      id: 4,
      name: 'Orthopedic Surgery Guideline',
      description:
        'Policy review for orthopedic procedures and rehab.',
      created: 'Sep 5, 2026',
      status: 'In Review',
    },
    {
      id: 5,
      name: 'Mental Health Guideline',
      description:
        'Policy review for mental health services and treatment.',
      created: 'Aug 28, 2026',
      status: 'Completed',
    },
  ]

  // ==========================================
  // LOAD POLICIES
  // ==========================================

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

  // ==========================================
  // LOAD GUIDELINES
  // ==========================================

  const addedGuidelines = getSavedArray('addedGuidelines')
  const deletedGuidelineIds = getSavedArray(
    'deletedGuidelineIds'
  )

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
  // FIND ASSOCIATED GUIDELINES
  // ==========================================

  const associatedGuidelines = policy
    ? getGuidelinesForPolicy(policy, allGuidelines)
    : []

  // ==========================================
  // GET SAVED POLICY VERSIONS
  // ==========================================

  const policyVersions = getSavedArray('policyVersions')

  const versions = policy
    ? policyVersions
        .filter(
          (version) =>
            version.originalPolicy === policy.fileName ||
            version.originalPolicy === policy.name
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
        )
    : []

  // ==========================================
  // POLICY NOT FOUND
  // ==========================================

  if (!policy) {
    return (
      <div className="app-page">
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
        </header>

        <div className="app-body">
          <aside className="sidebar">
            <Link to="/dashboard" className="nav-item">
              Dashboard
            </Link>
            <Link to="/reviews" className="nav-item">
              Review Sessions
            </Link>
            <Link
              to="/policies"
              className="nav-item active"
            >
              Policy Database
            </Link>
            <Link to="/guidelines" className="nav-item">
              Guideline Database
            </Link>
            <Link to="/audit-log" className="nav-item">
              Audit Log
            </Link>
          </aside>

          <main className="policy-details-content">
            <Link
              to="/policies"
              className="back-link"
            >
              ← Back to Policies
            </Link>

            <h1>Policy Not Found</h1>
            <p>This policy could not be found.</p>
          </main>
        </div>
      </div>
    )
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
              placeholder="Search policies, codes..."
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
          <Link to="/reviews" className="nav-item">
            Review Sessions
          </Link>
          <Link
            to="/policies"
            className="nav-item active"
          >
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

        <main className="policy-details-content">
          <Link
            to="/policies"
            className="back-link"
          >
            ← Back to Policies
          </Link>

          <div className="policy-details-heading">
            <div>
              <h1>{policy.name}</h1>
              <p>{policy.description}</p>
            </div>

            <span
              className={
                policy.status === 'Completed'
                  ? 'status completed'
                  : 'status in-review'
              }
            >
              {policy.status}
            </span>
          </div>

          {/* ==================================
              POLICY INFORMATION
          ================================== */}

          <section className="policy-details-card">
            <h2>Policy Information</h2>

            <div className="policy-information-grid">
              <div>
                <span className="policy-detail-label">
                  POLICY FILE
                </span>
                <strong>{policy.fileName}</strong>
              </div>

              <div>
                <span className="policy-detail-label">
                  DATE CREATED
                </span>
                <strong>{policy.created}</strong>
              </div>

              <div>
                <span className="policy-detail-label">
                  SAVED VERSIONS
                </span>
                <strong>{versions.length}</strong>
              </div>
            </div>
          </section>

          {/* ==================================
              NEW: ASSOCIATED GUIDELINES
          ================================== */}

          <section className="policy-details-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '16px',
                flexWrap: 'wrap',
                marginBottom: '10px',
              }}
            >
              <h2 style={{ margin: 0 }}>
                Associated Guidelines
              </h2>

              <span
                style={{
                  background: '#eaf4fb',
                  color: '#0078bf',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '700',
                }}
              >
                {associatedGuidelines.length}{' '}
                {associatedGuidelines.length === 1
                  ? 'Guideline'
                  : 'Guidelines'}
              </span>
            </div>

            <p
              style={{
                fontSize: '13px',
                color: '#64748b',
                lineHeight: '1.6',
                marginBottom: '18px',
              }}
            >
              These reference guidelines are associated
              with this policy and are automatically
              included when the policy is selected for
              a review session.
            </p>

            {associatedGuidelines.length === 0 ? (
              <div
                style={{
                  padding: '22px',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '6px',
                  color: '#64748b',
                  fontSize: '13px',
                }}
              >
                No guidelines are currently mapped to
                this policy.
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {associatedGuidelines.map((guideline) => (
                  <div
                    key={guideline.id}
                    style={{
                      padding: '16px 18px',
                      border: '1px solid #d9e3eb',
                      borderLeft: '4px solid #0078bf',
                      borderRadius: '6px',
                      background: '#f8fbfd',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '15px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <strong
                          style={{
                            display: 'block',
                            fontSize: '14px',
                            marginBottom: '6px',
                            color: '#1f2937',
                          }}
                        >
                          {guideline.name}
                        </strong>

                        <p
                          style={{
                            margin: '0 0 8px',
                            fontSize: '13px',
                            color: '#64748b',
                            lineHeight: '1.6',
                          }}
                        >
                          {guideline.description ||
                            'Reference guideline associated with this policy.'}
                        </p>

                        <span
                          style={{
                            fontSize: '12px',
                            color: '#64748b',
                          }}
                        >
                          Added:{' '}
                          {guideline.created ||
                            guideline.date ||
                            'Date unavailable'}
                        </span>
                      </div>

                      <span
                        style={{
                          padding: '5px 10px',
                          borderRadius: '15px',
                          background: '#e5f4ea',
                          color: '#287447',
                          fontSize: '11px',
                          fontWeight: '700',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Associated
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Manual mapping is the next feature.
                We will add a working Manage Guideline
                Mappings button in the next step. */}
          </section>

          {/* ==================================
              VERSION HISTORY
          ================================== */}

          <section className="policy-details-card">
            <h2>Version History</h2>

            <p className="policy-version-description">
              View edited versions of this policy that
              were saved during policy review.
            </p>

            {versions.length === 0 ? (
              <div className="no-policy-versions">
                <strong>
                  No edited versions yet
                </strong>

                <p>
                  Edited versions will appear here after
                  changes are saved from a policy review.
                </p>
              </div>
            ) : (
              <div className="policy-version-list">
                {versions.map((version, index) => {
                  const versionNumber =
                    versions.length - index

                  const savedDate = new Date(
                    version.createdAt
                  ).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })

                  return (
                    <div
                      className="policy-version-card"
                      key={version.id}
                    >
                      <div className="policy-version-header">
                        <div>
                          <strong>
                            Version {versionNumber}
                          </strong>

                          <span>
                            Saved {savedDate}
                          </span>
                        </div>

                        {index === 0 && (
                          <span className="latest-version-badge">
                            Latest
                          </span>
                        )}
                      </div>

                      <div className="policy-version-meta">
                        {version.guideline && (
                          <div>
                            <span>GUIDELINE</span>
                            <strong>
                              {version.guideline}
                            </strong>
                          </div>
                        )}

                        {version.criterion && (
                          <div>
                            <span>POLICY CRITERION</span>
                            <strong>
                              {version.criterion}
                            </strong>
                          </div>
                        )}

                        {version.priority && (
                          <div>
                            <span>PRIORITY</span>
                            <strong>
                              {version.priority}
                            </strong>
                          </div>
                        )}
                      </div>

                      <div className="policy-version-content">
                        <span>
                          SAVED POLICY CONTENT
                        </span>

                        <pre>
                          {version.content}
                        </pre>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

export default PolicyDetailsPage
