# Design

## The problem

“Has anything changed since Tuesday?” requires a baseline. A fresh search cannot establish which shortlist the user meant, which constraints applied, whether the earlier answer was correct, or whether a current price is comparable. This system preserves original messages and evidence observations and supplies both to a bounded research pipeline.

## Execution

1. Persist the user's original message. Retrieve recent turns and older keyword/date matches, expanded to neighbours. SQLite FTS5 supplements candidate retrieval. Date resolution uses the user's IANA timezone and an injectable clock.
2. Ask the model for a structured plan: intent, baseline message IDs, entities, public search queries, and any essential clarification. Validate original-message references. Clarifications return without search.
3. Execute at most ten initial queries through `web_search`, with four concurrent requests. Deduplicate identical in-flight requests. The model has no filesystem, browser, URL-fetch, or code-execution capability. Search is dispatched through typed plan actions, rather than a framework-specific tool runner.
4. Produce a structured answer with source IDs and original-message references. Permit one follow-up search round of up to two additional queries. Source excerpts are bounded before entering model context.
5. Validate citation IDs and reject model-authored URLs. Normalize comparable price dimensions and calculate differences in application code. Reject unknown or incompatible dimensions, invalid values, and missing evidence.
6. For research and revalidation, run a focused semantic check against the actual source excerpts. If it fails, repair once and verify again. A second failure produces a scoped uncertainty response rather than the rejected answer.
7. Atomically persist the completed answer, claims, episode/decision metadata, and source observations. Store timings, model token usage, and per-query coverage separately.

The UI streams operational progress, then releases a complete checked answer. It does not stream unverified factual prose. First progress time and complete answer time should be measured separately.

## Storage and retrieval

SQLite tables hold conversations, original turns, observations, claims, episodes, candidate-entity decisions, run telemetry, and full-text indexes. Every derived record is linked to a turn and conversation. Index updates happen in the same synchronous transaction as message persistence, removing the need for background indexing jobs in this single-process app. Deletion cascades through dependent records and explicitly removes full-text rows. Historical source text is stored with hashes, URLs, publisher dates when available, and observation timestamps.

The original messages remain authoritative for what was said. Source-backed observations remain separate from assistant assertions. This design preserves the ability to identify an old mistake without calling it a recent change.

Retrieval deliberately starts with timestamps, lexical search, and adjacent messages. It can miss paraphrases and ambiguous dates; the model can request clarification. Cross-conversation retrieval is not implicit, avoiding accidental mixing of shortlists. Users select the intended conversation explicitly.

## Temporal and comparison semantics

Dates are resolved against local calendar days. Explicit dates without a year use the most recent matching date. “Last Tuesday” means the most recent prior Tuesday; the planner also sees original timestamps and can clarify ambiguous intent. An event's effective date, document publication date, and source observation time are distinct. Search dates never prove the effective date of a price change.

Comparable prices require product, plan, currency, region, billing cadence, seat minimum, and usage terms. Deterministic output states are confirmed change, same at two observations, and unresolved. Model prose additionally distinguishes newly found information and correction of earlier advice. The semantic verifier checks these distinctions. Structured extraction is still model-dependent and source text can omit decisive qualifiers.

## Reliability and latency

A turn has a ninety-second overall deadline, including planning and verification, twelve search actions, four concurrent searches, two search rounds, and fifteen-second search-request timeouts. This increases the original proposed forty-second deadline to accommodate verification and repairs. Transient HTTP 429/5xx responses receive one bounded retry; retries share the request signal and deadline. Disconnecting the browser or pressing Stop aborts active requests. Incomplete assistant answers are never persisted as completed answers. A per-conversation lock prevents concurrent turns from crossing baselines.

There is no cross-turn current-result cache: freshness requests always contact the provider. Historical observations are reused only as historical evidence. Upstream search results may still be cached. Provider failures appear in coverage metadata and are supplied to the answering and verification stages.

Token usage and timings are stored, but no unverified provider pricing is hardcoded into cost estimates. Actual cost depends on the configured model and provider accounts. Repeated live benchmarks are required before claiming latency or cost targets.

## Trust boundary

The app binds to loopback, rejects foreign Host/Origin values, and implements a local single-user boundary. It must gain authentication and owner-scoped records before being publicly hosted. Keys stay server-side. Browser rendering uses text nodes and HTTP(S) source links, not executable HTML. Source content is explicitly untrusted in planning, generation, and verification. These checks reduce prompt-injection risk; they are not a formal isolation guarantee for an LLM.

## Decisions and alternatives

Native JavaScript/HTTP/SQLite replace the proposed TypeScript/React/Fastify stack to keep the submission small and inspectable; JavaScript satisfies the task. Playwright provides browser tests and Prettier formats the source; the runtime has no third-party dependencies. No build pipeline or hosted database is required.

An explicit plan/search/verify workflow makes budgets and failure behavior visible. Multiple agents would add coordination cost without a demonstrated gain here. A vector database adds infrastructure before lexical/time retrieval failures have been measured. Whole-history prompting would increase latency and bury relevant constraints. Verification is limited to research, rather than ordinary conversation and pure recall.

## Evidence and limits

The offline architecture suite, integration tests, browser tests, and retrieval ablation are reproducible. A separate sixty-case synthetic conversational dataset has development and held-out splits, expected behaviors, and a live-model evaluator. Its judge is supplementary to the human rubric. None of these synthetic checks proves real-world model quality. No live model/search measurements or model-selection claims are made until credentials are supplied and those evaluations run.

There is no background monitoring between user turns, complete web archive, automated account management, or guarantee that inaccessible pricing pages can be verified. Missing historical evidence must stay unresolved. The most valuable next refinement should be chosen from observed held-out retrieval and groundedness failures, rather than adding infrastructure speculatively.
