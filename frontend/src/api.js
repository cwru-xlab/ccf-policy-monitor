// Backend client. Every backend path the frontend uses lives in this file.
//
// In dev, '/api' is proxied to http://localhost:8000 by vite.config.js.
// Set VITE_API_URL to call a deployed backend directly instead.

const API = import.meta.env.VITE_API_URL ?? '/api'

async function call(path, options) {
  const res = await fetch(API + path, options)
  if (!res.ok) {
    const text = await res.text()
    let detail = text
    try {
      const parsed = JSON.parse(text).detail
      if (parsed) detail = typeof parsed === 'string' ? parsed : JSON.stringify(parsed)
    } catch {
      // not JSON: keep the raw body
    }
    throw new Error(`${res.status} ${detail}`)
  }
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
      const failure = documentId && job.detail.failed?.find((f) => f.document_id === documentId)
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

export async function fetchPolicyDocument(documentId, signal, collection = 'policies') {
  const res = await fetch(`${API}/${collection}/documents/${encodeURIComponent(documentId)}`, { signal })
  if (!res.ok) throw new Error('Unable to load this document. It may no longer be available.')
  return res.blob()
}

export async function uploadGuidelineDocument(file) {
  const form = new FormData()
  form.append('files', file)
  const { stored, duplicates } = await call('/guidelines/documents', { method: 'POST', body: form })
  const documentId = stored[0] ?? duplicates[0]
  if (!documentId) throw new Error('The guideline document could not be stored.')
  return documentId
}

// Run the conflict engine for one guideline and the policies the user mapped to
// it. Returns one report per policy. The backend makes one LLM call per policy
// and answers when all are done, so this can take a minute or two.
export function checkConflicts(guidelineDocumentId, policyDocumentIds) {
  return call('/conflicts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      guideline_document_id: guidelineDocumentId,
      policy_document_ids: policyDocumentIds,
    }),
  })
}

// --- Mapping engine (docs/MAPPING_ENGINE_SPEC.md) -----------------------------------

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

// Run the discovery agent for one uploaded policy and wait for it (a few minutes).
// Resolves to the job detail: { guidelines_proposed, authorities_proposed, ... }.
export async function discoverGuidelines(policyDocumentId) {
  const { job_id } = await call('/mapping/discover', json('POST', { policy_document_id: policyDocumentId }))
  return (await waitForJob(job_id)).detail
}

export function listProposals({ status, policyDocumentId } = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (policyDocumentId) params.set('policy_document_id', policyDocumentId)
  return call(`/mapping/proposals?${params}`)
}

// status: 'approved' | 'rejected'. Approving returns the mapping with the guideline's
// snapshot document_id, which the conflict engine accepts like an uploaded guideline.
export function decideProposal(sourceId, policyDocumentId, status) {
  return call('/mapping/proposals/decide', json('POST', {
    source_id: sourceId, policy_document_id: policyDocumentId, status,
  }))
}

export const listAuthorities = () => call('/mapping/authorities')
export const decideAuthority = (authorityId, status) =>
  call(`/mapping/authorities/${encodeURIComponent(authorityId)}/decide`, json('POST', { status }))

export const listTrackedSources = () => call('/mapping/sources')
export const addTrackedSource = (url, policyDocumentId) =>
  call('/mapping/sources', json('POST', { url, policy_document_id: policyDocumentId }))
export const pauseTrackedSource = (sourceId, paused) =>
  call(`/mapping/sources/${sourceId}`, json('PATCH', { paused }))
export const untrackSource = (sourceId) => call(`/mapping/sources/${sourceId}`, { method: 'DELETE' })

export const listGuidelineChanges = (unreadOnly = false) =>
  call(`/mapping/changes?unread_only=${unreadOnly}`)
export const markGuidelineChangeRead = (changeId) =>
  call(`/mapping/changes/${changeId}/read`, { method: 'POST' })

export async function checkGuidelineUpdates() {
  const { job_id } = await call('/mapping/check-updates', { method: 'POST' })
  return (await waitForJob(job_id)).detail
}

export const getMappingSchedule = () => call('/mapping/schedule')
export const saveMappingSchedule = (enabled, intervalHours) =>
  call('/mapping/schedule', json('PUT', { enabled, interval_hours: intervalHours }))

export async function runMappingScheduleNow() {
  const { job_id } = await call('/mapping/schedule/run', { method: 'POST' })
  return (await waitForJob(job_id)).detail
}
