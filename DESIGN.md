# Design

## How it works

“Has anything changed since Tuesday?” requires both the original discussion and current evidence. The agent preserves original messages and source observations separately: an earlier assistant assertion is a claim to check, not proof of historical truth.

A request follows **retrieve → plan → search → compare → verify**. SQLite full-text search, local calendar dates, and neighbouring messages recover relevant context within the selected conversation. A structured plan identifies the baseline, entities, and queries; ambiguous history can trigger clarification. Web search is the sole external capability. Search returns source excerpts directly.

Answers reference validated source and message IDs. Code calculates price differences only when product, plan, currency, region, billing cadence, seat minimum, and usage terms match. A model verifier checks research claims against excerpts; one repair is allowed before falling back to explicit uncertainty. Completed answers, evidence, and derived indexes are committed atomically.

## Why this architecture

An explicit workflow makes failures inspectable. Native Node JavaScript, HTTP, and SQLite need no runtime dependencies or hosted database. Gemini supplies structured JSON through a REST adapter; Tavily supplies search. Evidence survives restarts; bounded retrieval limits context growth.

Publication dates, observation times, and effective dates are distinct. Matching prices establish sameness at two observations, not an unchanged interval. Missing search results do not prove nothing changed. Incorrect earlier advice should be corrected rather than presented as a recent change.

Research permits twelve search actions across two rounds, four concurrent requests, and a ninety-second overall deadline. Identical in-flight queries share work. Cancellation aborts provider requests and prevents incomplete answers from being saved. The interface streams progress before releasing checked prose.

## Alternatives considered and rejected

Multiple agents add coordination overhead without a demonstrated benefit for one tool. Whole-history prompting increases context cost and obscures relevant constraints. A vector database adds infrastructure before lexical retrieval failures have been measured. Current-result caching could undermine freshness checks; stored observations serve only as historical evidence.

## Evidence and limits

Offline checks cover retrieval, comparisons, references, failures, persistence, and browser behavior. Sixty synthetic conversations support development/held-out evaluations and ablations. Live quality, latency, and cost remain unmeasured without API keys. Lexical retrieval can miss paraphrases; excerpts may be stale or incomplete, and model verification can err. The application is local and single-user, with no monitoring between turns.

## What I would do with another week

First, run the held-out conversations with real model calls and manually audit citation support, change-detection errors, and useful abstentions. Compare retrieval, historical evidence, and verification variants using the same model; measure p50/p95 latency and token usage. Next, fix the largest observed failure class—especially ambiguous dates, paraphrased recall, or incompatible pricing—then rerun the held-out checks. Finally, choose the model and verification policy using those measurements.
