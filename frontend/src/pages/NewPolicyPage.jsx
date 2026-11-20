
import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { uploadPolicy } from '../api'
import JobProgress from '../components/JobProgress'
import PolicyDocumentViewer from '../components/PolicyDocumentViewer'
import './DashboardPage.css'
import './NewPolicyPage.css'

const navigation = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Review Sessions', path: '/reviews' },
  { label: 'Policy Database', path: '/policies' },
  { label: 'Guideline Database', path: '/guidelines' },
  { label: 'Document Mappings', path: '/mappings' },
  { label: 'Audit Log', path: '/audit-log' },
]

function getSavedArray(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function NewPolicyPage() {
  const navigate = useNavigate()

  const [policyName, setPolicyName] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [parsedPolicy, setParsedPolicy] = useState(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [documentId, setDocumentId] = useState(null)

  // Select a policy document
  function handleFileChange(event) {
    const file = event.target.files?.[0]

    if (!file) return

    const allowedExtensions = ['pdf', 'docx']
    const extension = file.name.split('.').pop()?.toLowerCase()

    if (!allowedExtensions.includes(extension)) {
      setUploadError('Please select a PDF or DOCX file.')
      return
    }

    setSelectedFile({
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
      file,
    })

    setUploadError('')
    setUploadSuccess(false)
    setParsedPolicy(null)
    setDocumentId(null)
  }

  // Remove selected file
  function removeFile() {
    setSelectedFile(null)
    setUploadError('')
    setUploadSuccess(false)
    setParsedPolicy(null)
    setDocumentId(null)
  }

  // Upload policy to the backend
  async function uploadDocuments() {
    if (policyName.trim() === '') {
      setUploadError('Please enter a policy name.')
      return
    }

    if (!selectedFile) {
      setUploadError('Please select a policy document.')
      return
    }

    setUploading(true)
    setUploadError('')
    setParsedPolicy(null)
    setUploadSuccess(false)
    setDocumentId(null)
    setProgress({
      phase: 'uploading',
      label: 'Uploading the document',
      percent: 0,
      ceiling: 4,
    })

    // A failed parse is still saved below so it shows in the Policies
    // view and can be deleted or re-uploaded.
    let parseFailed = false
    let storedDocumentId = null
    let policy = null

    try {
      policy = await uploadPolicy(selectedFile.file, (id) => {
        storedDocumentId = id
        setDocumentId(id)
      }, setProgress)
      setParsedPolicy(policy)
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : 'The policy could not be uploaded.'
      )
      parseFailed = true
    }

    const today = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    const newPolicy = {
      id: Date.now(),
      name: policyName.trim(),
      description: `Policy review for ${policyName.trim()}.`,
      date: today,
      age: 'Just now',
      updated: today,
      updatedAge: 'Just now',
      status: parseFailed ? 'Parse Failed' : 'In Review',
      fileName: selectedFile.name,
      documentId: storedDocumentId,
      createdAt: new Date().toISOString(),
    }

    try {
      const savedPolicies = getSavedArray('addedPolicies').filter(
        (item) => item.fileName !== selectedFile.name
      )

      localStorage.setItem(
        'addedPolicies',
        JSON.stringify([...savedPolicies, newPolicy])
      )

      setUploadSuccess(!parseFailed)
    } catch {
      setUploadError((current) =>
        current
          ? `${current} The policy could not be saved in this browser.`
          : 'The document was uploaded, but the policy could not be saved in this browser.'
      )
    } finally {
      setUploading(false)
      setProgress(null)
    }
  }

  return (
    <div className="app-page ccf-dashboard ccf-new-policy-page">
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
            className="ccf-new-policy-help-button"
            aria-label="Help with uploading policies"
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
                  item.path === '/policies'
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
        <main className="ccf-new-policy-content">
          <Link
            to="/policies"
            className="ccf-new-policy-back"
          >
            ← Back to Policies
          </Link>

          <div className="ccf-new-policy-heading">
            <h1>New Policy</h1>
            <p>
              Upload a new policy document to the Policy Database.
            </p>
          </div>

          {/* POLICY INFORMATION */}
          <section className="ccf-new-policy-card">
            <div className="ccf-new-policy-card-heading">
              <h2>Policy Information</h2>
              <p>
                Enter a descriptive name for the policy.
              </p>
            </div>

            <div className="ccf-new-policy-field">
              <label htmlFor="new-policy-name">
                Policy Name
              </label>

              <input
                id="new-policy-name"
                type="text"
                placeholder="Enter a name for this policy"
                value={policyName}
                disabled={uploading || uploadSuccess}
                onChange={(event) => {
                  setPolicyName(event.target.value)
                  setUploadError('')
                }}
              />
            </div>
          </section>

          {/* POLICY DOCUMENT */}
          <section className="ccf-new-policy-card">
            <div className="ccf-new-policy-card-heading">
              <h2>Policy Document</h2>
              <p>
                Choose a PDF or DOCX file to upload
                and parse.
              </p>
            </div>

            <label
              className={`ccf-new-policy-upload-area${
                uploading || uploadSuccess
                  ? ' disabled'
                  : ''
              }`}
            >
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileChange}
                disabled={uploading || uploadSuccess}
                hidden
              />

              <span className="ccf-new-policy-upload-icon">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 16V3" />
                  <path d="m7 8 5-5 5 5" />
                  <path d="M4 16v4h16v-4" />
                </svg>
              </span>

              <strong>Click to select a document</strong>

              <span>
                PDF or DOCX
              </span>
            </label>

            {/* SELECTED FILE */}
            {selectedFile && (
              <div className="ccf-new-policy-selected-file">
                <div className="ccf-new-policy-file-info">
                  <span className="ccf-new-policy-file-icon">
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                      <path d="M8 13h8" />
                      <path d="M8 17h8" />
                    </svg>
                  </span>

                  <div>
                    <strong>{selectedFile.name}</strong>
                    <small>{selectedFile.size}</small>
                  </div>
                </div>

                {!uploading && !uploadSuccess && (
                  <button
                    type="button"
                    className="ccf-new-policy-remove-button"
                    onClick={removeFile}
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </section>

          {/* ERROR MESSAGE */}
          {uploadError && (
            <div
              className="ccf-new-policy-error"
              role="alert"
            >
              {uploadError}
            </div>
          )}

          {/* SUCCESS MESSAGE */}
          {uploadSuccess && (
            <div
              className="ccf-new-policy-success"
              role="status"
            >
              <strong>Policy uploaded successfully.</strong>
              <p>
                Your policy has been added to the Policy
                Database in this browser.
              </p>

              <button
                type="button"
                className="ccf-new-policy-secondary-button"
                onClick={() => navigate('/policies')}
              >
                View Policy Database →
              </button>
            </div>
          )}

          {uploading && progress && <JobProgress progress={progress} />}

          {/* ACTION BUTTONS */}
          <div className="ccf-new-policy-actions">
            <button
              type="button"
              className="ccf-new-policy-secondary-button"
              onClick={() => navigate('/policies')}
              disabled={uploading}
            >
              Cancel
            </button>

            <button
              type="button"
              className="ccf-new-policy-primary-button"
              onClick={uploadDocuments}
              disabled={uploading || uploadSuccess}
            >
              {uploading
                ? 'Uploading and Parsing...'
                : uploadSuccess
                  ? 'Upload Complete'
                  : 'Upload Documents'}
            </button>
          </div>

          {/* BACKEND PARSE RESULT */}
          {parsedPolicy && (
            <section className="ccf-new-policy-card">
              <div className="ccf-new-policy-card-heading">
                <h2>Parsed Policy Result</h2>
                <p>
                  Raw response returned by the backend.
                </p>
              </div>

              <pre className="ccf-new-policy-result">
                {JSON.stringify(parsedPolicy, null, 2)}
              </pre>
            </section>
          )}

          {documentId && (
            <PolicyDocumentViewer
              key={documentId}
              documentId={documentId}
              fileName={selectedFile?.name}
            />
          )}
        </main>
      </div>

      {/* HELP DIALOG */}
      {helpOpen && (
        <div
          className="ccf-new-policy-help-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setHelpOpen(false)
            }
          }}
        >
          <div
            className="ccf-new-policy-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-policy-help-title"
          >
            <div className="ccf-new-policy-help-heading">
              <h2 id="new-policy-help-title">
                Uploading a Policy
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
              Enter a policy name and select a PDF or DOCX file.
            </p>

            <p>
              Click Upload Documents to send the file
              to the backend for parsing.
            </p>

            <p>
              After a successful upload, you can view
              the policy in the Policy Database.
            </p>

            <button
              type="button"
              className="ccf-new-policy-primary-button"
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

export default NewPolicyPage
