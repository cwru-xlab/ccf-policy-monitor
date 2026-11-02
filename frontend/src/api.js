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
// documents fail, so the failed list is checked too.
async function waitForJob(jobId) {
  for (;;) {
    const job = await call(`/jobs/${jobId}`)
    if (job.status === 'failed') throw new Error(job.error)
    if (job.status === 'succeeded') {
      if (job.detail.failed?.length) throw new Error(job.detail.failed[0].error)
      return job
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
}

// Upload one CPB file, parse it, and return the full parsed Policy.
export async function uploadPolicy(file) {
  const form = new FormData()
  form.append('files', file)
  const { stored } = await call('/policies/documents', { method: 'POST', body: form })
  if (!stored.length) throw new Error(`${file.name} was already uploaded`)
  const { job_id } = await call('/policies/parse', { method: 'POST' })
  await waitForJob(job_id)
  const item = (await call('/policies')).find((p) => p.document_id === stored[0])
  if (!item) throw new Error(`no policy found for ${file.name} after parsing`)
  return call(`/policies/${encodeURIComponent(item.policy_number)}`)
}
