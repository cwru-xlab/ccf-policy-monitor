import { useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { uploadGuidelineDocument } from '../api'
import './DashboardPage.css'
import './GuidelinesPage.css'

function getSavedArray(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key))
    return Array.isArray(data) ? data : []
  } catch {
    return []
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

function NewGuidelinePage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [guidelineName, setGuidelineName] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)

  function handleFileChange(event) {
    const file = event.target.files?.[0]

    if (!file) return

    const extension = file.name.split('.').pop().toLowerCase()

    if (!['pdf', 'docx'].includes(extension)) {
      setError('Please select a PDF or DOCX file.')
      event.target.value = ''
      setSelectedFile(null)
      return
    }

    setSelectedFile({
      file,
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      type: extension.toUpperCase(),
    })

    setError('')
  }

  function removeFile() {
    setSelectedFile(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function uploadGuideline(event) {
    event.preventDefault()

    const name = guidelineName.trim()

    if (!name) {
      setError('Please enter a guideline name.')
      return
    }

    if (!selectedFile) {
      setError('Please select a guideline document.')
      return
    }

    setUploading(true)
    setError('')

    try {
      const documentId = await uploadGuidelineDocument(selectedFile.file)
      const now = new Date()
      const today = now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })

      const newGuideline = {
        id: Date.now(),
        name,
        description: `Guideline document: ${selectedFile.name}`,
        created: today,
        createdAge: 'Just now',
        updated: today,
        updatedAge: 'Just now',
        createdAt: now.toISOString(),
        status: 'In Review',
        fileName: selectedFile.name,
        documentId,
        fileSize: selectedFile.size,
        fileType: selectedFile.type,
        policyIds: [],
      }

      const savedGuidelines = getSavedArray('addedGuidelines')

      localStorage.setItem(
        'addedGuidelines',
        JSON.stringify([...savedGuidelines, newGuideline])
      )

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

      navigate(`/guidelines/${newGuideline.id}`)
    } catch (uploadError) {
      setError(
        'Unable to upload or save the guideline. ' +
          (uploadError instanceof Error ? uploadError.message : '')
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="app-page ccf-dashboard ccf-guidelines-page">
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
            aria-label="Help with guideline uploads"
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

        <main className="ccf-guidelines-content">
          <Link
            to="/guidelines"
            className="ccf-guidelines-back-link"
          >
            ← Back to Guideline Database
          </Link>

          <div className="ccf-guidelines-heading">
            <h1>Upload New Guideline</h1>
            <p>
              Add a reference guideline to the Guideline Database.
            </p>
          </div>

          <form
            className="ccf-new-guideline-form"
            onSubmit={uploadGuideline}
          >
            <section className="ccf-guidelines-form-card">
              <h2>Guideline Information</h2>
              <p>
                Enter a name to identify the guideline in the database.
              </p>

              <label htmlFor="guideline-name">
                Guideline Name
              </label>

              <input
                id="guideline-name"
                type="text"
                placeholder="Enter a name for this guideline"
                value={guidelineName}
                disabled={uploading}
                onChange={(event) => {
                  setGuidelineName(event.target.value)
                  setError('')
                }}
              />
            </section>

            <section className="ccf-guidelines-form-card">
              <h2>Guideline Document</h2>
              <p>
                Select a PDF or DOCX document from your computer.
              </p>

              <label className="ccf-guidelines-upload-area">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  disabled={uploading}
                  onChange={handleFileChange}
                />

                <span
                  className="ccf-guidelines-upload-icon"
                  aria-hidden="true"
                >
                  ↑
                </span>

                <strong>Click to choose a document</strong>
                <span>PDF or DOCX</span>
              </label>

              {selectedFile && (
                <div className="ccf-guidelines-selected-file">
                  <div>
                    <strong>{selectedFile.name}</strong>
                    <small>
                      {selectedFile.type} · {selectedFile.size}
                    </small>
                  </div>

                  <button
                    type="button"
                    onClick={removeFile}
                    disabled={uploading}
                  >
                    Remove
                  </button>
                </div>
              )}
            </section>

            <p className="ccf-guidelines-upload-note">
              The document is uploaded and stored, then the guideline
              is added to the Guideline Database. You can associate it
              with policies later in Document Mappings.
            </p>

            {error && (
              <div className="ccf-guidelines-error" role="alert">
                {error}
              </div>
            )}

            <div className="ccf-guidelines-form-actions">
              <button
                type="button"
                className="ccf-guidelines-secondary-button"
                onClick={() => navigate('/guidelines')}
                disabled={uploading}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="ccf-guidelines-primary-button"
                disabled={uploading}
              >
                {uploading ? 'Uploading…' : 'Upload Guideline'}
              </button>
            </div>
          </form>
        </main>
      </div>

      {helpOpen && (
        <div
          className="ccf-guidelines-help-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setHelpOpen(false)
            }
          }}
        >
          <div
            className="ccf-guidelines-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-help-title"
          >
            <div className="ccf-guidelines-help-heading">
              <h2 id="upload-help-title">
                Uploading a Guideline
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
              Enter a guideline name and choose a PDF or DOCX document.
            </p>

            <p>
              Upload Guideline stores the file and adds the guideline
              to the Guideline Database. You can open it from the list
              and map it to policies afterward.
            </p>

            <button
              type="button"
              className="ccf-guidelines-primary-button"
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

export default NewGuidelinePage
