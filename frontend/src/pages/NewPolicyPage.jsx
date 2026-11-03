
import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { uploadPolicy } from '../api'
import PolicyDocumentViewer from '../components/PolicyDocumentViewer'

function NewPolicyPage() {
  const navigate = useNavigate()

  const [policyName, setPolicyName] = useState('')

  const [selectedFile, setSelectedFile] = useState(null)

  // Backend upload state
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [documentId, setDocumentId] = useState(null)

  // Handles selecting a file from the computer
  function handleFileChange(event) {
    const file = event.target.files[0]

    if (file) {
      setUploadSuccess(false)
      setUploadError('')
      setDocumentId(null)
      setSelectedFile({
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        file,
      })
    }
  }

  // Removes the selected file
  function removeFile() {
    setSelectedFile(null)
    setUploadSuccess(false)
    setUploadError('')
    setDocumentId(null)
  }

  // Runs when Upload Documents is clicked
  async function uploadDocuments() {
    // Make sure the user entered a policy name
    if (policyName.trim() === '') {
      alert('Please enter a policy name.')
      return
    }

    // Make sure the user selected a file
    if (!selectedFile) {
      alert('Please select a policy document.')
      return
    }

    // Upload to the backend and wait for the parse job
    setUploading(true)
    setUploadError('')
    setUploadSuccess(false)
    setDocumentId(null)

    // A failed parse is still saved below (as 'Parse Failed') so it shows in the
    // Policies view and can be deleted or re-uploaded.
    let parseFailed = false
    let storedDocumentId = null
    try {
      await uploadPolicy(selectedFile.file, (id) => {
        storedDocumentId = id
        setDocumentId(id)
      })
    } catch (error) {
      setUploadError(error.message)
      parseFailed = true
    }

    // Get today's date
    const today = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    // Create the new policy
    const newPolicy = {
      id: Date.now(),

      name: policyName,

      description: `Policy review for ${policyName}.`,

      date: today,

      age: 'Just now',

      updated: today,

      updatedAge: 'Just now',

      status: parseFailed ? 'Parse Failed' : 'In Review',

      fileName: selectedFile.name,
      documentId: storedDocumentId,
    }

    // Get policies that were previously added, dropping an earlier upload of
    // the same file so a retry replaces it
    try {
      const savedPolicies = (
        JSON.parse(localStorage.getItem('addedPolicies')) || []
      ).filter((policy) => policy.fileName !== selectedFile.name)

      // Add the new policy
      savedPolicies.push(newPolicy)

      // Save the updated list
      localStorage.setItem('addedPolicies', JSON.stringify(savedPolicies))
      setUploadSuccess(!parseFailed)
    } catch {
      setUploadError('The document was uploaded, but the policy could not be saved in this browser.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="app-page">
      {/* =========================
          TOP BAR
      ========================= */}

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

          <span className="top-icon">
            ?
          </span>

          <span className="top-icon">
            ⚙
          </span>

          <div className="user-area">
            <div className="user-avatar">
              SC
            </div>

            <span>
              Sarah Chen
            </span>
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* =========================
            UPDATED SIDEBAR
        ========================= */}

        <aside className="sidebar">
          <Link
            to="/dashboard"
            className="nav-item"
          >
            Dashboard
          </Link>

          <Link
            to="/reviews"
            className="nav-item"
          >
            Review Sessions
          </Link>

          <Link
            to="/policies"
            className="nav-item active"
          >
            Policy Database
          </Link>

          <Link
            to="/guidelines"
            className="nav-item"
          >
            Guideline Database
          </Link>

          <Link
            to="/mappings"
            className="nav-item"
          >
            Document Mappings
          </Link>

          <Link
            to="/audit-log"
            className="nav-item"
          >
            Audit Log
          </Link>
        </aside>

        {/* =========================
            MAIN CONTENT
        ========================= */}

        <main className="new-policy-content">
          {/* Back button */}

          <Link
            to="/policies"
            className="back-link"
          >
            ← Back to Policies
          </Link>

          <h1>
            New Policy
          </h1>

          <p className="new-policy-subtitle">
            Upload new policies
          </p>

          {/* =========================
              POLICY INFORMATION
          ========================= */}

          <section className="new-policy-card">
            <h2>
              Policy Information
            </h2>

            <label className="new-policy-label">
              Policy Name
            </label>

            <input
              className="new-policy-name-input"
              type="text"
              placeholder="Enter a name for this policy"
              value={policyName}
              disabled={uploading}
              onChange={(event) =>
                setPolicyName(event.target.value)
              }
            />
          </section>

          {/* =========================
              POLICY DOCUMENT
          ========================= */}

          <section className="new-policy-card policy-upload-card">
            <h2>
              Policy Document(s)
            </h2>

            <p>
              Upload or select the policy documents you want to review.
            </p>

            <label className="new-policy-upload-area">
              <input
                type="file"
                accept=".pdf,.docx"
                disabled={uploading}
                hidden
                onChange={handleFileChange}
              />

              <div className="new-policy-upload-icon">
                ⇧
              </div>

              <div>
                <strong>
                  Click to upload
                </strong>

                <span>
                  {' '}
                  or drag and drop a PDF or DOCX file here,
                  or browse your computer.
                </span>
              </div>
            </label>
          </section>

          {/* =========================
              SELECTED FILE
          ========================= */}

          {selectedFile && (
            <div className="new-policy-selected-file">
              <div>
                <strong>
                  {selectedFile.name}
                </strong>

                <small>
                  {selectedFile.name.split('.').pop().toUpperCase()} • {selectedFile.size}
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

          {/* =========================
              BOTTOM BUTTONS
          ========================= */}

          <div className="new-policy-actions">
            <button
              type="button"
              className="cancel-policy-button"
              disabled={uploading}
              onClick={() =>
                navigate('/policies')
              }
            >
              Cancel
            </button>

            <button
              type="button"
              className="upload-policy-button"
              onClick={uploadDocuments}
              disabled={uploading || uploadSuccess}
            >
              {uploading ? 'Parsing…' : 'Upload Documents'}
            </button>
          </div>

          {/* =========================
              PARSE RESULT
              Upload status
          ========================= */}

          {uploadError && (
            <p className="new-policy-error" role="alert">
              {uploadError}
            </p>
          )}

          {uploadSuccess && (
            <div className="new-policy-success" role="status">
              <strong>Policy uploaded successfully.</strong>
              <p>Your document has been processed and is ready for review.</p>
              <Link to="/policies">Go to Policies</Link>
            </div>
          )}
          {documentId && (
            <PolicyDocumentViewer key={documentId} documentId={documentId} fileName={selectedFile?.name} />
          )}
        </main>
      </div>
    </div>
  )
}

export default NewPolicyPage
