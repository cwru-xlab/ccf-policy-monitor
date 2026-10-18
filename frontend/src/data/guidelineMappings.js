
/*
  Shared policy-to-guideline mappings.

  Original associations are used by default.

  Users can manually change the associations.
  Manual changes are saved in localStorage and
  used throughout the policy review workflow.
*/

// ==========================================
// ORIGINAL GUIDELINE MAPPINGS
// ==========================================

export const defaultGuidelineMappings = [
  {
    guidelineId: 1,
    policyIds: [1],
  },
  {
    guidelineId: 2,
    policyIds: [2],
  },
  {
    guidelineId: 3,
    policyIds: [3],
  },
  {
    guidelineId: 4,
    policyIds: [4],
  },
  {
    guidelineId: 5,
    policyIds: [5],
  },
]

// ==========================================
// READ SAVED MANUAL MAPPINGS
// ==========================================

function getSavedMappings() {
  try {
    const saved = JSON.parse(
      localStorage.getItem('manualGuidelineMappings')
    )

    if (
      saved &&
      typeof saved === 'object' &&
      !Array.isArray(saved)
    ) {
      return saved
    }

    return {}
  } catch {
    return {}
  }
}

// ==========================================
// GET POLICIES ASSOCIATED WITH A GUIDELINE
// ==========================================

export function getGuidelinePolicyIds(guideline) {
  const savedMappings = getSavedMappings()

  const guidelineId = String(guideline.id)

  // A manually saved mapping takes priority.
  // An empty array means the user deliberately
  // removed all associations.

  if (
    Object.prototype.hasOwnProperty.call(
      savedMappings,
      guidelineId
    )
  ) {
    return Array.isArray(savedMappings[guidelineId])
      ? savedMappings[guidelineId]
      : []
  }

  // Newly added guidelines may already contain
  // their associated policy IDs.

  if (Array.isArray(guideline.policyIds)) {
    return guideline.policyIds
  }

  // Otherwise, use the original demo mapping.

  const defaultMapping = defaultGuidelineMappings.find(
    (mapping) =>
      String(mapping.guidelineId) === guidelineId
  )

  return defaultMapping?.policyIds || []
}

// ==========================================
// SAVE POLICIES FOR ONE GUIDELINE
// ==========================================

export function saveGuidelinePolicyIds(
  guidelineId,
  policyIds
) {
  const savedMappings = getSavedMappings()

  const uniquePolicyIds = [
    ...new Set(policyIds.map((id) => String(id))),
  ]

  savedMappings[String(guidelineId)] = uniquePolicyIds

  localStorage.setItem(
    'manualGuidelineMappings',
    JSON.stringify(savedMappings)
  )
}

// ==========================================
// SAVE GUIDELINES FOR ONE POLICY
// ==========================================

export function saveGuidelinesForPolicy(
  policy,
  selectedGuidelineIds,
  allGuidelines
) {
  const policyId = String(policy.id)

  const selectedIds = new Set(
    selectedGuidelineIds.map((id) => String(id))
  )

  const savedMappings = getSavedMappings()

  // Update this policy's association for every
  // available guideline. Keep associations with
  // other policies unchanged.

  allGuidelines.forEach((guideline) => {
    const guidelineId = String(guideline.id)

    const currentPolicyIds =
      getGuidelinePolicyIds(guideline).map((id) =>
        String(id)
      )

    const otherPolicyIds = currentPolicyIds.filter(
      (id) => id !== policyId
    )

    if (selectedIds.has(guidelineId)) {
      otherPolicyIds.push(policyId)
    }

    savedMappings[guidelineId] = [
      ...new Set(otherPolicyIds),
    ]
  })

  localStorage.setItem(
    'manualGuidelineMappings',
    JSON.stringify(savedMappings)
  )
}

// ==========================================
// GET GUIDELINES FOR ONE POLICY
// ==========================================

export function getGuidelinesForPolicy(
  policy,
  guidelines
) {
  return guidelines.filter((guideline) =>
    getGuidelinePolicyIds(guideline).some(
      (id) => String(id) === String(policy.id)
    )
  )
}

// ==========================================
// GET GUIDELINES FOR MULTIPLE POLICIES
// ==========================================

export function getGuidelinesForPolicies(
  policies,
  guidelines
) {
  const selectedPolicyIds = new Set(
    policies.map((policy) => String(policy.id))
  )

  const matchingGuidelines = guidelines.filter(
    (guideline) =>
      getGuidelinePolicyIds(guideline).some((id) =>
        selectedPolicyIds.has(String(id))
      )
  )

  // Prevent duplicate guidelines.

  return matchingGuidelines.filter(
    (guideline, index, array) =>
      array.findIndex(
        (item) =>
          String(item.id) === String(guideline.id)
      ) === index
  )
}

// ==========================================
// GET POLICIES FOR ONE GUIDELINE
// ==========================================

export function getPoliciesForGuideline(
  guideline,
  policies
) {
  const mappedIds = getGuidelinePolicyIds(guideline)

  return policies.filter((policy) =>
    mappedIds.some(
      (id) => String(id) === String(policy.id)
    )
  )
}
