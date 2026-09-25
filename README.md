# ccf-policy-monitor
This project attempts to build a system that monitors external clinical guidelines to detect relevant changes and recommend medical policy revisions for human-in-the-loop review.

Criteria are stored in `policy_criterion` and `guideline_criterion`, each with a
required foreign key to its parent. Their change histories are stored in
`policy_criterion_update` and `guideline_criterion_update` respectively.

Existing databases using `criterion`, `criterion_update`, and `policy_criteria`
require a data migration or a rebuild of disposable prototype data before using
this schema. `Base.metadata.create_all()` does not migrate existing tables or data.

Run the model regression tests after installing `scraper-example/requirements.txt`:
`python -m unittest discover -s scraper-example -p test_models.py -v`.
