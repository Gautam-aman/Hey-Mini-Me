# Hey Mini Me — implementation plan

Status: original proposal. See DESIGN.md for the implemented architecture and deliberate deviations, and EVALS.md for measured checks and pending credential-dependent benchmarks.

## 1. Product thesis

Build a conversational search agent that remembers what the user actually discussed, checks what is true now, and explains what changed with evidence.

The differentiator is temporal correctness: connecting a previous conversation to present-day evidence without inventing memories, confusing old advice with established facts, or claiming that an unsuccessful search proves nothing changed.

The examples suggest three intertwined problems:

1. Resolve references: “Monday,” “those five,” “your answer,” “last Tuesday.”
2. Recover the correct baseline: the original messages, entities, constraints, claims, and sources.
3. Revalidate relevant claims and communicate changes, uncertainty, and practical consequences.

Also support normal conversation, general questions, and first-time web research. Do not overfit the product to pricing questions.

## 2. Recommended architecture

Use one agent with a small, explicit orchestration loop. Memory retrieval, persistence, date arithmetic, validation, and budgeting are application infrastructure. The model has exactly one callable tool: `web_search`.

```text
React chat UI
    │ message + conversation ID + IANA timezone
    ▼
Node API / streaming response
    │
    ├── Trusted request context: server clock, session scope, request ID
    ├── Memory retrieval: recent turns + relevant original message spans
    ├── Typed plan: intent, date candidates, baseline, evidence requirements
    │
    ▼
Bounded agent loop
    ├── Direct answer / clarification when appropriate
    └── web_search → normalized evidence → coverage check → targeted follow-up
    │
    ▼
Answer draft + claim/source references
    │ schema and citation checks; semantic verification for comparison claims
    ▼
Stream answer + sources + scoped uncertainty
    │
    ▼
Persist completed answer, evidence observations, and derived memory
```

Start with TypeScript, Node 24, React/Vite, a small Fastify server, SQLite, Zod, Vitest, and Playwright. Pin exact dependency versions and the tested Node version during implementation. A single `npm run dev` starts the UI and API; initialize the local database automatically. No Docker or external database prerequisite.

Use the Anthropic TypeScript SDK initially, a configurable pinned model ID, and Tavily Search. Benchmark two suitable model configurations on the project's own evaluation set before choosing the submission default. Do not claim that a provider or model is “best” without those measurements.

The Anthropic SDK supports Node, tool use, and streaming. Use its public API directly so request budgets and execution are easy to inspect. [Official TypeScript SDK documentation](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript).

Tavily Search can return source text within the search response and accepts domain/date controls. This makes a strict search-only implementation practical. Use the Search endpoint only: no hidden browser, crawler, separate extraction API, or URL-fetch tool. [Official Tavily Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search).

## 3. Memory: preserve originals and derive useful indexes

Use SQLite with full-text indexing, timestamp indexes, and explicit ownership scopes. Start without a vector database or embeddings API. The target workload gives strong retrieval signals through dates, entities, topics, and nearby messages.

Store these logical records:

| Record | Essential information |
| --- | --- |
| Messages | Owner/session, conversation, role, text, UTC timestamp, sequence, completion state |
| Episodes | Topic, date interval, entities, original message IDs, summary, index version |
| Decisions | Candidate set, selected/rejected entities, constraints, originating message IDs, superseding decision ID |
| Claims | Subject, attribute, normalized value, qualifiers, originating answer, evidence references |
| Evidence observations | URL, title, returned excerpt, content hash, query, retrieved time, publisher date if available, reported effective date if supported |
| Runs | Intent, retrieved IDs, tool calls, timings, token usage, failures, coverage status |

Keep messages and evidence observations append-only during normal use; corrections create new records linked to the previous ones. Explicit user deletion must remove dependent memories and private evidence too.

Separate these provenance categories:

- User-stated preference or fact: “We have 20 salespeople.”
- Assistant assertion: “Provider A is cheapest.” This may have been wrong.
- Source-backed observation: a price with a source excerpt and retrieval time.
- Derived inference: a recommendation or calculation based on other records.

An earlier assistant answer is a baseline to inspect, never automatic proof of the historical world state.

### Retrieval procedure

1. Load recent turns and session metadata before the planning call.
2. Extract explicit dates, topic phrases, and entity aliases; search a wider candidate set by full text and time.
3. Let the typed planner identify the intended episode from candidate snippets. If necessary, execute one bounded internal retrieval refinement using its typed search hints.
4. Expand hits to original neighboring messages so constraints, corrections, and pronoun referents survive.
5. Assemble a token-budgeted context with dates, roles, source IDs, and original excerpts. Summaries help discovery; originals support attribution.
6. If materially different episodes remain plausible, ask a specific question. If no history is available, say so and offer a current answer without fabricating a prior one.

