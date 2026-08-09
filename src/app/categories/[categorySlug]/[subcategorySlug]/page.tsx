import type { Metadata } from "next";
import { serverApi, unwrapList } from "@/components/data/server-api";
import type { CategoryDto } from "@/components/data/types";
import { CatalogueView, type CatalogueSearchParams } from "@/components/entries/catalogue-view";
import { ErrorState } from "@/components/ui/states";

type Props = {
  params: Promise<{ categorySlug: string; subcategorySlug: string }>;
  searchParams: Promise<CatalogueSearchParams>;
};

async function taxonomy(categorySlug: string, subcategorySlug: string) {
  const result = await serverApi<unknown>("/api/categories");
  const categories = unwrapList<CategoryDto>(result.data, ["categories"]);
  const category = categories.find(
    (item) => item.slug === categorySlug || String(item.id) === categorySlug,
  );
  const subcategory = category?.subcategories?.find(
    (item) => item.slug === subcategorySlug || String(item.id) === subcategorySlug,
  );
  return { result, category, subcategory };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categorySlug, subcategorySlug } = await params;
  const { subcategory } = await taxonomy(categorySlug, subcategorySlug);
  return { title: subcategory?.name ?? subcategorySlug.replaceAll("-", " ") };
}

export default async function SubcategoryPage({ params, searchParams }: Props) {
  const { categorySlug, subcategorySlug } = await params;
  const [{ result, category, subcategory }, query] = await Promise.all([
    taxonomy(categorySlug, subcategorySlug),
    searchParams,
  ]);
  if (result.error) {
    return (
      <div className="page-shell">
        <ErrorState
          message={result.error}
          retryHref={`/categories/${encodeURIComponent(categorySlug)}/${encodeURIComponent(subcategorySlug)}`}
        />
      </div>
    );
  }
  const name = subcategory?.name ?? subcategorySlug.replaceAll("-", " ");
  return (
    <CatalogueView
      searchParams={{
        ...query,
        category: category?.slug ?? categorySlug,
        subcategory: subcategory?.slug ?? subcategorySlug,
      }}
      pathname={`/categories/${encodeURIComponent(categorySlug)}/${encodeURIComponent(subcategorySlug)}`}
      title={name}
      eyebrow={category?.name ?? "Sous-catégorie"}
      description={subcategory?.description ?? "Captures publiées dans cette sous-catégorie."}
    />
  );
}
