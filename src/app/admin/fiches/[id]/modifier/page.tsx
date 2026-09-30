import type { Metadata } from "next";

import type { AromaFamilyDto, CategoryDto, EntryDetailDto } from "@/components/data/types";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { CaptureForm } from "@/components/forms/capture-form";
import { ErrorState } from "@/components/ui/states";
import { requireAdminUser } from "@/lib/auth/admin";
import { getEntryByIdOrSlug } from "@/lib/services/catalogue";
import { uuidSchema } from "@/lib/validation/common";
import { safeInternalHref } from "@/lib/navigation";
import { BackLink } from "@/components/ui/back-link";

export const metadata: Metadata = { title: "Modifier une fiche" };

export default async function AdminEntryEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const actor = await requireAdminUser("entry:update:any");
  const { id } = await params;
  const { returnTo } = await searchParams;
  const entryId = uuidSchema.parse(id);
  const [entry, categoriesResult, aromasResult] = await Promise.all([
    getEntryByIdOrSlug(entryId, actor),
    serverApi<unknown>("/api/categories"),
    serverApi<unknown>("/api/aromas"),
  ]);
  const categories = unwrapList<CategoryDto>(categoriesResult.data, ["categories"]);
  const aromaFamilies = unwrapList<AromaFamilyDto>(aromasResult.data, [
    "aromaFamilies",
    "families",
  ]);
  const initialEntry = JSON.parse(JSON.stringify(entry)) as EntryDetailDto;

  return (
    <>
      <BackLink fallbackHref="/admin/fiches/gestion" />
      <header className="page-header page-header--compact">
        <div className="page-header__copy">
          <p className="eyebrow">Édition administrative</p>
          <h1 className="page-title">Modifier « {entry.name} »</h1>
          <p>
            Auteur d’origine : {entry.author.displayName}
            {entry.author.username ? ` (@${entry.author.username})` : ""}. Chaque révision reste
            conservée automatiquement.
          </p>
        </div>
      </header>
      {categoriesResult.error || aromasResult.error || categories.length === 0 ? (
        <ErrorState
          title="Taxonomie indisponible"
          message={categoriesResult.error ?? aromasResult.error ?? "Aucune catégorie active."}
          retryHref={`/admin/fiches/${entryId}/modifier`}
        />
      ) : (
        <CaptureForm
          categories={categories}
          aromaFamilies={aromaFamilies}
          initialEntry={initialEntry}
          allowSubmit={false}
          returnHref={safeInternalHref(returnTo, "/admin/fiches/gestion")}
        />
      )}
    </>
  );
}
