# Evaluation

## Reproducible offline checks

`npm run eval` runs 60 deterministic checks covering timezone/calendar boundaries, historical retrieval, pricing equivalence, source/message reference validation, direct conversation routing, and research failure paths. Repeated reference-validation cases are parameter variations, not independent real-world conversations.

`npm test` adds database isolation/deletion, search tool propagation, cancellation, concurrency, HTTP lifecycle, verification rejection, and duplicate search handling. `npm run test:e2e` exercises a real Chromium browser with a mocked answer: chat rendering, safe text output, source links, and new conversations.

`npm run eval:ablation` measures two long-history retrieval cases. Window-only context recovers 0/2 target messages; temporal/keyword retrieval recovers 2/2. This demonstrates those two fixture behaviors only. It is not a statistically meaningful answer-quality result.

## Sixty conversational fixtures

`evals/dataset.js` defines synthetic conversations in six categories: confirmed price change, missing historical evidence, erroneous earlier advice, publication/release-date confusion, exact recall, and missing history. There are 42 development and 18 held-out cases. Product names and prices are fictional and never injected into ordinary chat.

`npm run eval:model` runs real model calls with frozen search results and a frozen clock. It requires an Google Gemini key. `EVAL_LIMIT` caps cases. `EVAL_VARIANT` selects A (conversation window), B (history retrieval), C (history and baseline evidence), or D (C plus semantic verification). Run the same model and dataset for comparisons. Use `-- --held-out` only after prompt selection. Human-review the output with `evals/rubric.md`; model judgments can be wrong.

`npm run eval:live` tests actual model and search integration. It needs both API keys. It measures a single current query, not historical accuracy or broad provider quality.

## Current evidence

The 60 deterministic checks pass. All 74 component, Gemini-adapter, and local HTTP tests pass. The Chromium browser test passes. Live provider evaluation cannot run because the workspace has no API keys. Therefore answer groundedness, live change-detection precision/recall, latency percentiles, model choice, and cost remain unmeasured. Do not report offline architecture pass rate as accuracy on hiring evaluation questions.
