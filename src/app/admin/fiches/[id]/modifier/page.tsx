import type { Metadata } from "next";

import type { CategoryDto, EntryDetailDto } from "@/components/data/types";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { CaptureForm } from "@/components/forms/capture-form";
import { ErrorState } from "@/components/ui/states";
import { requireAdminUser } from "@/lib/auth/admin";
import { getEntryByIdOrSlug } from "@/lib/services/catalogue";
import { uuidSchema } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Modifier une fiche" };

export default async function AdminEntryEditPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdminUser("entry:update:any");
  const { id } = await params;
  const entryId = uuidSchema.parse(id);
  const [entry, categoriesResult] = await Promise.all([
    getEntryByIdOrSlug(entryId, actor),
    serverApi<unknown>("/api/categories"),
  ]);
  const categories = unwrapList<CategoryDto>(categoriesResult.data, ["categories"]);
  const initialEntry = JSON.parse(JSON.stringify(entry)) as EntryDetailDto;

  return (
    <>
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
      {categoriesResult.error || categories.length === 0 ? (
        <ErrorState
          title="Taxonomie indisponible"
          message={categoriesResult.error ?? "Aucune catégorie active."}
          retryHref={`/admin/fiches/${entryId}/modifier`}
        />
      ) : (
        <CaptureForm
          categories={categories}
          initialEntry={initialEntry}
          allowSubmit={false}
          returnHref="/admin/fiches/gestion"
        />
      )}
    </>
  );
}
