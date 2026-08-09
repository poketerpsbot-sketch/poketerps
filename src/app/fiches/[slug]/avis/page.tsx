import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { serverApi, unwrapObject } from "@/components/data/server-api";
import type { EntryDetailDto } from "@/components/data/types";
import { ReviewForm } from "@/components/forms/review-form";
import { ErrorState } from "@/components/ui/states";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Proposer un avis" };

export default async function ReviewPage({ params }: Props) {
  const { slug } = await params;
  const result = await serverApi<unknown>(`/api/entries/${encodeURIComponent(slug)}`);
  if (result.status === 404) notFound();
  const entry = unwrapObject<EntryDetailDto>(result.data, ["entry"]);

  return (
    <div className="page-shell page-shell--narrow page-stack">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">Avis vérifié</p>
          <h1 className="page-title">Donner mon avis</h1>
          <p>
            {entry
              ? `Évalue « ${entry.name} ». Ton avis restera privé jusqu’à sa validation.`
              : "Ton avis restera privé jusqu’à sa validation."}
          </p>
        </div>
        <MessageSquarePlus className="page-header__mark" size={58} aria-hidden="true" />
      </header>
      {result.error || !entry ? (
        <ErrorState
          message={result.error ?? "Cette capture ne peut pas recevoir d’avis."}
          retryHref={`/fiches/${encodeURIComponent(slug)}/avis`}
        />
      ) : (
        <ReviewForm entryId={String(entry.id)} entrySlug={entry.slug} />
      )}
    </div>
  );
}
