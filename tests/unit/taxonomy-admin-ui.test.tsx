import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { TaxonomyAdmin } from "@/components/admin/taxonomy-admin";

describe("taxonomy administration UI", () => {
  it("edits existing categories, fields and field options instead of only hiding them", () => {
    const markup = renderToStaticMarkup(
      <TaxonomyAdmin
        categories={[
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Hash",
            slug: "hash",
            icon: "#",
            description: "Résines séparées.",
            sortOrder: 2,
            isVisible: true,
          },
        ]}
        subcategories={[
          {
            id: "22222222-2222-4222-8222-222222222222",
            categoryId: "11111111-1111-4111-8111-111111111111",
            name: "Bubble Hash",
            slug: "bubble-hash",
            description: "Séparation à l’eau glacée.",
            micronRequirement: "OPTIONAL",
            allowedMicronContexts: ["COLLECTION_SEPARATION"],
            sortOrder: 1,
            isVisible: true,
          },
        ]}
        micronPresets={[
          {
            id: "55555555-5555-4555-8555-555555555555",
            slug: "collection-90-um",
            context: "COLLECTION_SEPARATION",
            mode: "SINGLE",
            label: "90 µm",
            singleValue: 90,
            sortOrder: 2,
            isActive: true,
          },
        ]}
        fields={[
          {
            id: "33333333-3333-4333-8333-333333333333",
            categoryId: "11111111-1111-4111-8111-111111111111",
            key: "texture",
            label: "Texture",
            fieldType: "SELECT",
            description: "Texture déclarée.",
            sortOrder: 4,
            isVisible: true,
            options: [
              {
                id: "44444444-4444-4444-8444-444444444444",
                value: "sableux",
                label: "Sableux",
                description: "Texture friable.",
                sortOrder: 3,
                isActive: true,
              },
            ],
          },
        ]}
      />,
    );

    expect(markup).toContain("Configurer la catégorie");
    expect(markup).toContain("Enregistrer la catégorie");
    expect(markup).toContain("Configurer le champ");
    expect(markup).toContain("Enregistrer le champ");
    expect(markup).toContain("Texture friable.");
    expect(markup).toContain("Active");
    expect(markup).toContain("Enregistrer");
    expect(markup).toContain("Gérer les valeurs micron existantes");
    expect(markup).toContain("Enregistrer la valeur micron");
  });
});
