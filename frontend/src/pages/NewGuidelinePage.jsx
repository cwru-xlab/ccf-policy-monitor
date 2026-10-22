
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function NewGuidelinePage() {
  const navigate = useNavigate()

  const [guidelineName, setGuidelineName] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)

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
  // SELECT FILE
  // ==========================================

  function handleFileChange(event) {
    const file = event.target.files[0]

    if (!file) {
      return
    }

    const allowedExtensions = ['pdf', 'doc', 'docx']
    const extension = file.name
      .split('.')
      .pop()
      .toLowerCase()

    if (!allowedExtensions.includes(extension)) {
      alert('Please select a PDF, DOC, or DOCX file.')
      event.target.value = ''
      return
    }

    setSelectedFile({
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      type: extension.toUpperCase(),
    })
  }

  // ==========================================
  // REMOVE FILE
  // ==========================================

  function removeFile() {
    setSelectedFile(null)
  }

  // ==========================================
  // UPLOAD GUIDELINE
  // ==========================================

  function uploadGuideline() {
    const name = guidelineName.trim()

    if (name === '') {
      alert('Please enter a guideline name.')
      return
    }

    if (!selectedFile) {
      alert('Please select a guideline document.')
      return
    }

    const now = new Date()

    const today = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    // Create a new guideline record.
    // policyIds starts empty because new guidelines
    // are mapped manually from Policy Details.

    const newGuideline = {
      id: Date.now(),
      name: name,
      description: `Guideline document: ${selectedFile.name}`,
      created: today,
      createdAge: 'Just now',
      updated: today,
      updatedAge: 'Just now',
      createdAt: now.toISOString(),
      status: 'In Review',
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      fileType: selectedFile.type,
      policyIds: [],
    }

    // ==========================================
    // SAVE TO GUIDELINE DATABASE
    // ==========================================

    const savedGuidelines = getSavedArray('addedGuidelines')

    savedGuidelines.push(newGuideline)

    localStorage.setItem(
      'addedGuidelines',
      JSON.stringify(savedGuidelines)
    )

    // ==========================================
    // RECORD UPLOAD IN AUDIT LOG
    // ==========================================

    const auditEvents = getSavedArray('auditEvents')

    auditEvents.push({
      id: `guideline-upload-${newGuideline.id}`,
      timestamp: now.toISOString(),
      user: 'Sarah Chen',
      action: 'Guideline Uploaded',
      category: 'Guideline Changes',
      item: newGuideline.name,
      details: `Uploaded guideline document: ${selectedFile.name}`,
    })

    localStorage.setItem(
      'auditEvents',
      JSON.stringify(auditEvents)
    )

    // ==========================================
    // RETURN TO GUIDELINE DATABASE
    // ==========================================

    navigate('/guidelines')
  }

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

          <Link to="/policies" className="nav-item">
            Policy Database
          </Link>

          <Link
            to="/guidelines"
            className="nav-item active"
          >
            Guideline Database
          </Link>

          <Link to="/audit-log" className="nav-item">
            Audit Log
          </Link>
        </aside>

        {/* MAIN CONTENT */}

        <main className="new-guideline-content">
          <Link to="/guidelines" className="back-link">
            ← Back to Guidelines
          </Link>

          <h1>New Guidelines</h1>

          <p className="new-guideline-subtitle">
            Add a new reference guideline to the
            Guideline Database.
          </p>

          {/* GUIDELINE INFORMATION */}

          <section className="new-guideline-card">
            <h2>Guideline Information</h2>

            <label
              className="new-guideline-label"
              htmlFor="guideline-name"
            >
              Guideline Name
            </label>

            <input
              id="guideline-name"
              className="guideline-name-input"
              type="text"
              placeholder="Enter a name for this guideline"
              value={guidelineName}
              onChange={(event) =>
                setGuidelineName(event.target.value)
              }
            />
          </section>

          {/* GUIDELINE DOCUMENT */}

          <section className="new-guideline-card guideline-document-card">
            <h2>Guideline Document</h2>

            <p>
              Select a PDF, DOC, or DOCX document to
              register in the Guideline Database.
            </p>

            <label className="guideline-upload-area">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                hidden
                onChange={handleFileChange}
              />

              <div className="guideline-upload-icon">
                ⇧
              </div>

              <div className="guideline-upload-text">
                <strong>Click to upload</strong>

                <span>
                  {' '}
                  a PDF, DOC, or DOCX document from
                  your computer.
                </span>
              </div>
            </label>
          </section>

          {/* SELECTED FILE */}

          {selectedFile && (
            <div className="guideline-selected-file">
              <div>
                <strong>{selectedFile.name}</strong>

                <small>
                  {selectedFile.type} • {selectedFile.size}
                </small>
              </div>

              <button
                type="button"
                onClick={removeFile}
              >
                Remove
              </button>
            </div>
          )}

          {/* BOTTOM BUTTONS */}

          <div className="new-guideline-actions">
            <button
              type="button"
              className="cancel-guideline-button"
              onClick={() => navigate('/guidelines')}
            >
              Cancel
            </button>

            <button
              type="button"
              className="upload-documents-button"
              onClick={uploadGuideline}
            >
              Upload Guideline
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}

export default NewGuidelinePage