Scope retrieval to the current conversation by default. Cross-conversation recall is allowed only within the same established user/session and must cite the originating conversation. Never retrieve by a client-supplied owner ID alone.

Persist raw turns immediately. Maintain derived episode/decision indexes through a durable pending-job table, with read-time fallback to raw messages. A restart or indexing delay must not make the most recent conversation disappear.

## 4. Time is part of the data model

Inject a server clock and explicit IANA timezone into every request. Make the clock replaceable in tests. Store UTC instants and resolve local calendar boundaries using a timezone-aware library.

Distinguish:

- Conversation time: when the user asked or the assistant answered.
- Observation time: when this application received source content.
- Publication time: when a publisher says a document was published or updated.
- Effective time: when a stated price or policy actually applies.

Never substitute one for another. A fetched result may contain stale content. A changed page timestamp does not establish a product change.

Resolve “3 November” against conversation history and current context, rather than blindly adding the current year. Treat “last Tuesday” and “Monday” as candidate local dates, rank matching episodes, and clarify only where ambiguity changes the answer. In the response, make the resolved date visible naturally: “From our discussion on 3 November…”.

When a prior discussion is found, compare from the relevant message timestamp, not merely from midnight on that day. Search date filters can be coarser than this; validate event dates in the returned evidence.

## 5. Search and comparison workflow

Use a typed plan with intent (`conversation`, `recall`, `research`, `revalidate`), relevant messages, entities, constraints, comparison interval, and evidence requirements. Do not expose private chain-of-thought; record concise operational decisions and IDs.

For each revalidated entity, track independent requirements such as current price, comparable historical price, and material releases. Search coverage is a matrix, not a single success flag.

### Retrieval strategy

- Prefer official pricing pages, documentation, release notes, and dated announcements.
- Search current pricing without a publication-date restriction: pricing pages often have no useful date.
- Search dated announcements and changelogs across the comparison interval separately.
- Use bounded parallel calls for independent entities and requirements.
- Request source text through Search when needed to support a claim. Snippets can locate sources, but incomplete snippets must not support precise pricing assertions.
- Broaden a failed official-domain query once; label secondary evidence and conflicts.
- Treat search date filters as retrieval aids, not proof of an event date.
- Do not interpret provider ranking scores as factual confidence.

Normalize search results into source IDs, URLs, titles, excerpts, dates when available, and retrieval metadata. Preserve sufficient source text for auditing while limiting prompt size. Keep exact supporting spans and adjacent qualifiers when selecting excerpts.

### Compare like with like

A pricing comparison key includes product, plan, currency, region, billing cadence, seat minimum, promotion, and relevant usage limits. For infrastructure products, include compute/storage/egress or workload assumptions where relevant.

Use code for arithmetic. For example, a hypothetical change from $30 to $35 per seat per month is +$100 per month for 20 seats, only if both prices are comparable and exclude the same extras. Annual-billing equivalents must be labeled.

Classify each claim as:

- **Confirmed change:** comparable old and new evidence supports different values. State an exact change date only if supported.
- **Same at the two observations:** comparable values match at baseline and current observation; this does not prove no intermediate changes occurred.
- **Newly discovered information:** current information was not covered earlier; do not call it a new release without a release date.
- **Earlier answer corrected:** evidence shows the prior answer was wrong or unsupported; do not disguise this as a recent change.
- **Unresolved:** missing baseline, insufficient current evidence, incompatible plans, or conflicting sources.

“No announcement found” and “nothing changed” are different claims. If a historical baseline is missing, search for dated historical evidence; if it remains unavailable, give the current finding and state that a change cannot be established.

“Shipped something big” should mean material to this user's decision: required integrations, workflow changes, seat/usage limits, security requirements, availability, or substantial cost. Assess against the recovered 20-person-team constraints rather than marketing language.

## 6. Answer quality and conversation

Default response structure: direct conclusion, the few important changes with citations, implications for the user's decision, and a short note on unresolved checks. Use a comparison table only when it improves readability.

Keep history references and external citations distinct: “You asked…” links to original messages; “The price is…” links to web evidence. The UI should show source retrieval time without suggesting it proves source freshness.

For “Is your answer still correct?”, decompose the old answer into material claims and recommendations. Revalidate volatile claims, check original errors, and explain whether the earlier recommendation still follows from the user's constraints.

