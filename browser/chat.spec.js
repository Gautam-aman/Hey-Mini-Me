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
