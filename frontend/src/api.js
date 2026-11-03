// Backend client. Every backend path the frontend uses lives in this file.
//
// In dev, '/api' is proxied to http://localhost:8000 by vite.config.js.
// Set VITE_API_URL to call a deployed backend directly instead.

const API = import.meta.env.VITE_API_URL ?? '/api'

async function call(path, options) {
  const res = await fetch(API + path, options)
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

// Background jobs report through GET /jobs/{id}. A job "succeeds" even when single
// documents fail, so the failed list is checked too — but only for ``documentId``,
// since a parse job also retries earlier uploads that failed.
async function waitForJob(jobId, documentId) {
  for (;;) {
    const job = await call(`/jobs/${jobId}`)
    if (job.status === 'failed') throw new Error(job.error)
    if (job.status === 'succeeded') {
      const failure = job.detail.failed?.find((f) => f.document_id === documentId)
      if (failure) throw new Error(failure.error)
      return job
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
}

async function findPolicy(documentId) {
  const item = (await call('/policies')).find((p) => p.document_id === documentId)
  return item && call(`/policies/${encodeURIComponent(item.policy_number)}`)
}

// Upload one CPB file, parse it, and return the full parsed Policy. Re-uploading a
// file returns its existing Policy, or retries the parse if it failed before.
export async function uploadPolicy(file, onStored = () => {}) {
  const form = new FormData()
  form.append('files', file)
  const { stored, duplicates } = await call('/policies/documents', { method: 'POST', body: form })
  const documentId = stored[0] ?? duplicates[0]
  onStored(documentId)
  if (!stored.length) {
    const existing = await findPolicy(documentId)
    if (existing) return existing
  }
  const { job_id } = await call('/policies/parse', { method: 'POST' })
  await waitForJob(job_id, documentId)
  const policy = await findPolicy(documentId)
  if (!policy) throw new Error(`no policy found for ${file.name} after parsing`)
  return policy
}

export async function fetchPolicyDocument(documentId, signal) {
  const res = await fetch(`${API}/policies/documents/${encodeURIComponent(documentId)}`, { signal })
  if (!res.ok) throw new Error('Unable to load this document. It may no longer be available.')
  return res.blob()
}
