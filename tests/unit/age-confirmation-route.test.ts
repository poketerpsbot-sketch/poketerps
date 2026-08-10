import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/age-confirmation/route";
import {
  AGE_GATE_CONFIRMED_VALUE,
  AGE_GATE_COOKIE_NAME,
  safeAgeGateReturnUrl,
} from "@/lib/age-gate";

describe("age confirmation route", () => {
  it("sets a persistent cookie and returns to the same-origin page", async () => {
    const response = await POST(
      new Request("https://pokedex.example.test/api/age-confirmation", {
        method: "POST",
        headers: { referer: "https://pokedex.example.test/capturer?source=nav" },
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://pokedex.example.test/capturer?source=nav",
    );
    expect(response.headers.get("set-cookie")).toContain(
      `${AGE_GATE_COOKIE_NAME}=${AGE_GATE_CONFIRMED_VALUE}`,
    );
    expect(response.headers.get("set-cookie")).toContain("Path=/");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("never redirects to an external referer", async () => {
    const requestUrl = "https://pokedex.example.test/api/age-confirmation";
    expect(safeAgeGateReturnUrl(requestUrl, "https://attacker.example/capture").href).toBe(
      "https://pokedex.example.test/",
    );

    const response = await POST(
      new Request(requestUrl, {
        method: "POST",
        headers: { referer: "https://attacker.example/capture" },
      }),
    );
    expect(response.headers.get("location")).toBe("https://pokedex.example.test/");
  });
});