Do not search for greetings, rewriting supplied text, or pure recall. Do search for current prices, releases, news, and explicit freshness requests. Preserve follow-up context so “Which would you choose now?” reuses established findings and constraints.

Generate citation references using source IDs; resolve URLs server-side. Reject unknown IDs and unsupported numeric comparisons before release. Structural checks do not prove entailment: comparison answers need a focused semantic check of material claims against excerpts. This can be a second model pass for difficult cases; measure its value and latency.

For complex comparisons, emit real progress events first, validate a compact structured answer, then render it. For straightforward answers, stream text directly with citation handling. Never stream speculative claims and then silently revise them. Label time-to-first-progress separately from time-to-first-substantive-answer in benchmarks.

## 7. Latency, budgets, and failure behavior

Initial tunable limits, to validate experimentally:

- At most two search rounds, 12 total search requests, and four concurrent requests per turn.
- At most five results per search initially, with a bounded evidence/context budget.
- A 40-second overall research deadline and explicit per-request timeouts.
- At most one transient retry per request, counted against the same deadline and request budget.

The five-CRM case may require roughly ten initial checks across price and releases. Reserve follow-up budget for gaps; if the cap prevents full verification, report exactly what remains unchecked.

Measure p50/p95 by intent, input/output tokens, tool calls, observed provider usage, and estimated cost based on a dated pricing configuration. Treat targets such as under 5 seconds for simple recall and under 25 seconds median for multi-entity research as hypotheses, not promises.

Cache identical searches using query, domains, date filters, and content options. Deduplicate in-flight calls. For “since then” or “today” checks, bypass the application result cache; still disclose that upstream results may be cached. Reuse historical evidence as the baseline, not as evidence of current truth.

On a partial outage, return a partial answer with explicit coverage. On missing keys, show an actionable setup error. On cancellation, stop queued and active work and mark the response incomplete; never commit it as a completed factual memory. Serialize turns within a conversation or use optimistic version checks to prevent crossed baselines.

## 8. Security and trust boundaries

- External source text is untrusted data, never agent instructions. Test prompt injection explicitly.
- Validate tool inputs and cap query sizes and results; the only callable tool must be `web_search`.
- Build searches from necessary public entities and attributes, not private transcript dumps.
- Keep API keys server-side; redact keys and sensitive content from routine logs.
- Bind stored conversations to an opaque server-established session. Local demo mode can be single-user, but document that boundary; public deployment needs authentication and authorization.
- Sanitize Markdown, disallow executable HTML, and validate rendered link schemes.
- Include storage reset/deletion and avoid committing local conversations or evidence to Git.

## 9. Evaluation is a core deliverable

Build a frozen-clock, deterministic fixture harness before optimizing prompts. Fixtures include timestamped conversations, stored baseline observations, and replayed search responses. Keep fixture/demo data visibly separate from real chats. Add a separate opt-in live-search smoke suite, because recorded results cannot establish current provider quality.

Start with 60 multi-turn scenarios:

| Category | Cases | What must hold |
| --- | ---: | --- |
| Recall and temporal reference | 12 | Correct episode, dates, entities, and user constraints |
| Prices and releases | 16 | Comparable values, complete entity coverage, supported deltas |
| Missing or ambiguous history | 8 | No invented memory; useful clarification or scoped answer |
| Conflicting and incomplete evidence | 8 | Honest uncertainty; no false no-change claim |
| General research and conversation | 8 | Useful normal chat; appropriate search decisions |
| Injection and operational failures | 8 | Tool boundary, ownership, retries, cancellation, partial results |

Include midnight/timezone boundaries, two discussions on the same date, renamed plans, promotions, a price increase followed by a decrease, a new article about an old release, wrong earlier advice, user corrections, provider timeouts, and history beyond the context window.

Use deterministic assertions for dates, entity sets, arithmetic, source IDs, budgets, and ownership. Use a rubric and human review for groundedness, clarity, and recommendation quality. An LLM judge is supplementary, not the sole scorer.

Report:

- Correct episode/entity retrieval rate.
- Supported material claims / all material factual claims.
- Change-detection precision and recall, including false no-change assertions.
- Required entity/attribute checks actually completed.
- Useful-answer rate alongside abstention, so blanket uncertainty cannot win.
- Latency, tokens, tool calls, cost, and failure recovery by intent.

Separate a development set from held-out conversations. Never tune prompts against the held-out set. Publish sample sizes and exact configurations; repeated runs reveal stochastic variation.

Compare the same model and search provider across: (A) ordinary conversation-window + search, (B) history retrieval + search, (C) history + evidence baselines + explicit comparison, and optionally (D) C with semantic verification. These ablations show which design choices earn their complexity.

