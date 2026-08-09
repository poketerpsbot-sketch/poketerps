import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PencilLine } from "lucide-react";
import { serverApi, unwrapObject } from "@/components/data/server-api";
import type { EntryDetailDto } from "@/components/data/types";
import { CorrectionForm } from "@/components/forms/correction-form";
import { ErrorState } from "@/components/ui/states";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Proposer une correction" };

export default async function CorrectionPage({ params }: Props) {
  const { slug } = await params;
  const result = await serverApi<unknown>(`/api/entries/${encodeURIComponent(slug)}`);
  if (result.status === 404) notFound();
  const entry = unwrapObject<EntryDetailDto>(result.data, ["entry"]);
  return (
    <div className="page-shell page-shell--narrow page-stack">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">Révision communautaire</p>
          <h1 className="page-title">Proposer une correction</h1>
          <p>
            {entry
              ? `Signale précisément ce qui doit être amélioré sur « ${entry.name} ».`
              : "Signale précisément ce qui doit être amélioré."}
          </p>
        </div>
        <PencilLine className="page-header__mark" size={58} aria-hidden="true" />
      </header>
      {result.error || !entry ? (
        <ErrorState
          message={result.error ?? "Cette capture ne peut pas être corrigée."}
          retryHref={`/fiches/${encodeURIComponent(slug)}/correction`}
        />
      ) : (
        <CorrectionForm entryId={String(entry.id)} entrySlug={entry.slug} />
      )}
    </div>
  );
}
