
import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'

function NewPolicyPage() {
  const navigate = useNavigate()

  const [policyName, setPolicyName] = useState('')

  const [selectedFile, setSelectedFile] = useState({
    name: 'Cardiac_Coverage_Policy_v4.pdf',
    size: '2.4 MB',
  })

  // Handles selecting a file from the computer
  function handleFileChange(event) {
    const file = event.target.files[0]

    if (file) {
      setSelectedFile({
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
      })
    }
  }

  // Removes the selected file
  function removeFile() {
    setSelectedFile(null)
  }

  // Runs when Upload Documents is clicked
  function uploadDocuments() {
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

      status: 'In Review',

      fileName: selectedFile.name,
    }

    // Get policies that were previously added
    const savedPolicies =
      JSON.parse(localStorage.getItem('addedPolicies')) || []

    // Add the new policy
    savedPolicies.push(newPolicy)

    // Save the updated list
    localStorage.setItem(
      'addedPolicies',
      JSON.stringify(savedPolicies)
    )

    // Go back to the Policies page
    navigate('/policies')
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
                accept=".pdf,.doc,.docx"
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
                  PDF • {selectedFile.size}
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

          {/* =========================
              BOTTOM BUTTONS
          ========================= */}

          <div className="new-policy-actions">
            <button
              type="button"
              className="cancel-policy-button"
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
            >
              Upload Documents
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}

export default NewPolicyPage
