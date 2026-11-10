# Hey Mini Me

A conversational web-search agent that retrieves earlier discussions, preserves historical evidence, and checks what changed. JavaScript on Node, with SQLite and one external capability: web search.

## Run

Requires **Node.js 24+**. Copy `.env.example` to `.env`, set at least one of `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY`, plus `TAVILY_API_KEY`, then:

```sh
npm install
npm run dev
```

Open http://localhost:3000. Use the **Model provider** selector to choose Gemini, Anthropic, or OpenAI; providers with missing keys are disabled. **Auto** selects the first configured key in this order: Gemini, Anthropic, OpenAI. Set `MODEL_PROVIDER` to change the default. Selection is remembered per conversation in your browser. A key's presence does not guarantee account access or quota; provider errors are shown without silently switching services.

Configure models separately with `GEMINI_MODEL`, `ANTHROPIC_MODEL`, and `OPENAI_MODEL`. Defaults are `gemini-2.5-flash`, `claude-sonnet-4-6`, and `gpt-4.1-mini`. The older `MODEL_ID` setting remains a Gemini-only alias. Existing Gemini `.env` files continue to work. Restart the server after changing keys or model settings.

The adapters use [Gemini generateContent](https://ai.google.dev/api/generate-content), [Anthropic Messages](https://platform.claude.com/docs/en/build-with-claude/working-with-messages), and [OpenAI Responses JSON output](https://developers.openai.com/api/docs/guides/structured-outputs). All three use the same memory, comparison, and verification pipeline. Tavily remains the only web-search tool. No Docker, vector database, or embeddings key is needed.

Create conversations using **New**, inspect earlier discussions and source observations, and use **Stop** to cancel research. **Delete** removes the selected conversation, derived indexes, evidence, and run metadata. Data stays under the ignored `data/` directory. Local conversations from the first prototype are imported automatically when present.

## Verification

```sh
npm test                 # Component and local HTTP integration tests
npm run build            # JavaScript syntax checks; no compilation needed
npm run eval             # 60 deterministic architecture checks, no keys
npm run eval:ablation    # Reproducible retrieval comparison, no keys
npm run test:e2e         # Chromium UI test; install browser below if needed
npx playwright install chromium
npm run eval:live        # Real search + selected model; model key and Tavily key
npm run eval:model       # Model evaluation on frozen synthetic search fixtures
npm run eval:challenge   # Six distinct multi-turn regressions; real model, frozen search
```

`eval:model` requires the selected model provider’s key and spends API credits. Use `EVAL_LIMIT=1` for a small trial. Set `EVAL_VARIANT=A|B|C|D` to compare window-only context, retrieved history, history plus stored evidence, and evidence plus semantic verification. Pass `-- --held-out` only after freezing prompts. See [EVALS.md](EVALS.md) for interpretation and [DESIGN.md](DESIGN.md) for architecture and tradeoffs.

## Boundaries

This is a local single-user application bound to loopback, with isolated conversations. It does not provide multi-user authentication or cloud hosting. Conversation context is sent to the selected model provider; generated public search queries go to Tavily. Source excerpts may be incomplete or stale. Citation-ID checks and model verification reduce errors but do not guarantee factual truth. The agent reports uncertainty rather than treating missing results as proof of no change.

Gemini 2.5 Flash and Tavily passed a live integration smoke test. Anthropic and OpenAI adapters are covered by mock transport tests; live compatibility and model quality still need verification with those credentials. Offline test results must not be presented as evidence of model answer quality.
