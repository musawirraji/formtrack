import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("landing page renders with the hero and CTAs", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /know exactly/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /create your first form/i })
    ).toBeVisible();
  });

  test("health endpoint returns ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe("formtrack");
  });
});
