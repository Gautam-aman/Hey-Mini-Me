import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Store } from "./store.js";
import { providers } from "./providers.js";
import { research } from "./agent.js";
import { selectHistory } from "./memory.js";
export function createApp(store, api) {
  const active = new Set();
  return http.createServer(async (req, res) => {
    const send = (code, value) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(value));
    };
    try {
      if (
        req.headers.origin &&
        new URL(req.headers.origin).host !== req.headers.host
      )
        return send(403, { error: "Cross-origin request rejected" });
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || ""))
        return send(403, { error: "Local access only" });
      const url = new URL(req.url, "http://localhost"),
        path = url.pathname;
      if (req.method === "GET" && path === "/") {
        res.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "content-security-policy":
            "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
        });
        res.end(
          await readFile(new URL("../public/index.html", import.meta.url)),
        );
        return;
      }
      if (req.method === "GET" && path === "/api/conversations")
        return send(200, store.list());
      if (req.method === "GET" && path === "/api/health")
        return send(200, { ready: !!api });
      if (req.method === "POST" && path === "/api/conversations")
        return send(201, { id: store.create() });
      const match = path.match(
        /^\/api\/conversations\/([a-f0-9-]+|legacy)(?:\/(messages|chat))?$/,
      );
      if (!match) return send(404, { error: "Not found" });
      const [, id, action] = match;
      if (!store.exists(id))
        return send(404, { error: "Conversation not found" });
      if (req.method === "DELETE" && !action) {
        if (active.has(id))
          return send(409, { error: "Stop the running answer first" });
        store.delete(id);
        return send(200, { deleted: true });
      }
      if (req.method === "GET" && action === "messages")
        return send(
          200,
          store
            .messages(id)
            .map((m) => ({ ...m, sources: store.evidence(m.id) })),
        );
      if (req.method !== "POST" || action !== "chat")
        return send(404, { error: "Not found" });
      if (!api)
        return send(503, {
          error: "Set ANTHROPIC_API_KEY and TAVILY_API_KEY in .env",
        });
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 20000)
          return send(413, { error: "Message too large" });
      }
      const input = JSON.parse(body);
      if (
        typeof input.message !== "string" ||
        !input.message.trim() ||
        input.message.length > 10000
      )
        return send(400, { error: "Invalid message" });
      const timezone =
        typeof input.timezone === "string" ? input.timezone : "UTC";
      new Intl.DateTimeFormat("en", { timeZone: timezone });
      if (active.has(id))
        return send(409, {
          error: "An answer is already running in this conversation",
        });
      active.add(id);
      const controller = new AbortController(),
        timer = setTimeout(
          () => controller.abort(Error("Research deadline exceeded")),
          90000,
        );
      res.on("close", () => controller.abort(Error("Client disconnected")));
      res.writeHead(200, {
        "content-type": "application/x-ndjson",
        "cache-control": "no-cache",
      });
      const emit = (x) => {
        if (!res.destroyed) res.write(JSON.stringify(x) + "\n");
      };
      try {
        store.add(id, "user", input.message.trim());
        const all = store.messages(id),
          matches = new Set(store.search(id, input.message));
        let history = selectHistory(
          all,
          input.message,
          40,
          new Date().toISOString(),
          timezone,
        );
        for (const m of all)
          if (matches.has(m.id) && !history.includes(m)) history.unshift(m);
        // Bound context by bytes, retaining newest turns and selected original excerpts.
        history = history.slice(-50);
        let remaining = 60000;
        history = history
          .map((m) => {
            const content = m.content.slice(0, Math.min(5000, remaining));
            remaining -= content.length;
            return { ...m, content };
          })
          .filter((m) => m.content);
        const baseline = history
          .filter((m) => m.role === "assistant")
          .flatMap((m) => store.evidence(m.id))
          .slice(-15);
        const result = await research({
          query: input.message,
          history,
          baseline,
          timezone,
          ...api,
          signal: controller.signal,
          onProgress: (message) => emit({ type: "progress", message }),
        });
        controller.signal.throwIfAborted();
        const { sources, ...metadata } = result;
        const answerId = store.add(
          id,
          "assistant",
          result.text,
          metadata,
          sources,
        );
        store.record(id, {
          at: new Date().toISOString(),
          elapsedMs: result.elapsedMs,
          usage: result.usage,
          trace: result.trace,
          intent: result.plan.intent,
        });
        emit({ type: "answer", id: answerId, ...result });
      } catch (error) {
        emit({
          type: "error",
          message: controller.signal.aborted
            ? "The answer was stopped or exceeded its deadline. No incomplete answer was saved."
            : error.message,
        });
      } finally {
        clearTimeout(timer);
        active.delete(id);
        res.end();
      }
    } catch (error) {
      if (!res.headersSent)
        send(400, {
          error: error instanceof SyntaxError ? "Invalid JSON" : error.message,
        });
      else res.end();
    }
  });
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const file = process.env.DATABASE_PATH || "./data/chat.sqlite";
  await mkdir(dirname(file), { recursive: true });
  const store = new Store(file);
  const api =
    process.env.ANTHROPIC_API_KEY && process.env.TAVILY_API_KEY
      ? providers()
      : null;
  const server = createApp(store, api);
  server.listen(Number(process.env.PORT || 3000), "127.0.0.1", () =>
    console.log(`Chat ready at http://localhost:${process.env.PORT || 3000}`),
  );
}
