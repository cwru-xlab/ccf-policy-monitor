/*
  Guidelines approved through the mapping engine.

  An approved backend mapping becomes a Guideline Database record (the same
  shape NewGuidelinePage writes for an upload) linked to its policy, so review
  sessions and the conflict engine treat it like an uploaded guideline.
*/

import {
  getGuidelinePolicyIds,
  saveGuidelinePolicyIds,
} from './guidelineMappings'

function getSavedArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

// The browser-side policy record for a backend policy document id, if any.
export function findPolicyByDocumentId(documentId) {
  return getSavedArray('addedPolicies').find(
    (policy) => policy.documentId === documentId
  )
}

// Add (or reuse) the guideline record for an approved ``mapping`` and link it
// to ``policy``. Returns the guideline record.
export function saveApprovedGuideline(mapping, policy) {
  const guidelines = getSavedArray('addedGuidelines')
  const now = new Date()
  const today = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  let guideline = guidelines.find(
    (item) => item.sourceId === mapping.source_id
  )

  if (!guideline) {
    guideline = {
      id: now.getTime() + Math.floor(Math.random() * 1000),
      name: mapping.title,
      description: `${mapping.authority_name || new URL(mapping.url).hostname}: ${mapping.rationale}`,
      created: today,
      createdAge: 'Just now',
      updated: today,
      updatedAge: 'Just now',
      createdAt: now.toISOString(),
      status: 'In Review',
      fileName: mapping.url,
      documentId: mapping.document_id,
      url: mapping.url,
      sourceId: mapping.source_id,
      origin: 'Mapping engine',
      policyIds: [],
    }
    localStorage.setItem(
      'addedGuidelines',
      JSON.stringify([...guidelines, guideline])
    )
  }

  if (policy) {
    const policyIds = getGuidelinePolicyIds(guideline).map(String)
    if (!policyIds.includes(String(policy.id))) {
      saveGuidelinePolicyIds(guideline.id, [...policyIds, String(policy.id)])
      recordAudit('Mapping Created', policy, guideline)
    }
  }

  return guideline
}

function recordAudit(action, policy, guideline) {
  const auditEvents = getSavedArray('auditEvents')
  const now = new Date()

  localStorage.setItem(
    'auditEvents',
    JSON.stringify([
      ...auditEvents,
      {
        id: `mapping-${now.getTime()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: now.toISOString(),
        user: 'Sarah Chen',
        action,
        category: 'Document Mappings',
        item: policy.name,
        details: `${action} (mapping engine): "${policy.name}" and "${guideline.name}"`,
        policyId: policy.id,
        guidelineId: guideline.id,
      },
    ])
  )
}
