import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serverApi, unwrapList } from "@/components/data/server-api";
import type { CategoryDto } from "@/components/data/types";
import { CatalogueView, type CatalogueSearchParams } from "@/components/entries/catalogue-view";
import { ErrorState } from "@/components/ui/states";

type Props = {
  params: Promise<{ categorySlug: string }>;
  searchParams: Promise<CatalogueSearchParams>;
};

async function getCategory(categorySlug: string) {
  const result = await serverApi<unknown>("/api/categories");
  const categories = unwrapList<CategoryDto>(result.data, ["categories"]);
  return {
    result,
    category: categories.find(
      (item) => item.slug === categorySlug || String(item.id) === categorySlug,
    ),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categorySlug } = await params;
  const { category } = await getCategory(categorySlug);
  return { title: category?.name ?? "Catégorie" };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { categorySlug } = await params;
  const [{ result, category }, query] = await Promise.all([
    getCategory(categorySlug),
    searchParams,
  ]);

  if (result.error) {
    return (
      <div className="page-shell">
        <ErrorState
          message={result.error}
          retryHref={`/categories/${encodeURIComponent(categorySlug)}`}
        />
      </div>
    );
  }
  if (!category) notFound();

  return (
    <CatalogueView
      searchParams={{
        ...query,
        category: category.slug ?? String(category.id),
      }}
      pathname={`/categories/${encodeURIComponent(categorySlug)}`}
      title={category.name}
      eyebrow="Catégorie du Pokédex"
      description={category.description ?? "Toutes les captures publiées dans cette catégorie."}
    />
  );
}
