/*
  Conflict-engine results (POST /conflicts) turned into the review findings that
  ReviewFindingsPage and PolicyReviewEditingPage render.

  Only pairs the user mapped are ever checked: a guideline is sent with the
  selected policies mapped to it, and nothing else. Both sides need a stored
  backend document (documentId); built-in demo records have none.
*/

import { getPoliciesForGuideline } from './guidelineMappings'

export const CATEGORY_LABELS = {
  coverage_gap: 'Coverage Gap',
  opposite_stance: 'Opposite Coverage Stance',
  excluded_service: 'Excluded Service',
  narrower_population: 'Narrower Population',
  frequency_limit: 'Frequency Limit',
  prior_authorization: 'Prior Authorization',
  other_restriction: 'Other Restriction',
}

// Not covering a recommended service at all is high priority; an added limit is low.
const HIGH_PRIORITY = new Set(['coverage_gap', 'opposite_stance', 'excluded_service'])

const STORAGE_KEY = 'conflictReports'

// One entry per mapped guideline that can be checked, with the policies to send.
export function checkablePairs(selectedPolicies, selectedGuidelines) {
  return selectedGuidelines
    .filter((guideline) => guideline.documentId)
    .map((guideline) => ({
      guideline,
      policies: getPoliciesForGuideline(guideline, selectedPolicies).filter(
        (policy) => policy.documentId
      ),
    }))
    .filter((pair) => pair.policies.length > 0)
}

export function pairKey(guidelineDocumentId, policyDocumentId) {
  return `${guidelineDocumentId}|${policyDocumentId}`
}

function readAll() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  } catch {
    return {}
  }
}

// Reports saved for one review session, keyed by pairKey.
export function loadConflictReports(reviewKey) {
  return readAll()[reviewKey] || {}
}

export function saveConflictReports(reviewKey, reports) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...readAll(), [reviewKey]: reports })
  )
}

// Criterion ids are '{parent id}:{position}'; reviewers see the position.
export function criterionLabel(criterionId) {
  const position = String(criterionId).split(':').pop()
  return /^\d+$/.test(position) ? `Criterion ${position}` : String(criterionId)
}

function findingId(report, conflict) {
  return [
    report.guideline_document_id,
    report.policy_document_id,
    conflict.guideline_criterion_id,
    conflict.policy_criterion_id || 'gap',
    conflict.category,
  ].join('~')
}

// Findings for the reports of currently mapped pairs, in the shape the
// findings and editing pages already use.
export function conflictFindings(reports, pairs) {
  const findings = []
  pairs.forEach(({ guideline, policies }) => {
    policies.forEach((policy) => {
      const report = reports[pairKey(guideline.documentId, policy.documentId)]
      if (!report) return
      const base = {
        policyId: policy.id,
        guidelineId: guideline.id,
        policy: policy.name || policy.fileName || report.policy_title,
        guideline: guideline.name || report.guideline_title,
        model: report.model,
        checkedAt: report.checked_at,
      }
      if (report.conflicts.length === 0) {
        findings.push({
          ...base,
          id: `${report.guideline_document_id}~${report.policy_document_id}~none`,
          status: 'No Change Needed',
          priority: 'None',
          category: 'No Conflicts',
          policyCriterion: `${report.policy_criteria_checked} criteria`,
          guidelineCriterion: `${report.guideline_criteria_checked} criteria`,
          summary: `No conflicts found between ${report.guideline_criteria_checked} guideline criteria and ${report.policy_criteria_checked} policy criteria.`,
          rationale: '',
          policyText: '',
          guidelineText: '',
          suggestedText: '',
        })
        return
      }
      report.conflicts.forEach((conflict) => {
        const label = CATEGORY_LABELS[conflict.category] || conflict.category
        findings.push({
          ...base,
          id: findingId(report, conflict),
          status: 'Suggested Change',
          priority: HIGH_PRIORITY.has(conflict.category) ? 'High' : 'Low',
          category: label,
          policyCriterion: conflict.policy_criterion_id
            ? criterionLabel(conflict.policy_criterion_id)
            : 'No matching policy criterion',
          guidelineCriterion: criterionLabel(conflict.guideline_criterion_id),
          policyCriterionId: conflict.policy_criterion_id,
          guidelineCriterionId: conflict.guideline_criterion_id,
          summary: conflict.explanation,
          rationale: `${label}: ${conflict.explanation}`,
          policyText: conflict.policy_quote || '',
          guidelineText: conflict.guideline_quote,
          suggestedText: '',
        })
      })
    })
  })
  return findings
}
