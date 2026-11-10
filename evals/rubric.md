# Human review rubric

Review held-out outputs only after prompts are frozen. Score each from 0 to 2: correct episode/entities; factual support; date interpretation; equivalent price terms; correction versus change; honest uncertainty; useful conclusion; citation accuracy. An invented memory or unsupported confirmed change is a critical failure even when other dimensions score well. Record case ID, reviewer, model, prompt/source revision, and rationale. Review the model judge's decisions independently.

Report supported material claims divided by all material factual claims, confirmed-change precision and recall, false no-change count, completed entity/attribute checks, useful-answer rate and abstention rate. Report p50/p95 elapsed time and tokens separately for recall and research. Frozen-fixture model evaluations do not measure live search quality. Live smoke tests do not establish historical accuracy. Never combine these measurements into a single unexplained score.
