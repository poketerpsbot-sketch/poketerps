import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/admin-header";
import {
  TaxonomyAdmin,
  type AdminCategory,
  type AdminDynamicField,
  type AdminMicronPreset,
  type AdminSubcategory,
} from "@/components/admin/taxonomy-admin";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { EmptyState, ErrorState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Catégories · Administration" };

async function loadAllAdminItems<T>(path: string, keys: string[]) {
  const items: T[] = [];
  for (let offset = 0; offset <= 2_000; offset += 100) {
    const separator = path.includes("?") ? "&" : "?";
    const result = await serverApi<unknown>(`${path}${separator}limit=100&offset=${offset}`);
    if (result.error) return { items, error: result.error };
    const page = unwrapList<T>(result.data, keys);
    items.push(...page);
    if (page.length < 100) return { items, error: null };
  }
  return {
    items,
    error: "La taxonomie dépasse la limite de sécurité de 2 100 éléments.",
  };
}

export default async function AdminCategoriesPage() {
  const [categoryResult, subcategoryResult, fieldResult, micronPresetResult] = await Promise.all([
    loadAllAdminItems<AdminCategory>("/api/admin/categories", ["categories"]),
    loadAllAdminItems<AdminSubcategory>("/api/admin/subcategories", ["subcategories"]),
    loadAllAdminItems<AdminDynamicField>("/api/admin/dynamic-fields", ["fields", "definitions"]),
    serverApi<unknown>("/api/admin/micron-presets"),
  ]);
  const categories = categoryResult.items;
  const subcategories = subcategoryResult.items;
  const fields = fieldResult.items;
  const micronPresets = unwrapList<AdminMicronPreset>(micronPresetResult.data, ["micronPresets"]);

  return (
    <>
      <AdminHeader
        eyebrow="Taxonomie dynamique"
        title="Catégories et caractéristiques"
        description="Organise le catalogue, ses sous-catégories et les champs demandés lors d’une capture."
      />
      {categoryResult.error ? (
        <ErrorState message={categoryResult.error} retryHref="/admin/categories" />
      ) : categories.length === 0 ? (
        <>
          <TaxonomyAdmin
            categories={[]}
            subcategories={[]}
            fields={[]}
            micronPresets={micronPresets}
            secondaryError={
              subcategoryResult.error ?? fieldResult.error ?? micronPresetResult.error
            }
          />
          <EmptyState
            title="Aucune catégorie"
            description="Crée la première catégorie avec le formulaire ci-dessus."
          />
        </>
      ) : (
        <TaxonomyAdmin
          categories={categories}
          subcategories={subcategories}
          fields={fields}
          micronPresets={micronPresets}
          secondaryError={subcategoryResult.error ?? fieldResult.error ?? micronPresetResult.error}
        />
      )}
    </>
  );
}
