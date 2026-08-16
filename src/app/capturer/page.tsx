import type { Metadata } from "next";
import { Camera } from "lucide-react";
import { serverApi, unwrapList } from "@/components/data/server-api";
import type { AromaFamilyDto, CategoryDto } from "@/components/data/types";
import { CaptureForm } from "@/components/forms/capture-form";
import { ErrorState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Capturer une découverte" };

export default async function CapturePage() {
  const [result, aromaResult] = await Promise.all([
    serverApi<unknown>("/api/categories"),
    serverApi<unknown>("/api/aromas"),
  ]);
  const categories = unwrapList<CategoryDto>(result.data, ["categories"]);
  const aromaFamilies = unwrapList<AromaFamilyDto>(aromaResult.data, ["aromaFamilies", "families"]);

  return (
    <div className="page-shell page-shell--narrow page-stack">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">Atelier communautaire</p>
          <h1 className="page-title">Capturer une découverte</h1>
          <p>
            Crée un brouillon documenté puis transmets-le à l’équipe. Rien n’est publié
            automatiquement.
          </p>
        </div>
        <Camera className="page-header__mark" size={58} aria-hidden="true" />
      </header>
      {result.error || aromaResult.error ? (
        <ErrorState
          title="Taxonomie indisponible"
          message={result.error ?? aromaResult.error ?? "La taxonomie est indisponible."}
          retryHref="/capturer"
        />
      ) : categories.length === 0 ? (
        <ErrorState
          title="Aucune catégorie active"
          message="L’équipe doit activer au moins une catégorie avant de recevoir une capture."
          retryHref="/capturer"
        />
      ) : (
        <CaptureForm categories={categories} aromaFamilies={aromaFamilies} />
      )}
    </div>
  );
}
