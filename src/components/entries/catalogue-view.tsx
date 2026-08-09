import Link from "next/link";
import { Filter, Search } from "lucide-react";
import type { CategoryDto, EntrySummaryDto } from "@/components/data/types";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { CategoryGrid } from "@/components/entries/category-card";
import { EntryGrid } from "@/components/entries/entry-card";
import { EmptyState, ErrorState } from "@/components/ui/states";

export type CatalogueSearchParams = {
  query?: string | string[];
  category?: string | string[];
  subcategory?: string | string[];
  author?: string | string[];
  tag?: string | string[];
  sort?: string | string[];
  minRating?: string | string[];
  micronMin?: string | string[];
  micronMax?: string | string[];
  page?: string | string[];
};

const FILTER_KEYS = [
  "query",
  "category",
  "subcategory",
  "author",
  "tag",
  "sort",
  "minRating",
  "micronMin",
  "micronMax",
] as const;

function first(value?: string | string[]) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function pageNumber(value?: string | string[]) {
  const parsed = Number.parseInt(first(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function paginationFrom(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const unwrapped =
    record.data && typeof record.data === "object" && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : record;
  const pagination = record.pagination;
  const values =
    pagination && typeof pagination === "object"
      ? (pagination as Record<string, unknown>)
      : unwrapped;
  return {
    total: typeof values.total === "number" ? values.total : null,
    limit: typeof values.limit === "number" ? values.limit : 24,
    offset: typeof values.offset === "number" ? values.offset : 0,
  };
}

function pageHref(pathname: string, params: CatalogueSearchParams, page: number) {
  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = first(params[key]);
    if (value) query.set(key, value);
  }
  query.set("page", String(page));
  return `${pathname}?${query.toString()}`;
}

export async function CatalogueView({
  searchParams,
  pathname = "/explorer",
  title = "Explorer le Pokédex",
  eyebrow = "Scanner les archives",
  description = "Recherche une capture et affine l’analyse avec les catégories, la note ou la popularité.",
  showCategories = false,
}: {
  searchParams: CatalogueSearchParams;
  pathname?: string;
  title?: string;
  eyebrow?: string;
  description?: string;
  showCategories?: boolean;
}) {
  const currentPage = pageNumber(searchParams.page);
  const limit = 24;
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String((currentPage - 1) * limit),
  });
  for (const key of FILTER_KEYS) {
    const value = first(searchParams[key]);
    if (value) query.set(key, value);
  }

  const [catalogueResult, categoriesResult] = await Promise.all([
    serverApi<unknown>(`/api/catalogue?${query.toString()}`),
    serverApi<unknown>("/api/categories"),
  ]);
  const entries = unwrapList<EntrySummaryDto>(catalogueResult.data, ["entries"]);
  const categories = unwrapList<CategoryDto>(categoriesResult.data, ["categories"]);
  const selectedCategory = categories.find(
    (category) => first(searchParams.category) === (category.slug ?? String(category.id)),
  );
  const pagination = paginationFrom(catalogueResult.data);
  const totalPages =
    pagination?.total !== null && pagination?.total !== undefined
      ? Math.max(1, Math.ceil(pagination.total / pagination.limit))
      : entries.length === limit
        ? currentPage + 1
        : currentPage;

  return (
    <div className="page-shell page-stack">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="page-title">{title}</h1>
          <p>{description}</p>
        </div>
        <span className="page-header__mark pokeball" aria-hidden="true" />
      </header>

      <form className="search-console" action={pathname} method="get" role="search">
        <Search aria-hidden="true" />
        <label className="sr-only" htmlFor="catalogue-query">
          Nom, numéro, auteur ou mot-clé
        </label>
        <input
          id="catalogue-query"
          name="query"
          type="search"
          defaultValue={first(searchParams.query)}
          placeholder="Scanner un nom, un numéro, un dresseur…"
        />
        {first(searchParams.category) && (
          <input type="hidden" name="category" value={first(searchParams.category)} />
        )}
        <button className="button" type="submit">
          Scanner
        </button>
      </form>

      {showCategories &&
        categories.length > 0 &&
        !first(searchParams.query) &&
        !first(searchParams.category) && (
          <section className="section-stack" aria-labelledby="explorer-categories">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Taxonomie dynamique</p>
                <h2 id="explorer-categories">Catégories</h2>
              </div>
            </div>
            <CategoryGrid categories={categories} />
          </section>
        )}

      <div className="filter-layout">
        <aside className="filter-panel">
          <h2>
            <Filter size={17} aria-hidden="true" /> Filtres
          </h2>
          <form className="filter-form" action={pathname} method="get">
            {first(searchParams.query) && (
              <input type="hidden" name="query" value={first(searchParams.query)} />
            )}
            <div className="field">
              <label htmlFor="filter-category">Catégorie</label>
              <select
                id="filter-category"
                name="category"
                defaultValue={first(searchParams.category)}
              >
                <option value="">Toutes</option>
                {categories.map((category) => (
                  <option value={category.slug ?? String(category.id)} key={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="filter-subcategory">Sous-catégorie</label>
              <select
                id="filter-subcategory"
                name="subcategory"
                defaultValue={first(searchParams.subcategory)}
                disabled={!selectedCategory?.subcategories?.length}
              >
                <option value="">Toutes</option>
                {selectedCategory?.subcategories?.map((subcategory) => (
                  <option
                    value={subcategory.slug ?? String(subcategory.id)}
                    key={String(subcategory.id)}
                  >
                    {subcategory.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="filter-author">Dresseur</label>
              <input
                id="filter-author"
                name="author"
                defaultValue={first(searchParams.author)}
                placeholder="Nom ou @username"
              />
            </div>
            <div className="field">
              <label htmlFor="filter-tag">Tag</label>
              <input
                id="filter-tag"
                name="tag"
                defaultValue={first(searchParams.tag)}
                placeholder="Ex. fruité"
              />
            </div>
            <div className="field">
              <label htmlFor="filter-rating">Note minimale</label>
              <select
                id="filter-rating"
                name="minRating"
                defaultValue={first(searchParams.minRating)}
              >
                <option value="">Toutes les notes</option>
                <option value="6">6/10 et plus</option>
                <option value="7">7/10 et plus</option>
                <option value="8">8/10 et plus</option>
                <option value="9">9/10 et plus</option>
              </select>
            </div>
            <div className="field-group" role="group" aria-labelledby="micron-filter-label">
              <span id="micron-filter-label" className="field-group__label">
                Plage en microns
              </span>
              <div className="field-grid field-grid--compact">
                <div className="field">
                  <label htmlFor="filter-micron-min">Minimum</label>
                  <input
                    id="filter-micron-min"
                    name="micronMin"
                    type="number"
                    min="1"
                    max="1000"
                    inputMode="numeric"
                    defaultValue={first(searchParams.micronMin)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="filter-micron-max">Maximum</label>
                  <input
                    id="filter-micron-max"
                    name="micronMax"
                    type="number"
                    min="1"
                    max="1000"
                    inputMode="numeric"
                    defaultValue={first(searchParams.micronMax)}
                  />
                </div>
              </div>
            </div>
            <div className="field">
              <label htmlFor="filter-sort">Trier par</label>
              <select
                id="filter-sort"
                name="sort"
                defaultValue={first(searchParams.sort) || "recent"}
              >
                <option value="recent">Plus récentes</option>
                <option value="oldest">Plus anciennes</option>
                <option value="rating">Mieux notées</option>
                <option value="views">Plus vues</option>
                <option value="likes">Plus aimées</option>
                <option value="reviews">Plus d’avis</option>
                <option value="alphabetical">Alphabétique</option>
                <option value="number">Numéro</option>
              </select>
            </div>
            <button className="button" type="submit">
              Appliquer
            </button>
            <Link className="button button--secondary" href={pathname}>
              Réinitialiser
            </Link>
          </form>
        </aside>

        <section className="section-stack" aria-labelledby="catalogue-results">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Résultats du scanner</p>
              <h2 id="catalogue-results">
                {pagination?.total !== null && pagination?.total !== undefined
                  ? `${pagination.total.toLocaleString("fr-CH")} captures`
                  : "Captures publiées"}
              </h2>
            </div>
          </div>
          {catalogueResult.error ? (
            <ErrorState message={catalogueResult.error} retryHref={pathname} />
          ) : entries.length === 0 ? (
            <EmptyState
              title="Aucune capture ne correspond"
              description="Essaie de retirer un filtre ou propose cette découverte à la communauté."
              action={{ href: "/capturer", label: "Proposer une capture" }}
            />
          ) : (
            <EntryGrid entries={entries} />
          )}
          {entries.length > 0 && totalPages > 1 && (
            <nav className="pagination" aria-label="Pagination du catalogue">
              {currentPage > 1 && (
                <Link
                  href={pageHref(pathname, searchParams, currentPage - 1)}
                  aria-label="Page précédente"
                >
                  ←
                </Link>
              )}
              <span aria-current="page">{currentPage}</span>
              {currentPage < totalPages && (
                <Link
                  href={pageHref(pathname, searchParams, currentPage + 1)}
                  aria-label="Page suivante"
                >
                  →
                </Link>
              )}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
