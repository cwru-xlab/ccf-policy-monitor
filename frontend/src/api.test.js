import test from 'node:test'
import assert from 'node:assert/strict'
import { uploadPolicy } from './api.js'
import { policyRecord, guidelineRecords } from './data/documentCatalog.js'

const policy = { policy_number: '42', document_id: 'cpb_upload-abc', title: 'Uploaded policy' }
const file = new File(['pdf contents'], 'policy.pdf', { type: 'application/pdf' })

function mockRequests(t, responses) {
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, method: options?.method || 'GET' })
    assert.ok(responses.length, `Unexpected request: ${url}`)
    return new Response(JSON.stringify(responses.shift()))
  })
  return requests
}

test('duplicate with a parsed policy reuses it without starting a job', async (t) => {
  const requests = mockRequests(t, [
    { stored: [], duplicates: ['policy.pdf'], document_ids: [policy.document_id] },
    [policy], policy,
  ])
  assert.deepEqual(await uploadPolicy(file), policy)
  assert.deepEqual(requests.map((r) => r.url), [
    '/api/policies/documents', '/api/policies', '/api/policies/42',
  ])
})

for (const duplicate of [false, true]) {
  test(`${duplicate ? 'previously stored' : 'new'} PDF parses only its own document`, async (t) => {
    const requests = mockRequests(t, [
      { stored: duplicate ? [] : [policy.document_id], document_ids: [policy.document_id] },
      [], { job_id: 'job-1' }, { status: 'succeeded', detail: { failed: [] } },
      [policy], policy,
    ])
    assert.deepEqual(await uploadPolicy(file), policy)
    assert.equal(requests[2].url, '/api/policies/parse?document_id=cpb_upload-abc')
  })
}

test('parse failure surfaces the actual error and a later retry can succeed', async (t) => {
  mockRequests(t, [
    { stored: [], document_ids: [policy.document_id] }, [], { job_id: 'job-1' },
    { status: 'succeeded', detail: { failed: [{ error: 'Parser unavailable' }] } },
    { stored: [], document_ids: [policy.document_id] }, [policy], policy,
  ])
  await assert.rejects(uploadPolicy(file), /Parser unavailable/)
  assert.deepEqual(await uploadPolicy(file), policy)
})

test('catalog records work with empty browser storage and retain matching metadata', () => {
  assert.equal(policyRecord(policy).id, 'policy-42')
  assert.equal(policyRecord(policy).name, 'Uploaded policy')
  assert.equal(policyRecord(policy, [{ policy_number: '42', id: 'old-id', name: 'My policy' }]).id, 'old-id')
  assert.equal(policyRecord(policy, [{ id: 1, name: 'Demo policy' }]).name, 'Uploaded policy')
  assert.deepEqual(guidelineRecords([]), [])
  assert.equal(guidelineRecords([{ guideline_id: 'g-1', title: 'Real guideline' }])[0].name, 'Real guideline')
})
