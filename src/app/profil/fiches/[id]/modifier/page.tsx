import type { Metadata } from "next";

import type { AromaFamilyDto, CategoryDto, EntryDetailDto } from "@/components/data/types";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { CaptureForm } from "@/components/forms/capture-form";
import { ErrorState } from "@/components/ui/states";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { getEntryByIdOrSlug } from "@/lib/services/catalogue";
import { getLatestEntryChangeRequest } from "@/lib/services/entries";
import { uuidSchema } from "@/lib/validation/common";
import { safeInternalHref } from "@/lib/navigation";
import { BackLink } from "@/components/ui/back-link";

export const metadata: Metadata = { title: "Corriger ma fiche" };

export default async function MemberEntryEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const actor = await requireCurrentUser();
  const { id } = await params;
  const { returnTo } = await searchParams;
  const entryId = uuidSchema.parse(id);
  const [entry, request, categoriesResult, aromasResult] = await Promise.all([
    getEntryByIdOrSlug(entryId, actor),
    getLatestEntryChangeRequest(entryId, actor),
    serverApi<unknown>("/api/categories"),
    serverApi<unknown>("/api/aromas"),
  ]);
  const categories = unwrapList<CategoryDto>(categoriesResult.data, ["categories"]);
  const aromaFamilies = unwrapList<AromaFamilyDto>(aromasResult.data, [
    "aromaFamilies",
    "families",
  ]);
  const initialEntry = JSON.parse(JSON.stringify(entry)) as EntryDetailDto;
  const canSubmit = ["DRAFT", "CHANGES_REQUESTED"].includes(request.status);
  const changesRequested = request.status === "CHANGES_REQUESTED";

  return (
    <div className="page-shell page-shell--narrow page-stack">
      <BackLink fallbackHref="/profil/fiches" />
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">Mon atelier</p>
          <h1 className="page-title">Modifier ma fiche</h1>
          <p>
            Les informations déjà saisies sont conservées. Corrige uniquement les points demandés.
          </p>
        </div>
      </header>
      {categoriesResult.error || aromasResult.error || categories.length === 0 ? (
        <ErrorState
          title="Taxonomie indisponible"
          message={categoriesResult.error ?? aromasResult.error ?? "Aucune catégorie active."}
          retryHref={`/profil/fiches/${entryId}/modifier`}
        />
      ) : (
        <CaptureForm
          categories={categories}
          aromaFamilies={aromaFamilies}
          initialEntry={initialEntry}
          allowSubmit={canSubmit}
          moderationMessage={changesRequested ? request.reason : null}
          returnHref={safeInternalHref(returnTo, "/profil/fiches")}
        />
      )}
    </div>
  );
}
