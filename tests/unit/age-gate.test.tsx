/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgeGate } from "@/components/layout/age-gate";
import {
  AGE_GATE_CONFIRMED_VALUE,
  AGE_GATE_COOKIE_NAME,
  AGE_GATE_STORAGE_KEY,
} from "@/lib/age-gate";

describe("AgeGate", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = `${AGE_GATE_COOKIE_NAME}=; Path=/; Max-Age=0`;
    delete document.documentElement.dataset.ageGateConfirmed;
    document.body.className = "";
  });

  afterEach(() => {
    cleanup();
    delete document.documentElement.dataset.ageGateConfirmed;
    document.body.className = "";
  });

  it("keeps a native POST fallback while making the hydrated confirmation immediate", () => {
    render(<AgeGate enabled initiallyConfirmed={false} minimumAge={18} />);

    const dialog = screen.getByRole("dialog");
    const form = dialog.querySelector("form");
    expect(form).not.toBeNull();
    expect(form?.getAttribute("action")).toBe("/api/age-confirmation");
    expect(form?.getAttribute("method")).toBe("post");
    expect(document.body.classList.contains("is-age-gate-open")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "J’ai 18 ans ou plus" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.localStorage.getItem(AGE_GATE_STORAGE_KEY)).toBe(AGE_GATE_CONFIRMED_VALUE);
    expect(document.cookie).toContain(`${AGE_GATE_COOKIE_NAME}=${AGE_GATE_CONFIRMED_VALUE}`);
    expect(document.body.classList.contains("is-age-gate-open")).toBe(false);
  });

  it("migrates an existing localStorage confirmation to the server-readable cookie", async () => {
    window.localStorage.setItem(AGE_GATE_STORAGE_KEY, AGE_GATE_CONFIRMED_VALUE);

    render(<AgeGate enabled initiallyConfirmed={false} minimumAge={18} />);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.cookie).toContain(`${AGE_GATE_COOKIE_NAME}=${AGE_GATE_CONFIRMED_VALUE}`);
  });

  it("does not render the gate when the server already received the confirmation cookie", () => {
    render(<AgeGate enabled initiallyConfirmed minimumAge={18} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("blocks the application after an underage declaration", () => {
    render(<AgeGate enabled initiallyConfirmed={false} minimumAge={18} />);

    fireEvent.click(screen.getByRole("button", { name: "J’ai moins de 18 ans" }));

    expect(
      screen.getByRole("heading", { name: "Contenu réservé aux personnes majeures" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "J’ai 18 ans ou plus" })).toBeNull();
    expect(window.localStorage.getItem(AGE_GATE_STORAGE_KEY)).toBe("no");
  });

  it("keeps a server-known underage decision blocked", () => {
    render(<AgeGate enabled initiallyConfirmed={false} initiallyRejected minimumAge={18} />);
    expect(screen.getByText(/tu ne peux pas accéder/i)).toBeTruthy();
  });
});
