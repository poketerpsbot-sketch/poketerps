import type { Metadata } from "next";

import type { CategoryDto, EntryDetailDto } from "@/components/data/types";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { CaptureForm } from "@/components/forms/capture-form";
import { ErrorState } from "@/components/ui/states";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { getEntryByIdOrSlug } from "@/lib/services/catalogue";
import { getLatestEntryChangeRequest } from "@/lib/services/entries";
import { uuidSchema } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Corriger ma fiche" };

export default async function MemberEntryEditPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCurrentUser();
  const { id } = await params;
  const entryId = uuidSchema.parse(id);
  const [entry, request, categoriesResult] = await Promise.all([
    getEntryByIdOrSlug(entryId, actor),
    getLatestEntryChangeRequest(entryId, actor),
    serverApi<unknown>("/api/categories"),
  ]);
  const categories = unwrapList<CategoryDto>(categoriesResult.data, ["categories"]);
  const initialEntry = JSON.parse(JSON.stringify(entry)) as EntryDetailDto;
  const canResubmit = request.status === "CHANGES_REQUESTED";

  return (
    <div className="page-shell page-shell--narrow page-stack">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">Mon atelier</p>
          <h1 className="page-title">Modifier ma fiche</h1>
          <p>
            Les informations déjà saisies sont conservées. Corrige uniquement les points demandés.
          </p>
        </div>
      </header>
      {categoriesResult.error || categories.length === 0 ? (
        <ErrorState
          title="Taxonomie indisponible"
          message={categoriesResult.error ?? "Aucune catégorie active."}
          retryHref={`/profil/fiches/${entryId}/modifier`}
        />
      ) : (
        <CaptureForm
          categories={categories}
          initialEntry={initialEntry}
          allowSubmit={canResubmit}
          moderationMessage={request.reason}
          returnHref="/profil/fiches"
        />
      )}
    </div>
  );
}
