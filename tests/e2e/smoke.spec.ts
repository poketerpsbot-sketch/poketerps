import { expect, test } from "@playwright/test";

test("le health check Render reste minimal", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: "ok" });
});

test("la navigation s’adapte au mobile et au bureau", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Complète ton Pokédex/i })).toBeVisible();

  if ((page.viewportSize()?.width ?? 0) >= 820) {
    const navigation = page.getByRole("navigation", { name: "Navigation du site" });
    await expect(navigation.getByRole("link", { name: "Explorer" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Partenaires" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Capturer" })).toBeVisible();
    return;
  }

  const navigation = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(navigation.getByRole("link", { name: "Accueil" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Explorer" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: /Ajouter|Proposer/ })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Partenaires" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Profil" })).toBeVisible();
});

test("une route inconnue utilise la page 404 Pokédex", async ({ page }) => {
  await page.goto("/cette-decouverte-n-existe-pas");

  await expect(page.getByText("404", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Découverte non répertoriée" })).toBeVisible();
});
