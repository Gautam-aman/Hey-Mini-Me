import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/store.js";
import { createApp } from "../src/server.js";
test("HTTP conversation lifecycle, unavailable keys, and origin boundary", async () => {
  const store = new Store(":memory:"),
    server = createApp(store, null);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const created = await fetch(base + "/api/conversations", {
      method: "POST",
    });
    assert.equal(created.status, 201);
    const { id } = await created.json();
    const catalog = await (await fetch(base + "/api/providers")).json();
    assert.equal(catalog.providers.length, 3);
    assert.equal(catalog.defaultProvider, null);
    assert.ok(catalog.providers.every((item) => !item.available));
    assert.equal(
      (await fetch(base + `/api/conversations/${id}/messages`)).status,
      200,
    );
    assert.equal(
      (
        await fetch(base + `/api/conversations/${id}/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: "hello" }),
        })
      ).status,
      503,
    );
    assert.equal(
      (
        await fetch(base + "/api/conversations", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(base + `/api/conversations/${id}`, { method: "DELETE" }))
        .status,
      200,
    );
    assert.equal(
      (await fetch(base + `/api/conversations/${id}/messages`)).status,
      404,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
});
