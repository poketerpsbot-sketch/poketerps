import { describe, expect, it, vi } from "vitest";

import { submitJson } from "@/components/forms/form-api";

describe("form API validation messages", () => {
  it("surfaces precise backend field errors instead of a generic message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message: "Données invalides.",
              details: {
                fieldErrors: {
                  secretWeight: ["Le poids réel est requis."],
                  weightUnit: ["L’unité est requise."],
                },
                formErrors: [],
              },
            },
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const result = await submitJson("/api/admin/contests", "POST", {});

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Poids secret : Le poids réel est requis.");
    expect(result.message).toContain("Unité du poids : L’unité est requise.");
  });
});
