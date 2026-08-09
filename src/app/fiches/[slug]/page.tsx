import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serverApi, unwrapList, unwrapObject } from "@/components/data/server-api";
import type { EntryDetailDto, ReviewDto } from "@/components/data/types";
import { EntryDetail } from "@/components/entries/entry-detail";
import { ErrorState } from "@/components/ui/states";

type Props = { params: Promise<{ slug: string }> };

async function getEntry(slug: string) {
  const result = await serverApi<unknown>(`/api/entries/${encodeURIComponent(slug)}`);
  return { result, entry: unwrapObject<EntryDetailDto>(result.data, ["entry"]) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { entry } = await getEntry(slug);
  return {
    title: entry?.name ?? "Découverte",
    description: entry?.shortDescription ?? "Fiche éditoriale du Pokédex communautaire.",
  };
}

export default async function EntryPage({ params }: Props) {
  const { slug } = await params;
  const [{ result, entry }, reviewsResult] = await Promise.all([
    getEntry(slug),
    serverApi<unknown>(`/api/entries/${encodeURIComponent(slug)}/reviews`),
  ]);
  if (result.status === 404) notFound();
  if (result.error || !entry) {
    return (
      <div className="page-shell">
        <ErrorState
          message={result.error ?? "Cette fiche ne peut pas être affichée."}
          retryHref={`/fiches/${encodeURIComponent(slug)}`}
        />
      </div>
    );
  }
  const reviews = reviewsResult.error ? [] : unwrapList<ReviewDto>(reviewsResult.data, ["reviews"]);
  return <EntryDetail entry={entry} reviews={reviews} />;
}
