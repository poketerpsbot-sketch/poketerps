import type { Metadata } from "next";
import { CatalogueView, type CatalogueSearchParams } from "@/components/entries/catalogue-view";

export const metadata: Metadata = { title: "Recherche" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<CatalogueSearchParams>;
}) {
  return (
    <CatalogueView
      searchParams={await searchParams}
      pathname="/recherche"
      title="Scanner le Pokédex"
      eyebrow="Recherche avancée"
      description="Recherche par nom, numéro, auteur, caractéristique ou tag."
    />
  );
}
