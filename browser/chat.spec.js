import { test, expect } from "@playwright/test";
test("chat renders, creates conversations, and safely displays an answer", async ({
  page,
}) => {
  await page.route("**/api/conversations/*/chat", (route) =>
    route.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          type: "answer",
          id: "test-answer",
          text: "<script>unsafe</script> A fixture answer.",
          claims: [{ text: "A supported claim", sourceIds: ["S1"] }],
          historyReferences: [],
          sources: [
            {
              id: "S1",
              url: "https://example.com/pricing",
              title: "Pricing",
              content: "USD 30",
              retrieved_at: "2026-11-10",
            },
          ],
        }) + "\n",
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hey Mini Me" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Message" }).fill("Hello");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator("#test-answer")).toContainText(
    "<script>unsafe</script>",
  );
  await expect(page.locator("#test-answer script")).toHaveCount(0);
  await page.getByText("Evidence behind this answer").click();
  await expect(page.getByRole("link", { name: "[S1]" })).toHaveAttribute(
    "href",
    "https://example.com/pricing",
  );
  await page.getByRole("button", { name: "New", exact: true }).click();
  await expect(page.locator("#messages .message")).toHaveCount(0);
});

test("provider selection is sent with the message and remembered after reload", async ({
  page,
}) => {
  await page.route("**/api/providers", (route) =>
    route.fulfill({
      json: {
        defaultProvider: "gemini",
        providers: [
          {
            id: "gemini",
            label: "Gemini",
            available: true,
            model: "gemini-test",
          },
          {
            id: "anthropic",
            label: "Anthropic",
            available: false,
            model: "claude-test",
          },
          { id: "openai", label: "OpenAI", available: true, model: "gpt-test" },
        ],
      },
    }),
  );
  await page.route("**/api/conversations/*/chat", async (route) => {
    expect(route.request().postDataJSON().provider).toBe("openai");
    await route.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          type: "answer",
          text: "OpenAI fixture answer",
          provider: "openai",
          claims: [],
          sources: [],
          historyReferences: [],
        }) + "\n",
    });
  });
  await page.goto("/");
  const provider = page.getByRole("combobox", { name: "Model provider" });
  await expect(provider.locator("option[value=anthropic]")).toBeDisabled();
  await provider.selectOption("openai");
  await page.reload();
  await expect(provider).toHaveValue("openai");
  await page.getByRole("textbox", { name: "Message" }).fill("Hello");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator("#messages")).toContainText(
    "OpenAI fixture answer",
  );
  await expect(page.locator("#messages")).toContainText("Mini Me · openai");
});

test("welcome, keyboard composer and mobile layout work without horizontal overflow", async ({
  page,
}) => {
  await page.route("**/api/conversations/*/chat", (route) =>
    route.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          type: "answer",
          id: "friendly-answer",
          text: "Here’s what I found: **two useful options**. Let’s compare the details.",
          claims: [],
          sources: [],
          historyReferences: [],
        }) + "\n",
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "New", exact: true }).click();
  await expect(page.locator("#welcome")).toBeVisible();
  await page.screenshot({
    path: "test-results/ui-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Explore my options/ }).click();
  const input = page.getByRole("textbox", { name: "Message" });
  await expect(input).toHaveValue(/CRM/);
  await input.press("Shift+Enter");
  await expect(input).toHaveValue(/\n/);
  await input.press("Enter");
  await expect(page.locator("#friendly-answer strong")).toHaveText(
    "two useful options",
  );
  await expect(page.locator("#welcome")).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/ui-mobile.png", fullPage: true });
});
