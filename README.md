# ccf-policy-monitor
This project attempts to build a system that monitors external clinical guidelines to detect relevant changes and recommend medical policy revisions for human-in-the-loop review.

Criteria are stored in `policy_criterion` and `guideline_criterion`, each with a
required foreign key to its parent. Their change histories are stored in
`policy_criterion_update` and `guideline_criterion_update` respectively.