import { expect, test } from "@playwright/test";

test.describe("authentication", () => {
  test("serves the public landing page, redirects anonymous visitors and rejects bad credentials", async ({ page }) => {
    // The marketing landing page is public: no redirect, hero is visible.
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /agents drift/i }).first()).toBeVisible();

    // A protected console route still bounces anonymous visitors to /login.
    await page.goto("/overview");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /^sign in$/i })).toBeVisible();

    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: /enter the operations console/i }).click();
    await expect(page.locator("#signin-error")).toContainText(/incorrect email or password/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test("analyst can sign in, navigate the console, and sign out", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill("analyst@driftwatch.dev");
    await page.getByLabel("Password", { exact: true }).fill("driftwatch-demo");
    await page.getByRole("button", { name: /enter the operations console/i }).click();

    await expect(page).toHaveURL("/overview");
    await expect(page.getByText("Fleet alignment", { exact: false }).first()).toBeVisible();
    await page.getByRole("link", { name: "Agents", exact: true }).click();
    await expect(page.getByRole("heading", { name: /agent directory/i })).toBeVisible();
    await expect(page.getByText("Procurement Atlas").first()).toBeVisible();

    // The sign-out action lives in the user menu; open the trigger first.
    await page.locator("header button[aria-haspopup='menu']").click();
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("sign-up page creates an account and offers Google sign-in", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();

    await page.getByLabel("Full name").fill("QA Runner");
    await page.getByLabel("Email address").fill(`qa-${Date.now()}@driftwatch.dev`);
    await page.getByLabel("Password", { exact: true }).fill("driftwatch-demo");
    await page.getByRole("button", { name: /^create account$/i }).click();

    await expect(page).toHaveURL("/overview");
    await expect(page.getByText("Fleet alignment", { exact: false }).first()).toBeVisible();
  });
});
