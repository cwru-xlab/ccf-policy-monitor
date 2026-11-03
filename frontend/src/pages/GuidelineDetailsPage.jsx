import { Link, useParams } from 'react-router-dom'
import PolicyDocumentViewer from '../components/PolicyDocumentViewer'
import { getGuidelines } from '../data/guidelines'

export default function GuidelineDetailsPage() {
  const { guidelineId } = useParams()
  const guideline = getGuidelines().find((item) => String(item.id) === guidelineId)
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

          <Link to="/reviews" className="nav-item">
            Review Sessions
          </Link>

          <Link to="/policies" className="nav-item">
            Policy Database
          </Link>

          <Link
            to="/guidelines"
            className="nav-item active"
          >
            Guideline Database
          </Link>

          <Link
            to="/mappings"
            className="nav-item"
          >
            Document Mappings
          </Link>

          <Link to="/audit-log" className="nav-item">
            Audit Log
          </Link>
        </aside>

        {/* MAIN PAGE */}


        <main className="policy-details-content">
          <Link to="/guidelines" className="back-link">← Back to Guidelines</Link>
          {!guideline ? (
            <><h1>Guideline Not Found</h1><p>This guideline could not be found or has been deleted.</p></>
          ) : (
            <>
              <div className="policy-details-heading">
                <div><h1>{guideline.name}</h1><p>{guideline.description}</p></div>
                <span className={guideline.status === 'Completed' ? 'status completed' : 'status in-review'}>{guideline.status}</span>
              </div>
              <section className="policy-details-card">
                <h2>Guideline Information</h2>
                <div className="policy-information-grid">
                  <div><span className="policy-detail-label">GUIDELINE FILE</span><strong>{guideline.fileName || 'No document uploaded'}</strong></div>
                  <div><span className="policy-detail-label">DATE CREATED</span><strong>{guideline.created || guideline.date}</strong></div>
                </div>
              </section>
              <PolicyDocumentViewer key={guideline.id} documentId={guideline.documentId} fileName={guideline.fileName} collection="guidelines" />
            </>
          )}
        </main>
      </div>
    </div>
  )
}
