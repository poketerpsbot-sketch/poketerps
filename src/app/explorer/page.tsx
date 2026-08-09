import type { Metadata } from "next";
import { CatalogueView, type CatalogueSearchParams } from "@/components/entries/catalogue-view";

export const metadata: Metadata = { title: "Explorer" };

export default async function ExplorerPage({
  searchParams,
}: {
  searchParams: Promise<CatalogueSearchParams>;
}) {
  return <CatalogueView searchParams={await searchParams} showCategories />;
}