## 10. Implementation sequence and acceptance gates

Estimated effort: 7–9 focused engineering days, adjustable to experience and deadline. Prioritize the gates rather than the calendar.

| Milestone | Work | Acceptance gate |
| --- | --- | --- |
| 1. Runnable baseline | TypeScript app, minimal chat UI, model/search adapters, streaming, env validation | Fresh checkout starts with documented key setup, `npm install`, `npm run dev`; exactly one model tool |
| 2. Evaluation skeleton | Frozen clock, replay adapters, initial 15 cases, baseline metrics | Normal chat, recall, current research, tool failure reproducible offline |
| 3. Persistent memory | Messages, episode index, decisions, full-text retrieval, scoped sessions | Recover an actual shortlist after restart and across long histories; no history fabrication |
| 4. Temporal comparison | Evidence ledger, normalized claims, search coverage, explicit delta states | All three provided example patterns pass with dated fixtures, including missing-baseline variants |
| 5. Reliability and speed | Budgets, concurrency, cancellation, citation checks, focused verifier | Partial results honest; tool calls bounded; meaningful latency measured |
| 6. Full evaluation | 60 cases, held-out runs, ablations, live smoke tests, model selection | Failure analysis documented; improvements demonstrated with results, not assertions |
| 7. Submission polish | README, DESIGN, source UI, demo, clean-install audit | Reviewer can run, inspect, and explain the system in minutes |

If time is short, cut decorative UI, embeddings, provider failover, and elaborate dashboards. Preserve durable messages, temporal provenance, the search boundary, honest uncertainty, and the evaluation harness.

## 11. Proposed repository structure

```text
src/
  client/                     # Chat, sources, past-message links
  server/
    app.ts                    # API and session boundary
    config.ts                 # Validated env and pinned defaults
    agent/
      run.ts                  # Explicit bounded orchestration
      plan.ts                 # Intent and typed evidence requirements
      context.ts              # Token-budgeted context assembly
      compare.ts              # Comparison states and arithmetic
      verify.ts               # Citation and semantic validation
    memory/
      repository.ts           # Scoped messages and evidence
      retrieve.ts             # Time/entity/full-text retrieval
      index.ts                # Durable derived-memory jobs
    tools/web-search.ts       # The one model-callable tool
    providers/model.ts        # Small model adapter
    time.ts                   # Clock and calendar resolution
    events.ts                 # Typed progress/answer events
    telemetry.ts              # Timings, usage, operational traces
  shared/schemas.ts
db/migrations/
evals/fixtures/
evals/run.ts
evals/rubric.md
tests/
.env.example
README.md
DESIGN.md
EVALS.md
```

Keep abstractions narrow. One model adapter and one search adapter are enough; do not build a general agent framework.

`.env.example` must enumerate `ANTHROPIC_API_KEY` and `TAVILY_API_KEY`, the only required secrets. Also document optional `MODEL_ID`, `DATABASE_PATH`, and `PORT`; ship a tested model default. No embeddings, telemetry, or hosted database key should be required.

Add scripts for `dev`, `build`, `typecheck`, `test`, `test:e2e`, `eval`, and `eval:live`. Offline tests and fixture evaluations must work without paid API keys. Normal dev mode must not silently replace real providers with fixtures.

## 12. DESIGN.md and reviewer demonstration

Write DESIGN.md around decisions and evidence:

1. Why these examples require temporal memory and evidence provenance.
2. The actual request flow and the one-tool boundary.
3. Data model, retrieval strategy, time semantics, and correction behavior.
4. Search planning, comparison rules, and citation limitations.
5. Latency/cost budgets and measured outcomes.
6. Evaluation methodology, baseline comparison, and failure analysis.
7. Alternatives rejected: multi-agent orchestration, vector database first, whole-history prompts, and mandatory verification for every greeting.
8. Honest limits: inaccessible pages, uncertain historical prices, incomplete search coverage, and no monitoring between user turns.

The strongest short demo:

- Load a clearly labeled, dated fixture with a five-product shortlist and original evidence.
- Ask what changed; show accurate recall, current sources, comparable deltas, and decision impact.
- Open the original conversation and supporting evidence to demonstrate provenance.
- Show a missing-baseline or wrong-earlier-answer case handled honestly.
- Show a provider failure returning useful partial coverage.
- Finish with actual ablation results and the small orchestration loop.

Never present fixture prices as live facts or benchmark targets as achieved results. A separate live query should demonstrate real provider integration.

The submission's strongest claim should be specific and measured: it recovers prior context, verifies changes with evidence, handles uncertainty honestly, and does so within an explicit latency and cost budget.
