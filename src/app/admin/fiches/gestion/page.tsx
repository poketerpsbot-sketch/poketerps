import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Search } from "lucide-react";

import { AdminEntryManagementActions } from "@/components/admin/admin-entry-management-actions";
import type { CategoryDto, EntrySummaryDto } from "@/components/data/types";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { EmptyState, ErrorState, StatusPill, formatDate } from "@/components/ui/states";
import { requireAdminUser } from "@/lib/auth/admin";

export const metadata: Metadata = { title: "Gestion des fiches" };

const statuses = [
  ["", "Toutes"],
  ["PUBLISHED", "Publiées"],
  ["PENDING_REVIEW", "En attente"],
  ["CHANGES_REQUESTED", "Modifications demandées"],
  ["APPROVED", "Approuvées"],
  ["REJECTED", "Refusées"],
  ["HIDDEN", "Masquées"],
  ["ARCHIVED", "Archivées"],
  ["DRAFT", "Brouillons"],
] as const;
const allowedStatuses = new Set<string>(statuses.map(([value]) => value));

export default async function AdminEntryManagementPage({
  searchParams,
}: {
  searchParams: Promise<{
    query?: string;
    status?: string;
    category?: string;
    subcategory?: string;
    page?: string;
  }>;
}) {
  const actor = await requireAdminUser("entry:update:any");
  const params = await searchParams;
  const query = params.query?.trim().slice(0, 120) ?? "";
  const status = params.status && allowedStatuses.has(params.status) ? params.status : "";
  const category = params.category?.trim().slice(0, 140) ?? "";
  const subcategory = params.subcategory?.trim().slice(0, 140) ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const limit = 25;
  const apiParams = new URLSearchParams({
    limit: String(limit),
    offset: String((page - 1) * limit),
  });
  if (query) apiParams.set("query", query);
  if (status) apiParams.set("status", status);
  if (category) apiParams.set("category", category);
  if (subcategory) apiParams.set("subcategory", subcategory);

  const [entriesResult, categoriesResult] = await Promise.all([
    serverApi<unknown>(`/api/admin/entries?${apiParams}`),
    serverApi<unknown>("/api/categories"),
  ]);
  const entries = unwrapList<EntrySummaryDto>(entriesResult.data, ["entries"]);
  const categories = unwrapList<CategoryDto>(categoriesResult.data, ["categories"]);
  const total = paginationTotal(entriesResult.data, entries.length);
  const selectedCategory = categories.find(
    (item) => String(item.id) === category || item.slug === category,
  );

  return (
    <>
      <header className="page-header page-header--compact">
        <div className="page-header__copy">
          <p className="eyebrow">Bibliothèque complète</p>
          <h1 className="page-title">Gestion des fiches</h1>
          <p>Recherche, modifie, masque, archive ou supprime logiquement les fiches existantes.</p>
        </div>
        <BookOpen aria-hidden="true" />
      </header>

      <form className="content-panel admin-filter-bar admin-entry-filters" method="get">
        <div className="field">
          <label htmlFor="entry-management-query">Nom, numéro ou auteur</label>
          <input id="entry-management-query" name="query" defaultValue={query} maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="entry-management-status">Statut</label>
          <select id="entry-management-status" name="status" defaultValue={status}>
            {statuses.map(([value, label]) => (
              <option value={value} key={value || "all"}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="entry-management-category">Catégorie</label>
          <select id="entry-management-category" name="category" defaultValue={category}>
            <option value="">Toutes</option>
            {categories.map((item) => (
              <option value={String(item.id)} key={String(item.id)}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="entry-management-subcategory">Sous-catégorie</label>
          <select id="entry-management-subcategory" name="subcategory" defaultValue={subcategory}>
            <option value="">Toutes</option>
            {(
              selectedCategory?.subcategories ??
              categories.flatMap((item) => item.subcategories ?? [])
            ).map((item) => (
              <option value={String(item.id)} key={String(item.id)}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <button className="button" type="submit">
          <Search size={16} aria-hidden="true" /> Filtrer
        </button>
      </form>

      <p className="admin-result-count">
        <strong>{total}</strong> fiche{total > 1 ? "s" : ""}
      </p>
      {entriesResult.error ? (
        <ErrorState message={entriesResult.error} retryHref="/admin/fiches/gestion" />
      ) : entries.length === 0 ? (
        <EmptyState title="Aucune fiche" description="Aucune fiche ne correspond à ces filtres." />
      ) : (
        <div className="admin-list">
          {entries.map((entry) => (
            <article className="content-panel admin-entry-management-card" key={String(entry.id)}>
              <div className="admin-list__copy">
                <div className="button-row">
                  <StatusPill value={entry.status} />
                  <span>#{String(entry.publicNumber ?? "—").padStart(3, "0")}</span>
                  <span>{formatDate(entry.updatedAt)}</span>
                </div>
                <h2>{entry.name}</h2>
                <p>{entry.shortDescription ?? "Aucun résumé."}</p>
                <p className="muted">
                  {entry.category?.name ?? "Sans catégorie"}
                  {entry.subcategory?.name ? ` · ${entry.subcategory.name}` : ""}
                  {entry.author?.displayName ? ` · par ${entry.author.displayName}` : ""}
                  {entry.author?.username ? ` (@${entry.author.username})` : ""}
                </p>
              </div>
              <AdminEntryManagementActions
                entryId={String(entry.id)}
                slug={entry.slug}
                name={entry.name}
                status={entry.status ?? "DRAFT"}
                canPermanentlyDelete={actor.role === "OWNER"}
              />
            </article>
          ))}
        </div>
      )}

      <nav className="pagination" aria-label="Pagination des fiches">
        {page > 1 && <Link href={pageHref(params, page - 1)}>Précédent</Link>}
        <span>Page {page}</span>
        {page * limit < total && <Link href={pageHref(params, page + 1)}>Suivant</Link>}
      </nav>
    </>
  );
}

function paginationTotal(payload: unknown, fallback: number): number {
  if (!payload || typeof payload !== "object") return fallback;
  const pagination = (payload as { pagination?: { total?: unknown } }).pagination;
  return typeof pagination?.total === "number" ? pagination.total : fallback;
}

function pageHref(params: Record<string, string | undefined>, page: number): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value && key !== "page") next.set(key, value);
  next.set("page", String(page));
  return `/admin/fiches/gestion?${next}`;
}
