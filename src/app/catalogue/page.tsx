import type { Metadata } from "next";
import { CatalogueView, type CatalogueSearchParams } from "@/components/entries/catalogue-view";

export const metadata: Metadata = { title: "Catalogue" };

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<CatalogueSearchParams>;
}) {
  return (
    <CatalogueView
      searchParams={await searchParams}
      pathname="/catalogue"
      title="Catalogue des captures"
      eyebrow="Archives publiques"
      description="Toutes les fiches validées, publiées et non supprimées du Pokédex."
    />
  );
}
