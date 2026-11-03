import { useEffect, useState } from 'react'
import { fetchPolicyDocument } from '../api'

export default function PolicyDocumentViewer({ documentId, fileName }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !documentId) return
    const controller = new AbortController()
    let objectUrl
    fetchPolicyDocument(documentId, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message)
      })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [open, documentId])

  if (!documentId) return <p className="document-preview-note">Upload this document again to enable preview.</p>
  if (!fileName?.toLowerCase().endsWith('.pdf')) {
    return <p className="document-preview-note">In-app preview is available for PDF documents.</p>
  }

  return (
    <section className="policy-document-viewer">
      <button type="button" className="upload-policy-button" aria-expanded={open}
        onClick={() => { setUrl(''); setError(''); setOpen(!open) }}>
        {open ? 'Close Document' : 'View Document'}
      </button>
      {open && (
        <div className="policy-document-preview">
          <h2>{fileName}</h2>
          {error ? <p role="alert">{error}</p> : !url ? <p role="status">Loading document…</p> : (
            <>
              <iframe src={url} title={`Document: ${fileName}`} />
              <a href={url} download={fileName}>Download PDF</a>
            </>
          )}
        </div>
      )}
    </section>
  )
}
