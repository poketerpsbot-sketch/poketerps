import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serverApi, unwrapList, unwrapObject } from "@/components/data/server-api";
import type { EntryDetailDto, ReviewDto } from "@/components/data/types";
import { EntryDetail } from "@/components/entries/entry-detail";
import { ErrorState } from "@/components/ui/states";
import { getEnv } from "@/lib/env";

type Props = { params: Promise<{ slug: string }> };

async function getEntry(slug: string) {
  const result = await serverApi<unknown>(`/api/entries/${encodeURIComponent(slug)}`);
  return { result, entry: unwrapObject<EntryDetailDto>(result.data, ["entry"]) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { entry } = await getEntry(slug);
  const title = entry?.name ?? "Découverte";
  const description = entry?.shortDescription ?? "Fiche éditoriale du Pokédex communautaire.";
  const url = entry
    ? `${getEnv().NEXT_PUBLIC_APP_URL}/fiches/${encodeURIComponent(entry.slug)}`
    : undefined;
  const image = entry?.primaryImageUrl ?? entry?.images?.[0]?.url ?? undefined;
  return {
    title,
    description,
    ...(url
      ? {
          alternates: { canonical: url },
          openGraph: {
            title: `${title} · Pokédex`,
            description,
            url,
            type: "article" as const,
            siteName: "Pokédex",
            ...(image ? { images: [{ url: image, alt: `Photo de ${title}` }] } : {}),
          },
          twitter: {
            card: image ? ("summary_large_image" as const) : ("summary" as const),
            title: `${title} · Pokédex`,
            description,
            ...(image ? { images: [image] } : {}),
          },
        }
      : {}),
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
