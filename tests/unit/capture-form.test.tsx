// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AromaFamilyDto, CategoryDto } from "@/components/data/types";
import { CaptureForm } from "@/components/forms/capture-form";
import { submitJson } from "@/components/forms/form-api";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/components/forms/form-api", () => ({
  submitJson: vi.fn(),
  uploadImage: vi.fn(),
  validateImage: vi.fn(() => null),
}));

const category = {
  id: "category-id",
  slug: "hash",
  name: "Hash",
  subcategories: [{ id: "subcategory-id", slug: "hash-rosin", name: "Hash Rosin" }],
  fields: [],
} as unknown as CategoryDto;

describe("capture form wizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(submitJson).mockResolvedValue({
      ok: true,
      status: 201,
      message: "ok",
      data: { id: "draft-1", slug: "draft-1" },
    });
  });

  it("creates the draft from the essential step and keeps the same id for the next step", async () => {
    render(<CaptureForm categories={[category]} aromaFamilies={[] as AromaFamilyDto[]} />);

    expect(screen.getByText("L’essentiel de ta découverte")).toBeTruthy();
    expect(screen.queryByText("Enrichir la fiche")).toBeNull();

    fireEvent.change(screen.getByLabelText(/Nom de la fiche/), {
      target: { value: "Hash Rosin" },
    });
    fireEvent.change(screen.getByLabelText(/Catégorie/), {
      target: { value: "category-id" },
    });
    await waitFor(() => expect(screen.getByRole("option", { name: "Hash Rosin" })).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/Sous-catégorie/), {
      target: { value: "subcategory-id" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));

    await waitFor(() => expect(screen.getByText("Ajouter quelques détails")).toBeTruthy());
    expect(submitJson).toHaveBeenCalledTimes(1);
    expect(vi.mocked(submitJson).mock.calls[0]?.[0]).toBe("/api/entries");

    fireEvent.click(screen.getByRole("button", { name: /Passer cette étape/ }));
    await waitFor(() => expect(screen.getByText("Enrichir la fiche")).toBeTruthy());
    expect(submitJson).toHaveBeenCalledTimes(2);
    expect(vi.mocked(submitJson).mock.calls[1]?.[0]).toBe("/api/entries/draft-1");
    expect(vi.mocked(submitJson).mock.calls[1]?.[1]).toBe("PATCH");
  });
});
