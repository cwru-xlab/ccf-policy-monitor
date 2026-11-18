import { useEffect, useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import PolicyDocumentViewer from '../components/PolicyDocumentViewer'
import { getGuidelines } from '../data/guidelines'
import './DashboardPage.css'
import './PolicyDetailsPage.css'

const navigation = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Review Sessions', path: '/reviews' },
  { label: 'Policy Database', path: '/policies' },
  { label: 'Guideline Database', path: '/guidelines' },
  { label: 'Document Mappings', path: '/mappings' },
  { label: 'Audit Log', path: '/audit-log' },
]

export default function GuidelineDetailsPage() {
  const { guidelineId } = useParams()
  const guideline = getGuidelines().find((item) => String(item.id) === guidelineId)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    if (!helpOpen) return

    const handleEscape = (event) => {
      if (event.key === 'Escape') setHelpOpen(false)
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [helpOpen])

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
            aria-label="Help with guideline details"
            title="Help with guideline details"
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
          <Link to="/guidelines" className="ccf-policy-details-back">
            ← Back to Guideline Database
          </Link>

          {!guideline ? (
            <section className="ccf-policy-details-card">
              <h1>Guideline Not Found</h1>
              <p>
                This guideline could not be found. It may have been
                deleted or its link may be incorrect.
              </p>
              <Link to="/guidelines" className="ccf-policy-details-link">
                Return to Guideline Database
              </Link>
            </section>
          ) : (
            <>
              <div className="ccf-policy-details-heading">
                <div>
                  <h1>{guideline.name}</h1>
                  <p>
                    {guideline.description ||
                      'Reference guideline information and source document.'}
                  </p>
                </div>
                <span
                  className={`ccf-policy-details-status ${
                    guideline.status === 'Completed' ? 'completed' : 'in-review'
                  }`}
                >
                  {guideline.status}
                </span>
              </div>

              <section className="ccf-policy-details-card">
                <div className="ccf-policy-details-section-heading">
                  <div>
                    <h2>Guideline Information</h2>
                    <p>General information about this guideline record.</p>
                  </div>
                </div>

                <div className="ccf-policy-details-info-grid">
                  <div>
                    <span>GUIDELINE FILE</span>
                    <strong>{guideline.fileName || 'No document uploaded'}</strong>
                  </div>
                  <div>
                    <span>DATE CREATED</span>
                    <strong>{guideline.created || guideline.date || 'Not available'}</strong>
                  </div>
                  {guideline.url && (
                    <div>
                      <span>SOURCE</span>
                      <a
                        className="ccf-policy-details-link"
                        href={guideline.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open the published guideline
                      </a>
                    </div>
                  )}
                </div>
              </section>

              <PolicyDocumentViewer
                key={guideline.id}
                documentId={guideline.documentId}
                fileName={guideline.fileName}
                collection="guidelines"
              />
            </>
          )}
        </main>
      </div>

      {helpOpen && (
        <div
          className="ccf-policy-details-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHelpOpen(false)
          }}
        >
          <div
            className="ccf-policy-details-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guideline-details-help-title"
          >
            <div className="ccf-policy-details-dialog-header">
              <h2 id="guideline-details-help-title">
                Understanding Guideline Details
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
              This page shows a reference guideline, its source
              document, and when it was added to the workspace.
            </p>
            <p>
              To change which policies use this guideline, visit{' '}
              <Link to="/mappings" onClick={() => setHelpOpen(false)}>
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
