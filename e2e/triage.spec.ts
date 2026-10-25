import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("analyst@driftwatch.dev");
  await page.getByLabel("Password", { exact: true }).fill("driftwatch-demo");
  await page.getByRole("button", { name: /enter the operations console/i }).click();
  await expect(page).toHaveURL("/overview");
});

test("procurement alert exposes score, contributions and the PDF taint path", async ({ page }) => {
  await page.goto("/alerts");
  await expect(page.getByRole("heading", { name: "Alert Queue" })).toBeVisible();

  await page.getByText("Procurement Atlas").first().click();
  await expect(page).toHaveURL(/alert=/);
  await expect(page.getByText(/prompt injection with outbound data exfiltration/i).first()).toBeVisible();
  await expect(
    page.locator("span.chip", { hasText: "Σ contributions = risk score" }),
  ).toBeVisible();
  await expect(page.getByText("supplier-acme-pricing.pdf").first()).toBeVisible();
  await expect(page.getByText("hr.salary").first()).toBeVisible();
  await expect(page.getByText(/Apply Restrict at the tool gateway/i).first()).toBeVisible();

  await page.getByRole("link", { name: /evidence explorer/i }).click();
  await expect(page.getByRole("heading", { name: /taint explorer/i })).toBeVisible();
  await expect(page.getByText("supplier-acme-pricing.pdf").first()).toBeVisible();
});

test("gateway denies restricted data but keeps procurement tools available", async ({ page }) => {
  await page.goto("/policies");
  await expect(page.getByRole("heading", { name: /policies & containment/i })).toBeVisible();

  await page.getByRole("combobox").first().selectOption("agt-procurement-1");
  await page.getByRole("button", { name: "legitimate call" }).click();
  await page.getByRole("button", { name: /evaluate at the gateway/i }).click();
  await expect(page.getByText(/^allow$/i).first()).toBeVisible();
  await expect(
    page.getByText("In scope, no blocking policy matched.", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "attack call" }).click();
  await page.getByRole("button", { name: /evaluate at the gateway/i }).click();
  await expect(page.getByText(/^deny$/i).first()).toBeVisible();
  await expect(page.getByText(/outside the declared role|blocks this action/i).first()).toBeVisible();
});
