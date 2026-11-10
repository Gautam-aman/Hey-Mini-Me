# Evaluation

## Reproducible offline checks

`npm run eval` runs 60 deterministic checks covering timezone/calendar boundaries, historical retrieval, pricing equivalence, source/message reference validation, direct conversation routing, and research failure paths. Repeated reference-validation cases are parameter variations, not independent real-world conversations.

`npm test` adds database isolation/deletion, search tool propagation, cancellation, concurrency, HTTP lifecycle, verification rejection, and duplicate search handling. `npm run test:e2e` exercises a real Chromium browser with a mocked answer: chat rendering, safe text output, source links, and new conversations.

`npm run eval:ablation` measures two long-history retrieval cases. Window-only context recovers 0/2 target messages; temporal/keyword retrieval recovers 2/2. This demonstrates those two fixture behaviors only. It is not a statistically meaningful answer-quality result.

## Sixty conversational fixtures

`evals/dataset.js` defines synthetic conversations in six categories: confirmed price change, missing historical evidence, erroneous earlier advice, publication/release-date confusion, exact recall, and missing history. There are 42 development and 18 held-out cases. Product names and prices are fictional and never injected into ordinary chat.

`npm run eval:model` runs real model calls with frozen search results and a frozen clock. It requires a model-provider key. `EVAL_LIMIT` caps cases. `EVAL_VARIANT` selects A (conversation window), B (history retrieval), C (history and baseline evidence), or D (C plus semantic verification). Run the same model and dataset for comparisons. Use `-- --held-out` only after prompt selection. Human-review the output with `evals/rubric.md`; model judgments can be wrong.

`npm run eval:live` tests actual model and search integration. It needs a selected model-provider key and a Tavily key. It measures a single current query, not historical accuracy or broad provider quality.

## Current evidence

The 60 deterministic checks pass. All 107 component, evidence-regression, provider, and local HTTP tests pass. The Chromium browser test passes. A single Gemini 2.5 Flash + Tavily live smoke test completed in 37.4 seconds. Anthropic and OpenAI adapters have mock transport tests but have not been verified with live credentials. Answer groundedness, live change-detection precision/recall, latency percentiles, model choice, and cost remain unmeasured. Do not report offline architecture pass rate as accuracy on hiring evaluation questions.

## Targeted fixes and challenge-shaped checks

`npm run eval:challenge` exercises six distinct multi-turn cases with the configured real model and frozen synthetic search results: the five-product CRM shortlist, dated answer revalidation, Postgres usage pricing, a corrected shortlist, absent history, and incompatible billing terms. Long cases contain 70 distracting turns. Run one with `npm run eval:challenge -- five-crm`. Reports are saved in ignored `data/challenge-*.json`; they contain the answer, expected behavior, plan, timing, usage, and citation-repair diagnostics for manual review. These cases are development regressions, not an untouched test set.

Regression tests now reject null/blank/unknown comparison terms, account for minimum purchased seats, prevent multiplying infrastructure prices by team size, recover pricing past long navigation, load evidence only after baseline resolution, and verify one-call conversation responses and bounded citation repair. The four long-history challenge cases recover all target message IDs with retrieval (4/4), versus 0/4 with the last 20 messages; this measures retrieval only.

Live findings: the first five-CRM run exhausted Gemini's output budget. After capping Gemini 2.5 reasoning at 1,024 tokens, it recovered all five entities but failed citation validation and returned uncertainty in 29.3 seconds. Five subsequent cases and the focused retry received HTTP 429. Citation-repair feedback was then made more specific and independently regression-tested, but the final live recheck remained rate-limited. Do not count these runs as successful answer-quality evaluations or compare their timings as equivalent answers. Broader groundedness and latency measurements remain outstanding.
