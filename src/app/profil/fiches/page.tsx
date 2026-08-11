import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { serverApi, unwrapList } from "@/components/data/server-api";
import type { EntrySummaryDto } from "@/components/data/types";
import { EntryGrid } from "@/components/entries/entry-card";
import { EmptyState, ErrorState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Mes fiches" };

export default async function MyEntriesPage() {
  const result = await serverApi<unknown>("/api/me");
  const entries = unwrapList<EntrySummaryDto>(result.data, ["entries"]);
  const changesRequested = entries.filter((entry) => entry.status === "CHANGES_REQUESTED");
  return (
    <div className="page-shell page-stack">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">Atelier du Dresseur</p>
          <h1 className="page-title">Mes fiches</h1>
          <p>Brouillons, fiches en validation et captures publiées liées à ton profil.</p>
        </div>
        <BookOpen className="page-header__mark" size={58} aria-hidden="true" />
      </header>
      {result.error ? (
        <ErrorState message={result.error} retryHref="/profil/fiches" />
      ) : entries.length > 0 ? (
        <>
          {changesRequested.length > 0 && (
            <section className="content-panel page-stack">
              <div>
                <p className="eyebrow">Action requise</p>
                <h2>Modifications demandées</h2>
                <p>L’équipe attend une nouvelle version de ces fiches.</p>
              </div>
              <div className="button-row">
                {changesRequested.map((entry) => (
                  <Link
                    className="button"
                    href={`/profil/fiches/${encodeURIComponent(String(entry.id))}/modifier`}
                    key={String(entry.id)}
                  >
                    Modifier « {entry.name} »
                  </Link>
                ))}
              </div>
            </section>
          )}
          <EntryGrid entries={entries} />
        </>
      ) : (
        <EmptyState
          title="Aucune fiche enregistrée"
          description="Commence une capture ; elle sera conservée comme brouillon avant soumission."
          action={{ href: "/capturer", label: "Capturer" }}
        />
      )}
    </div>
  );
}
