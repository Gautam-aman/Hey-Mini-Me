# Hey Mini Me

A conversational web-search agent that retrieves earlier discussions, preserves historical evidence, and checks what changed. JavaScript on Node, with SQLite and one external capability: web search.

## Run

Requires **Node.js 24+**. Copy `.env.example` to `.env`, set `GEMINI_API_KEY` and `TAVILY_API_KEY`, then:

```sh
npm install
npm run dev
```

The Gemini adapter uses the [Google generateContent REST API](https://ai.google.dev/api/generate-content) with JSON output.

Open http://localhost:3000. `MODEL_ID` defaults to `gemini-3.6-flash`; choose an available model if your account does not support it. The application automatically creates its SQLite database. No Docker, vector database, or embeddings key is needed.

Create conversations using **New**, inspect earlier discussions and source observations, and use **Stop** to cancel research. **Delete** removes the selected conversation, derived indexes, evidence, and run metadata. Data stays under the ignored `data/` directory. Local conversations from the first prototype are imported automatically when present.

## Verification

```sh
npm test                 # Component and local HTTP integration tests
npm run build            # JavaScript syntax checks; no compilation needed
npm run eval             # 60 deterministic architecture checks, no keys
npm run eval:ablation    # Reproducible retrieval comparison, no keys
npm run test:e2e         # Chromium UI test; install browser below if needed
npx playwright install chromium
npm run eval:live        # Real search and model smoke test; both API keys
npm run eval:model       # Model evaluation on frozen synthetic search fixtures
```

`eval:model` requires the Google Gemini key and spends API credits. Use `EVAL_LIMIT=1` for a small trial. Set `EVAL_VARIANT=A|B|C|D` to compare window-only context, retrieved history, history plus stored evidence, and evidence plus semantic verification. Pass `-- --held-out` only after freezing prompts. See [EVALS.md](EVALS.md) for interpretation and [DESIGN.md](DESIGN.md) for architecture and tradeoffs.

## Boundaries

This is a local single-user application bound to loopback, with isolated conversations. It does not provide multi-user authentication or cloud hosting. Conversation context is sent to Google Gemini; generated public search queries go to Tavily. Source excerpts may be incomplete or stale. Citation-ID checks and model verification reduce errors but do not guarantee factual truth. The agent reports uncertainty rather than treating missing results as proof of no change.

Live model quality and provider compatibility have not been measured in this workspace because API keys are absent. Offline test results must not be presented as evidence of model answer quality.
