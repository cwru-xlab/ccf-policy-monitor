export const originalGuidelines = [
    {
      id: 1,
      name: 'Cardiac Coverage Guideline',
      description: 'Policy review for cardiac procedures and treatments.',
      created: 'Sep 23, 2026',
      createdAge: '2 days ago',
      updated: 'Sep 23, 2026',
      updatedAge: '2 days ago',
      status: 'In Review',
    },
    {
      id: 2,
      name: 'Diabetes Treatment Guideline',
      description: 'Policy review for diabetes management and treatment.',
      created: 'Sep 18, 2026',
      createdAge: '6 days ago',
      updated: 'Sep 18, 2026',
      updatedAge: '6 days ago',
      status: 'Completed',
    },
    {
      id: 3,
      name: 'Oncology Coverage Guideline',
      description: 'Policy review for oncology services and treatments.',
      created: 'Sep 10, 2026',
      createdAge: '14 days ago',
      updated: 'Sep 10, 2026',
      updatedAge: '14 days ago',
      status: 'Completed',
    },
    {
      id: 4,
      name: 'Orthopedic Surgery Guideline',
      description: 'Policy review for orthopedic procedures and rehab.',
      created: 'Sep 5, 2026',
      createdAge: '19 days ago',
      updated: 'Sep 5, 2026',
      updatedAge: '19 days ago',
      status: 'In Review',
    },
    {
      id: 5,
      name: 'Mental Health Guideline',
      description: 'Policy review for mental health services and treatment.',
      created: 'Aug 28, 2026',
      createdAge: '27 days ago',
      updated: 'Aug 28, 2026',
      updatedAge: '27 days ago',
      status: 'Completed',
    },
  ]

export function getSavedArray(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function getGuidelines() {
  const deleted = getSavedArray('deletedGuidelineIds')
  return [...getSavedArray('addedGuidelines'), ...originalGuidelines].filter(
    (guideline) => !deleted.some((id) => String(id) === String(guideline.id))
  )
}

// Match policy deletion: hide the record in this browser and retain source files.
export function deleteGuideline(guideline) {
  const deleted = getSavedArray('deletedGuidelineIds')
  localStorage.setItem('deletedGuidelineIds', JSON.stringify([...deleted, guideline.id]))
  const events = getSavedArray('auditEvents')
  events.push({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    user: 'Sarah Chen',
    action: 'Guideline Deleted',
    category: 'Guideline Changes',
    item: guideline.name,
    details: 'Deleted guideline "' + guideline.name + '" from the Guideline Database.',
  })
  localStorage.setItem('auditEvents', JSON.stringify(events))
}
