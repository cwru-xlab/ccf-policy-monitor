export function savedArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export function policyRecord(policy, metadata = []) {
  const local = metadata.find((item) => item.policy_number === policy.policy_number ||
    item.document_id === policy.document_id)
  const date = policy.effective_date || ''
  return {
    ...local,
    ...policy,
    id: local?.id ?? `policy-${policy.policy_number}`,
    name: local?.name || policy.title || policy.policy_number,
    description: local?.description || '',
    fileName: local?.fileName || policy.title || policy.policy_number,
    created: local?.created || local?.date || date,
    date: local?.date || date,
    updated: local?.updated || policy.last_reviewed || date,
    status: local?.status || 'In Review',
    createdAge: '',
    updatedAge: '',
  }
}

export function guidelineRecords(rows, metadata = []) {
  const records = rows.map((row) => {
    const local = metadata.find((item) => item.guideline_id === row.guideline_id)
    return {
      ...local, ...row,
      id: local?.id ?? `guideline-${row.guideline_id}`,
      name: local?.name || row.title,
      fileName: local?.fileName || row.title,
      description: local?.description || row.source_key,
      created: local?.created || row.published || '',
      updated: local?.updated || row.published || '',
      status: local?.status || 'In Review',
    }
  })
  // Preserve real user-added guidelines from the existing local upload workflow.
  return [...records, ...metadata.filter((item) =>
    !rows.some((row) => row.guideline_id === item.guideline_id))]
}
