import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/admin-header";
import {
  TaxonomyAdmin,
  type AdminCategory,
  type AdminDynamicField,
  type AdminSubcategory,
} from "@/components/admin/taxonomy-admin";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { EmptyState, ErrorState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Catégories · Administration" };

export default async function AdminCategoriesPage() {
  const [categoryResult, subcategoryResult, fieldResult] = await Promise.all([
    serverApi<unknown>("/api/admin/categories?limit=100&offset=0"),
    serverApi<unknown>("/api/admin/subcategories?limit=100&offset=0"),
    serverApi<unknown>("/api/admin/dynamic-fields?limit=100&offset=0"),
  ]);
  const categories = unwrapList<AdminCategory>(categoryResult.data, ["categories"]);
  const subcategories = unwrapList<AdminSubcategory>(subcategoryResult.data, ["subcategories"]);
  const fields = unwrapList<AdminDynamicField>(fieldResult.data, ["fields", "definitions"]);

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
            secondaryError={subcategoryResult.error ?? fieldResult.error}
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
          secondaryError={subcategoryResult.error ?? fieldResult.error}
        />
      )}
    </>
  );
}
