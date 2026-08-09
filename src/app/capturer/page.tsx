import type { Metadata } from "next";
import { Camera } from "lucide-react";
import { serverApi, unwrapList } from "@/components/data/server-api";
import type { CategoryDto } from "@/components/data/types";
import { CaptureForm } from "@/components/forms/capture-form";
import { ErrorState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Capturer une découverte" };

export default async function CapturePage() {
  const result = await serverApi<unknown>("/api/categories");
  const categories = unwrapList<CategoryDto>(result.data, ["categories"]);

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
      {result.error ? (
        <ErrorState title="Taxonomie indisponible" message={result.error} retryHref="/capturer" />
      ) : categories.length === 0 ? (
        <ErrorState
          title="Aucune catégorie active"
          message="L’équipe doit activer au moins une catégorie avant de recevoir une capture."
          retryHref="/capturer"
        />
      ) : (
        <CaptureForm categories={categories} />
      )}
    </div>
  );
}
